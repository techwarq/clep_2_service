"""R2 (S3 API) storage — the service is stateless, projects live in the bucket.

    motion/projects/<project>/brand.json, assets/...   brand kit, screenshots, logo, uploads, clips
    motion/previews/<project>/<id>/...                   storyboard stills
    outputs/<file>.mp4                                    finished videos (served by the Worker at /v1/outputs/:file)

Without R2_* env vars (local dev) every call is a no-op and projects stay on local disk.
"""
from __future__ import annotations

import mimetypes
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Iterable, List, Optional

from .paths import Project

BUCKET = os.environ.get("R2_BUCKET", "clep-outputs")
SKIP_DIRS = {".bundle", ".tmp", "renders", "stills", "specs"}
_client = None


def enabled() -> bool:
    return all(os.environ.get(k) for k in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"))


def client():
    global _client
    if _client is None:
        import boto3
        from botocore.config import Config
        _client = boto3.client(
            "s3", endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
            aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"], aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
            region_name="auto", config=Config(max_pool_connections=32, retries={"max_attempts": 4, "mode": "standard"}))
    return _client


def project_prefix(name: str) -> str:
    return f"motion/projects/{name}/"


def put_file(path: Path, key: str) -> str:
    if enabled():
        ctype = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        client().upload_file(str(path), BUCKET, key, ExtraArgs={"ContentType": ctype})
    return key


def _keys(prefix: str) -> List[dict]:
    out, token = [], None
    while True:
        kw = {"Bucket": BUCKET, "Prefix": prefix, **({"ContinuationToken": token} if token else {})}
        r = client().list_objects_v2(**kw)
        out += r.get("Contents", [])
        if not r.get("IsTruncated"):
            return out
        token = r["NextContinuationToken"]


def pull_project(name: str) -> Project:
    """Download the project (brand.json + assets) into local disk. Skips files already present."""
    pr = Project(name).ensure()
    if not enabled():
        return pr
    prefix = project_prefix(name)

    def get(obj):
        dest = pr.dir / obj["Key"][len(prefix):]
        if dest.exists() and dest.stat().st_size == obj["Size"]:
            return
        dest.parent.mkdir(parents=True, exist_ok=True)
        client().download_file(BUCKET, obj["Key"], str(dest))

    objs = _keys(prefix)
    if not objs:
        raise ValueError(f"project '{name}' has no brand kit yet — extract the brand first")
    with ThreadPoolExecutor(16) as ex:
        list(ex.map(get, objs))
    return pr


def push_project(pr: Project, only: Optional[Iterable[Path]] = None) -> int:
    """Upload brand.json + assets (or just `only`). Returns the number of files sent."""
    if not enabled():
        return 0
    files = list(only) if only is not None else [
        p for p in pr.dir.rglob("*") if p.is_file() and not (set(p.relative_to(pr.dir).parts) & SKIP_DIRS)
        and p.name != ".DS_Store"]
    prefix = project_prefix(pr.name)
    with ThreadPoolExecutor(16) as ex:
        list(ex.map(lambda p: put_file(p, prefix + str(p.relative_to(pr.dir))), files))
    return len(files)
