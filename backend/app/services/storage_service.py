import os
import hmac
import hashlib
import time
import uuid
import mimetypes
from abc import ABC, abstractmethod
from typing import Optional, Tuple, BinaryIO, Dict, Any
from fastapi import HTTPException
from fastapi.responses import FileResponse
from app.utils.auth import SECRET_KEY

# Base private storage directory for attachments (completely isolated from public static mounts)
STORAGE_BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "storage", "attachments"))
ATTACHMENTS_DIR = STORAGE_BASE_DIR
os.makedirs(ATTACHMENTS_DIR, exist_ok=True)

# Allowed file extensions and corresponding canonical MIME types
ALLOWED_EXTENSIONS: Dict[str, str] = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
}

# Maximum file sizes
MAX_IMAGE_DOC_SIZE = 50 * 1024 * 1024   # 50 MB
MAX_VIDEO_SIZE = 100 * 1024 * 1024      # 100 MB

# Dangerous signatures / malware heuristics (executables, shell scripts, php, etc.)
DISALLOWED_MAGIC_SIGNATURES = [
    (b"\x4d\x5a", "DOS/Windows PE Executable"),
    (b"\x7fELF", "Linux ELF Executable"),
    (b"\xca\xfe\xba\xbe", "Java Bytecode / Mach-O Universal Binary"),
    (b"#!", "Shell script payload"),
    (b"<?php", "PHP script payload"),
    (b"<script", "HTML/JS executable payload"),
]

def generate_signed_token(key: str, expires: int) -> str:
    """Generate an HMAC-SHA256 signature for short-lived private access."""
    msg = f"{key}:{expires}".encode("utf-8")
    return hmac.new(SECRET_KEY.encode("utf-8"), msg, hashlib.sha256).hexdigest()

def verify_signed_token(key: str, expires: int, signature: str) -> bool:
    """Verify an HMAC-SHA256 signature and expiration."""
    if time.time() > expires:
        return False
    expected = generate_signed_token(key, expires)
    return hmac.compare_digest(expected, signature)

def validate_attachment_file(filename: str, content_type: Optional[str], file_bytes: bytes) -> Tuple[str, str, int, str]:
    """
    Validate extension, file size, MIME type, and binary magic bytes.
    Calculates and returns (extension, canonical_mime, file_size, sha256_hash).
    """
    if not filename:
        raise HTTPException(status_code=400, detail="Filename is required.")

    _, ext = os.path.splitext(filename.lower())
    if ext not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS.keys()))
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported Media Type: '{ext}' is not permitted. Supported formats: {allowed}"
        )

    file_size = len(file_bytes)
    if file_size == 0:
        raise HTTPException(status_code=400, detail="Cannot upload an empty file.")

    max_limit = MAX_VIDEO_SIZE if ext in [".mp4", ".mov"] else MAX_IMAGE_DOC_SIZE
    if file_size > max_limit:
        raise HTTPException(
            status_code=413,
            detail=f"File Too Large: Uploaded file size ({file_size / (1024*1024):.1f}MB) exceeds limit of {max_limit / (1024*1024):.0f}MB."
        )

    # Malware / dangerous content heuristic inspection
    for sig, desc in DISALLOWED_MAGIC_SIGNATURES:
        if file_bytes.startswith(sig) or (sig in file_bytes[:1024] and sig in [b"<?php", b"<script"]):
            raise HTTPException(
                status_code=415,
                detail=f"File Rejected: File contains dangerous or executable signature ({desc})."
            )

    # Magic byte header validation
    if ext in [".jpg", ".jpeg"] and not file_bytes.startswith(b"\xff\xd8\xff"):
        raise HTTPException(status_code=415, detail="Unsupported Media Type: Invalid or corrupted JPEG header.")
    elif ext == ".png" and not file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        raise HTTPException(status_code=415, detail="Unsupported Media Type: Invalid or corrupted PNG header.")
    elif ext == ".pdf" and not file_bytes.startswith(b"%PDF-"):
        raise HTTPException(status_code=415, detail="Unsupported Media Type: Invalid or corrupted PDF header.")
    elif ext == ".webp" and not (file_bytes.startswith(b"RIFF") and file_bytes[8:12] == b"WEBP"):
        raise HTTPException(status_code=415, detail="Unsupported Media Type: Invalid or corrupted WebP header.")
    elif ext in [".mp4", ".mov"] and (b"ftyp" not in file_bytes[:64] and b"moov" not in file_bytes[:64]):
        raise HTTPException(status_code=415, detail="Unsupported Media Type: Invalid or corrupted MP4/MOV header.")

    canonical_mime = ALLOWED_EXTENSIONS[ext]
    sha256_hash = hashlib.sha256(file_bytes).hexdigest()

    return ext, canonical_mime, file_size, sha256_hash


class ObjectStorageBackend(ABC):
    """Abstract S3-compatible Object Storage Service."""

    @abstractmethod
    def put_object(self, key: str, data: bytes, content_type: str) -> Dict[str, Any]:
        pass

    @abstractmethod
    def delete_object(self, key: str) -> bool:
        pass

    @abstractmethod
    def object_exists(self, key: str) -> bool:
        pass

    @abstractmethod
    def get_local_path(self, key: str) -> Optional[str]:
        pass

    @abstractmethod
    def generate_signed_download_url(self, key: str, case_id: int, attachment_id: int, expires_in: int = 900) -> str:
        pass


class LocalPrivateStorageBackend(ObjectStorageBackend):
    """
    S3-compatible local private object storage backend.
    Objects are stored in a private directory hierarchy and are NEVER exposed as public static files.
    All access requires authenticated requests or short-lived HMAC signed URLs.
    """

    def __init__(self, base_dir: str = ATTACHMENTS_DIR):
        self.base_dir = base_dir
        os.makedirs(self.base_dir, exist_ok=True)

    def _resolve_key_path(self, key: str) -> str:
        sanitized_key = key.lstrip("/").replace("..", "_")
        return os.path.abspath(os.path.join(self.base_dir, sanitized_key))

    def put_object(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> Dict[str, Any]:
        dest_path = self._resolve_key_path(key)
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        with open(dest_path, "wb") as f:
            f.write(data)
        return {
            "key": key,
            "path": dest_path,
            "size": len(data),
            "content_type": content_type
        }

    def delete_object(self, key: str) -> bool:
        dest_path = self._resolve_key_path(key)
        if os.path.exists(dest_path) and os.path.isfile(dest_path):
            try:
                os.remove(dest_path)
                return True
            except OSError:
                return False
        return False

    def object_exists(self, key: str) -> bool:
        dest_path = self._resolve_key_path(key)
        return os.path.exists(dest_path) and os.path.isfile(dest_path)

    def get_local_path(self, key: str) -> Optional[str]:
        dest_path = self._resolve_key_path(key)
        if os.path.exists(dest_path):
            return dest_path
        # Fallback check if key was stored as an absolute path
        if os.path.isabs(key) and os.path.exists(key):
            return key
        return None

    def generate_signed_download_url(self, key: str, case_id: int, attachment_id: int, expires_in: int = 900) -> str:
        expires_at = int(time.time()) + expires_in
        sig = generate_signed_token(key, expires_at)
        return f"/api/v1/cases/{case_id}/attachments/{attachment_id}/download?expires={expires_at}&signature={sig}"


# Singleton instance of the storage service
storage_service = LocalPrivateStorageBackend()
