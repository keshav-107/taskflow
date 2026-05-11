import os
import io
import logging
from typing import Tuple, Optional

logger = logging.getLogger(__name__)

# Try importing Google libraries — fail gracefully if not installed
try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseUpload
    GOOGLE_API_AVAILABLE = True
except ImportError:
    GOOGLE_API_AVAILABLE = False


def _direct_preview_url(file_id: str) -> str:
    """Returns a direct URL that can be embedded in <img> or <iframe> for preview."""
    return f"https://drive.google.com/file/d/{file_id}/preview"


def _direct_download_url(file_id: str) -> str:
    """Returns a direct download URL (works as a Blob fetch target)."""
    return f"https://drive.google.com/uc?export=download&id={file_id}&confirm=t"


class StorageService:
    def __init__(self):
        self.backend = os.getenv("STORAGE_BACKEND", "supabase")
        self._drive_service = None

        if self.backend == "gdrive":
            if not GOOGLE_API_AVAILABLE:
                logger.warning("Google API libraries not installed. Falling back to Supabase storage.")
                self.backend = "supabase"
                return

            self.folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "").strip()
            self.creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "google-credentials.json").strip()

            if not self.folder_id:
                logger.warning("GOOGLE_DRIVE_FOLDER_ID not set. Falling back to Supabase.")
                self.backend = "supabase"
                return

            if not os.path.exists(self.creds_path):
                logger.warning(f"Credentials file '{self.creds_path}' not found. Falling back to Supabase.")
                self.backend = "supabase"
                return

            try:
                creds = service_account.Credentials.from_service_account_file(
                    self.creds_path,
                    scopes=["https://www.googleapis.com/auth/drive"],
                )
                self._drive_service = build("drive", "v3", credentials=creds, cache_discovery=False)
                logger.info("Google Drive storage backend initialized successfully.")
            except Exception as e:
                logger.error(f"Failed to initialize Google Drive: {e}. Falling back to Supabase.")
                self.backend = "supabase"

    # ─── Upload ───────────────────────────────────────────────────────────────

    async def upload_file(
        self,
        file_bytes: bytes,
        original_filename: str,
        mime_type: str,
        task_id: str,
    ) -> Tuple[str, Optional[str]]:
        """
        Upload a file and return (storage_identifier, preview_url).
        
        - Google Drive: storage_identifier = Drive file_id (e.g. "1xABCDef...")
        - Supabase:     storage_identifier = storage path (e.g. "task-id/filename.pdf")
        - preview_url:  a URL suitable for embedding; None for Supabase (fetched on demand)
        """
        if self.backend == "gdrive":
            return await self._upload_gdrive(file_bytes, original_filename, mime_type)
        else:
            return await self._upload_supabase(file_bytes, original_filename, mime_type, task_id)

    async def _upload_gdrive(
        self, file_bytes: bytes, original_filename: str, mime_type: str
    ) -> Tuple[str, str]:
        """Upload to Google Drive, preserving the original filename."""
        file_metadata = {
            "name": original_filename,   # Keep human-readable name
            "parents": [self.folder_id],
        }
        media = MediaIoBaseUpload(io.BytesIO(file_bytes), mimetype=mime_type, resumable=False)

        uploaded = self._drive_service.files().create(
            body=file_metadata, media_body=media, fields="id"
        ).execute()

        file_id = uploaded["id"]

        # Make readable by anyone with the link (needed for preview iframe)
        self._drive_service.permissions().create(
            fileId=file_id,
            body={"type": "anyone", "role": "reader"},
            fields="id",
        ).execute()

        preview_url = _direct_preview_url(file_id)
        return file_id, preview_url

    async def _upload_supabase(
        self, file_bytes: bytes, original_filename: str, mime_type: str, task_id: str
    ) -> Tuple[str, None]:
        """Upload to Supabase Storage."""
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
        """
        Return a URL for downloading (or previewing) a file.
        
        The frontend uses this URL two ways:
          - Preview: opens in iframe/img  → needs a non-redirect URL
          - Download: fetched as Blob     → needs a direct binary URL
        
        For Google Drive we return the download URL; the frontend preview 
        uses the /preview embed URL which is stored separately in `web_view_url`.
        For Supabase we return a 1-hour signed URL.
        """
        if self.backend == "gdrive":
            # storage_identifier is the Drive file_id
            return _direct_download_url(storage_identifier)
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
        """
        Return a URL suited for browser-embeddable preview (iframe/img).
        For Drive this is the /preview embed URL.
        For Supabase it's the same signed URL (browsers can inline Supabase URLs).
        """
        if self.backend == "gdrive":
            return _direct_preview_url(storage_identifier)
        else:
            return self.get_file_url(storage_identifier)

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


# Module-level singleton — initialized lazily to respect env vars loaded by dotenv
_storage_service: Optional[StorageService] = None


def get_storage_service() -> StorageService:
    global _storage_service
    if _storage_service is None:
        _storage_service = StorageService()
    return _storage_service


# Backward-compat alias used by files.py
storage_service = get_storage_service()
