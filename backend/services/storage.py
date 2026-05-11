import os
import io
import uuid
import logging
from typing import Tuple, Optional
from config import get_supabase_admin, get_settings

logger = logging.getLogger(__name__)

# Try importing Google libraries
try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseUpload
    GOOGLE_API_AVAILABLE = True
except ImportError:
    GOOGLE_API_AVAILABLE = False


class StorageService:
    def __init__(self):
        settings = get_settings()
        # Fall back to supabase if Google API is missing or backend isn't gdrive
        self.backend = os.getenv("STORAGE_BACKEND", "supabase")
        
        if self.backend == "gdrive":
            if not GOOGLE_API_AVAILABLE:
                logger.warning("Google API libraries not installed. Falling back to Supabase storage.")
                self.backend = "supabase"
            else:
                self.folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
                self.creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "google-credentials.json")
                if not self.folder_id or not os.path.exists(self.creds_path):
                    logger.warning("Google Drive credentials or folder ID missing. Falling back to Supabase.")
                    self.backend = "supabase"
                else:
                    self.creds = service_account.Credentials.from_service_account_file(
                        self.creds_path, scopes=["https://www.googleapis.com/auth/drive"]
                    )
                    self.drive_service = build("drive", "v3", credentials=self.creds)

    async def upload_file(self, file_bytes: bytes, original_filename: str, mime_type: str, task_id: str) -> Tuple[str, Optional[str]]:
        """
        Uploads a file and returns (storage_path_or_id, signed_url).
        For Google Drive, the signed_url is the webViewLink (which doesn't expire).
        For Supabase, the signed_url is None here, and generated on demand later.
        """
        ext = original_filename.split(".")[-1] if "." in original_filename else "bin"
        unique_filename = f"{task_id}_{uuid.uuid4().hex[:8]}.{ext}"

        if self.backend == "gdrive":
            try:
                file_metadata = {
                    "name": unique_filename,
                    "parents": [self.folder_id]
                }
                media = MediaIoBaseUpload(io.BytesIO(file_bytes), mimetype=mime_type, resumable=False)
                
                # Upload the file
                file = self.drive_service.files().create(
                    body=file_metadata, media_body=media, fields="id, webViewLink"
                ).execute()
                
                file_id = file.get("id")
                
                # Make it readable by anyone with the link (since it's a shared folder, we need this for preview)
                self.drive_service.permissions().create(
                    fileId=file_id,
                    body={"type": "anyone", "role": "reader"},
                    fields="id"
                ).execute()

                return file_id, file.get("webViewLink")
            except Exception as e:
                logger.error(f"Google Drive upload failed: {e}")
                raise e

        else:
            # Supabase
            admin = get_supabase_admin()
            storage_path = f"{task_id}/{unique_filename}"
            admin.storage.from_("task-files").upload(
                path=storage_path,
                file=file_bytes,
                file_options={"content-type": mime_type}
            )
            return storage_path, None

    def get_file_url(self, storage_identifier: str) -> str:
        """
        Retrieves a viewable/downloadable URL for the file.
        For Google Drive, we just query the file's webViewLink or webContentLink.
        For Supabase, we generate a signed URL.
        """
        if self.backend == "gdrive":
            try:
                file = self.drive_service.files().get(fileId=storage_identifier, fields="webContentLink").execute()
                # webContentLink forces download, webViewLink previews. Let's return webContentLink as it's closer to the raw file URL.
                return file.get("webContentLink") or ""
            except Exception as e:
                logger.error(f"Google Drive get URL failed: {e}")
                return ""
        else:
            admin = get_supabase_admin()
            try:
                response = admin.storage.from_("task-files").create_signed_url(
                    storage_identifier, 3600, {"download": True}
                )
                return response.get("signedURL") or response.get("signed_url") or ""
            except Exception as e:
                logger.error(f"Supabase get URL failed: {e}")
                return ""

    def delete_file(self, storage_identifier: str):
        if self.backend == "gdrive":
            try:
                self.drive_service.files().delete(fileId=storage_identifier).execute()
            except Exception as e:
                logger.error(f"Google Drive delete failed: {e}")
        else:
            admin = get_supabase_admin()
            try:
                admin.storage.from_("task-files").remove([storage_identifier])
            except Exception as e:
                logger.error(f"Supabase delete failed: {e}")

# Singleton instance
storage_service = StorageService()
