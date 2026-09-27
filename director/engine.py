"""Python ↔ engine bridge. Every render-side operation shells into engine/
(Node), so the TypeScript registry stays the single source of truth."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import List, Optional, Tuple

from .paths import ENGINE, REGISTRY_JSON, Project


def _npx(args: List[str], capture: bool = False, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(["npx", *args], cwd=ENGINE, capture_output=capture, text=True, check=check)


def ensure_installed() -> None:
    if not (ENGINE / "node_modules").exists():
        print("[engine] installing node deps (first run)…")
        subprocess.run(["npm", "install"], cwd=ENGINE, check=True)


def registry() -> dict:
    ensure_installed()
    if not REGISTRY_JSON.exists():
        export_registry()
    return json.loads(REGISTRY_JSON.read_text())


def export_registry() -> None:
    _npx(["tsx", "scripts/export-registry.mts"])


def validate(spec: dict, tmp_dir: Path) -> Tuple[bool, dict]:
    """Returns (ok, result). result has errors[] or spec (normalized) + warnings + timeline."""
    tmp_dir.mkdir(parents=True, exist_ok=True)
    f = tmp_dir / "_validate.json"
    f.write_text(json.dumps(spec))
    r = _npx(["tsx", "scripts/validate.mts", str(f), "--json"], capture=True, check=False)
    out = (r.stdout or "").strip().splitlines()
    try:
        res = json.loads(out[-1])
    except Exception:
        res = {"ok": False, "errors": [f"validator crashed: {(r.stderr or r.stdout)[-800:]}"]}
    f.unlink(missing_ok=True)
    return bool(res.get("ok")), res


def sync_brand(project: Project, spec_file: Path) -> None:
    """Refresh a spec's embedded brand from brand.json (re-extracted logo/fonts/screens),
    keeping any color corrections the director made at storyboard time."""
    if not project.brand_path.exists() or not spec_file.exists():
        return
    spec = json.loads(spec_file.read_text())
    fresh = json.loads(project.brand_path.read_text())["brand"]
    old = spec.get("brand") or {}
    merged = {**fresh, "colors": {**fresh.get("colors", {}), **(old.get("colors") or {})}}
    if spec.get("template"):
        # Template controls own the font pairing — don't let the site's fonts override it.
        for k in ("fonts", "accentItalic"):
            if k in old:
                merged[k] = old[k]
    if merged != old:
        spec["brand"] = merged
        spec_file.write_text(json.dumps(spec, indent=2))


def _bundle_sig(project: Project) -> str:
    """Changes when the engine source or any project asset changes."""
    h = []
    for root in (project.assets, ENGINE / "src"):
        for p in sorted(root.rglob("*")):
            if p.is_file():
                st = p.stat()
                h.append(f"{p}:{st.st_size}:{int(st.st_mtime)}")
    import hashlib
    return hashlib.sha1("\n".join(h).encode()).hexdigest()


# Built once into the container image (Dockerfile) with an empty public dir. A job then only
# copies the project's assets into <bundle>/public — seconds saved on every preview and render.
PREBUNDLE = Path(os.environ["MOTION_PREBUNDLE"]) if os.environ.get("MOTION_PREBUNDLE") else None


def bundle(project: Project, force: bool = False) -> Path:
    """Bundle the engine with the project's assets as the public dir. Cached until assets/engine change."""
    ensure_installed()
    out = project.dir / ".bundle"
    sig = _bundle_sig(project)
    stamp = out / ".sig"
    if not force and stamp.exists() and stamp.read_text() == sig:
        return out
    if PREBUNDLE and (PREBUNDLE / "index.html").exists():
        shutil.rmtree(out, ignore_errors=True)
        shutil.copytree(PREBUNDLE, out, ignore=shutil.ignore_patterns("public"))
        shutil.copytree(project.assets, out / "public", dirs_exist_ok=True)
    else:
        _npx(["remotion", "bundle", "--public-dir", str(project.assets), "--out-dir", str(out), "--log=error"])
    stamp.write_text(sig)
    return out


def stills(project: Project, spec_file: Path, at: float = 0.65, scale: float = 0.5,
           scenes: Optional[List[int]] = None, serve: Optional[Path] = None) -> Path:
    sync_brand(project, spec_file)
    serve = serve or bundle(project)
    out = project.dir / "stills" / spec_file.stem
    if out.exists() and scenes is None:
        shutil.rmtree(out)
    args = ["tsx", "scripts/stills.mts", "--serve", str(serve), "--props", str(spec_file), "--out", str(out),
            "--at", str(at), "--scale", str(scale)]
    if scenes:
        args += ["--scenes", ",".join(map(str, scenes))]
    _npx(args)
    contact_sheet(out)
    return out


def contact_sheet(stills_dir: Path, cols: int = 4) -> Path:
    """Numbered storyboard sheet: every scene still with its index + type."""
    from PIL import Image, ImageDraw, ImageFont
    manifest = json.loads((stills_dir / "stills.json").read_text())
    ims = [(m, Image.open(m["path"]).convert("RGB")) for m in sorted(manifest, key=lambda m: m["index"])]
    if not ims:
        raise RuntimeError("no stills rendered")
    tw = 640
    th = int(ims[0][1].height * tw / ims[0][1].width)
    label_h = 34
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw + (cols + 1) * 12, rows * (th + label_h) + (rows + 1) * 12), "#1b1b1d")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 20)
    except Exception:
        font = ImageFont.load_default()
    for k, (m, im) in enumerate(ims):
        x = 12 + (k % cols) * (tw + 12)
        y = 12 + (k // cols) * (th + label_h + 12)
        sheet.paste(im.resize((tw, th)), (x, y + label_h))
        draw.text((x + 2, y + 6), f"{m['index']:02d}  {m['type']}", fill="#e8e8ea", font=font)
    out = stills_dir / "storyboard.jpg"
    sheet.save(out, quality=88)
    return out


def render(project: Project, spec_file: Path, out: Optional[Path] = None, scale: float = 1.0,
           concurrency: Optional[int] = None) -> Path:
    ensure_installed()
    sync_brand(project, spec_file)
    out = out or (project.dir / "renders" / f"{spec_file.stem}.mp4")
    out.parent.mkdir(parents=True, exist_ok=True)
    # Render from the (cached / prebuilt) bundle instead of re-bundling inside `remotion render`.
    serve = bundle(project)
    args = ["remotion", "render", str(serve), "Spec", str(out), f"--props={spec_file}",
            "--codec=h264", "--crf=18", "--pixel-format=yuv420p", f"--scale={scale}",
            f"--concurrency={concurrency or os.cpu_count() or 2}"]
    _npx(args)
    return out
