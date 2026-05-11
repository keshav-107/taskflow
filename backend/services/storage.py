import os
import io
import logging
from typing import Tuple, Optional

logger = logging.getLogger(__name__)

try:
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request as GoogleRequest
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseUpload
    GOOGLE_API_AVAILABLE = True
except ImportError:
    GOOGLE_API_AVAILABLE = False


def _preview_url(file_id: str) -> str:
    """Embeddable preview URL (works in <iframe> and <img>)."""
    return f"https://drive.google.com/file/d/{file_id}/preview"


def _download_url(file_id: str) -> str:
    """Direct download/fetch URL."""
    return f"https://drive.google.com/uc?export=download&id={file_id}&confirm=t"


class StorageService:
    def __init__(self):
        self.backend = os.getenv("STORAGE_BACKEND", "supabase")
        self._drive_service = None

        if self.backend == "gdrive":
            if not GOOGLE_API_AVAILABLE:
                logger.warning("Google API libraries not installed. Falling back to Supabase.")
                self.backend = "supabase"
                return

            client_id     = os.getenv("GOOGLE_CLIENT_ID", "").strip()
            client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
            refresh_token = os.getenv("GOOGLE_REFRESH_TOKEN", "").strip()
            self.folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "").strip()

            if not all([client_id, client_secret, refresh_token, self.folder_id]):
                missing = [k for k, v in {
                    "GOOGLE_CLIENT_ID": client_id,
                    "GOOGLE_CLIENT_SECRET": client_secret,
                    "GOOGLE_REFRESH_TOKEN": refresh_token,
                    "GOOGLE_DRIVE_FOLDER_ID": self.folder_id,
                }.items() if not v]
                logger.warning(f"Google Drive missing env vars: {missing}. Falling back to Supabase.")
                self.backend = "supabase"
                return

            try:
                creds = Credentials(
                    token=None,
                    refresh_token=refresh_token,
                    token_uri="https://oauth2.googleapis.com/token",
                    client_id=client_id,
                    client_secret=client_secret,
                    scopes=["https://www.googleapis.com/auth/drive"],
                )
                # Force a token refresh to validate credentials at startup
                creds.refresh(GoogleRequest())
                self._drive_service = build("drive", "v3", credentials=creds, cache_discovery=False)
                logger.info("✅ Google Drive OAuth2 storage backend ready.")
            except Exception as e:
                logger.error(f"Google Drive OAuth2 init failed: {e}. Falling back to Supabase.")
                self.backend = "supabase"

    # ─── Upload ───────────────────────────────────────────────────────────────

    async def upload_file(
        self,
        file_bytes: bytes,
        original_filename: str,
        mime_type: str,
        task_id: str,
    ) -> Tuple[str, Optional[str]]:
        if self.backend == "gdrive":
            return await self._upload_gdrive(file_bytes, original_filename, mime_type)
        else:
            return await self._upload_supabase(file_bytes, original_filename, mime_type, task_id)

    async def _upload_gdrive(
        self, file_bytes: bytes, original_filename: str, mime_type: str
    ) -> Tuple[str, str]:
        file_metadata = {
            "name": original_filename,
            "parents": [self.folder_id],
        }
        media = MediaIoBaseUpload(io.BytesIO(file_bytes), mimetype=mime_type, resumable=False)

        uploaded = self._drive_service.files().create(
            body=file_metadata,
            media_body=media,
            fields="id",
            # supportsAllDrives not needed since we use OAuth as the owner
        ).execute()

        file_id = uploaded["id"]

        # Make readable by anyone with the link (for preview iframe)
        self._drive_service.permissions().create(
            fileId=file_id,
            body={"type": "anyone", "role": "reader"},
            fields="id",
        ).execute()

        return file_id, _preview_url(file_id)

    async def _upload_supabase(
        self, file_bytes: bytes, original_filename: str, mime_type: str, task_id: str
    ) -> Tuple[str, None]:
        from config import get_supabase_admin
        admin = get_supabase_admin()
        storage_path = f"{task_id}/{original_filename}"
        admin.storage.from_("task-files").upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": mime_type},
        )
        return storage_path, None

    # ─── Get URL ──────────────────────────────────────────────────────────────

    def get_file_url(self, storage_identifier: str) -> str:
        """Download URL."""
        if self.backend == "gdrive":
            return _download_url(storage_identifier)
        else:
            from config import get_supabase_admin
            admin = get_supabase_admin()
            try:
                resp = admin.storage.from_("task-files").create_signed_url(
                    storage_identifier, 3600, {"download": True}
                )
                return resp.get("signedURL") or resp.get("signed_url") or ""
            except Exception as e:
                logger.error(f"Supabase signed URL error: {e}")
                return ""

    def get_preview_url(self, storage_identifier: str) -> str:
        """Embeddable preview URL (for iframe/img overlay)."""
        if self.backend == "gdrive":
            return _preview_url(storage_identifier)
        else:
            return self.get_file_url(storage_identifier)

    # ─── Download (proxy) ─────────────────────────────────────────────────────

    def download_file_bytes(self, storage_identifier: str) -> bytes:
        """Download raw file bytes — used by the /files/proxy endpoint."""
        if self.backend == "gdrive":
            from googleapiclient.http import MediaIoBaseDownload
            import io
            req = self._drive_service.files().get_media(fileId=storage_identifier)
            buf = io.BytesIO()
            dl = MediaIoBaseDownload(buf, req)
            done = False
            while not done:
                _, done = dl.next_chunk()
            return buf.getvalue()
        else:
            from config import get_supabase_admin
            admin = get_supabase_admin()
            return admin.storage.from_("task-files").download(storage_identifier)

    # ─── Delete ───────────────────────────────────────────────────────────────


    def delete_file(self, storage_identifier: str):
        if self.backend == "gdrive":
            try:
                self._drive_service.files().delete(fileId=storage_identifier).execute()
            except Exception as e:
                logger.error(f"Google Drive delete failed: {e}")
        else:
            from config import get_supabase_admin
            admin = get_supabase_admin()
            try:
                admin.storage.from_("task-files").remove([storage_identifier])
            except Exception as e:
                logger.error(f"Supabase delete failed: {e}")


# Lazy singleton
_storage_service: Optional[StorageService] = None


def get_storage_service() -> StorageService:
    global _storage_service
    if _storage_service is None:
        _storage_service = StorageService()
    return _storage_service
