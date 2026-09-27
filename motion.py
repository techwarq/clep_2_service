#!/usr/bin/env python3
"""
motion — script + website + assets → production-grade motion graphics.

The workflow (each step is one command, each writes files you can edit by hand):

  1. new      create a project: pull the brand kit from the website, save script + reference
  2. board    N storyboard variants (VideoSpecs) in a named reference style, real screenshots
  3. stills   one frame per scene → storyboard.jpg (fix here, it's seconds, not minutes)
  4. note     director notes → revised spec ("slow every zoom to 0.7x", "hard cut after scene 2")
  5. render   final mp4 (Remotion + GSAP, frame-exact)

  python motion.py new acme --url https://acme.com --script script.txt --ref "Linear launch video"
  python motion.py board acme --variants 3 --seconds 30
  python motion.py stills acme v2-product-proof
  python motion.py note acme v2-product-proof "hard cut into scene 3, push in on the Sign up button"
  python motion.py render acme v2-product-proof.n1
  python motion.py go acme --url https://acme.com --script script.txt      # all of it, picks v1

Other: studio (live preview/editor), specs (list), gallery (render every kit scene), registry (re-export).
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from director import engine  # noqa: E402
from director.paths import ENGINE, Project  # noqa: E402


def _read_text_arg(v: str | None) -> str:
    if not v:
        return ""
    p = Path(v)
    return p.read_text() if p.exists() else v


def cmd_new(a):
    from director import brand
    pr = Project(a.name).ensure()
    if a.script:
        (pr.dir / "script.txt").write_text(_read_text_arg(a.script))
    if a.ref:
        (pr.dir / "reference.txt").write_text(_read_text_arg(a.ref))
    for f in a.assets or []:
        src = Path(f)
        shutil.copy2(src, pr.assets / "user" / src.name)
        print(f"[new] asset → user/{src.name}")
    if a.url:
        brand.extract(a.url, pr)
    elif not pr.brand_path.exists():
        print("[new] no --url: write brand.json by hand (see examples/brand.example.json) or run `brand` later")
    print(f"[new] project ready: {pr.dir}")


def cmd_brand(a):
    from director import brand
    brand.extract(a.url, Project(a.name).ensure())


def cmd_board(a):
    from director import storyboard
    pr = Project(a.name)
    paths = storyboard.board(pr, variants=a.variants, target=a.seconds, portrait=a.portrait,
                             reference=_read_text_arg(a.ref) if a.ref else None,
                             script=_read_text_arg(a.script) if a.script else None)
    if not a.no_stills:
        serve = engine.bundle(pr)
        for p in paths:
            d = engine.stills(pr, p, serve=serve)
            print(f"[board] storyboard → {d / 'storyboard.jpg'}")
    print("\nPick one, then: python motion.py stills|note|render", a.name, "<variant>")
    for p in paths:
        print("  ", p.stem)


def cmd_stills(a):
    pr = Project(a.name)
    d = engine.stills(pr, pr.spec_path(a.spec), at=a.at, scale=a.scale)
    print(f"[stills] {d / 'storyboard.jpg'}")


def cmd_note(a):
    from director import notes
    pr = Project(a.name)
    path, changed = notes.revise(pr, pr.spec_path(a.spec), " ".join(a.notes))
    print(f"[note] revised → {path.stem}  (changed scenes: {changed})")
    if not a.no_stills:
        d = engine.stills(pr, path)
        print(f"[note] storyboard → {d / 'storyboard.jpg'}")


def cmd_render(a):
    pr = Project(a.name)
    spec = pr.spec_path(a.spec)
    out = engine.render(pr, spec, out=Path(a.out) if a.out else None, scale=0.5 if a.draft else 1.0,
                        concurrency=a.concurrency)
    print(f"[render] {out}")


def cmd_go(a):
    cmd_new(a)
    from director import storyboard
    pr = Project(a.name)
    paths = storyboard.board(pr, variants=a.variants, target=a.seconds, portrait=a.portrait)
    serve = engine.bundle(pr)
    for p in paths:
        engine.stills(pr, p, serve=serve)
    pick = paths[min(a.pick, len(paths)) - 1]
    print(f"[go] rendering {pick.stem}")
    print(f"[render] {engine.render(pr, pick)}")


def cmd_studio(a):
    pr = Project(a.name)
    args = ["npx", "remotion", "studio", f"--public-dir={pr.assets}"]
    if a.spec:
        args.append(f"--props={pr.spec_path(a.spec)}")
    subprocess.run(args, cwd=ENGINE)


def cmd_specs(a):
    pr = Project(a.name)
    for p in sorted(pr.specs.glob("*.json")):
        s = json.loads(p.read_text())
        dur = sum(sc["duration"] for sc in s["scenes"])
        print(f"{p.stem:40s} {s.get('style', ''):16s} {len(s['scenes']):2d} scenes ~{dur:.0f}s  {s.get('concept') or ''}")


def cmd_logos(a):
    from director import app_logos
    rows = app_logos.catalog(a.query or "")
    for r in rows[: a.limit]:
        print(f"{r['title']:<32} {r['source']:<13} {r.get('category') or r.get('hex') or ''}")
    print(f"\n{len(rows)} logo(s){' matching ' + repr(a.query) if a.query else ''} "
          f"(svgl: full color · simple-icons: one-color glyph · direct/site: fetched icon)")


def cmd_gallery(a):
    """Render one still per kit scene (engine smoke test / component catalog)."""
    engine.export_registry()
    out = ENGINE / "out" / "gallery"
    serve = ENGINE / "out" / "bundle"
    subprocess.run(["npx", "remotion", "bundle", "--out-dir", str(serve), "--log=error"], cwd=ENGINE, check=True)
    subprocess.run(["npx", "tsx", "scripts/stills.mts", "--serve", str(serve), "--props", "examples/gallery.spec.json",
                    "--out", str(out)], cwd=ENGINE, check=True)
    print(f"[gallery] {engine.contact_sheet(out)}")


def cmd_templates(a):
    from director import templates as T
    for t in T.list_templates():
        d = t["defaults"]
        print(f"{t['id']:14s} {t['name']:14s} {t['tagline']}")
        print(f"{'':14s} best for: {t['bestFor']}")
        print(f"{'':14s} defaults: style={d['style']} fonts={d['fontPairing']} backdrop={d['backdrop']} pace={d['pace']}")
        print(f"{'':14s} slots: {', '.join(t['slots'])}\n")
    c = T.CONTROLS
    print("controls:")
    for k in ("fontPairings", "backdrops", "pace", "transitions", "camera", "formats"):
        print(f"  {k}: {', '.join(c[k])}")
    print(f"  textAnims: {', '.join(c['textAnims'])}")


def cmd_template(a):
    from director import templates as T
    pr = Project(a.name)
    values = json.loads(Path(a.values).read_text()) if a.values else {}
    for kv in a.set or []:
        k, _, v = kv.partition("=")
        values[k] = json.loads(v) if v[:1] in "[{" else v
    controls = json.loads(Path(a.controls).read_text()) if a.controls else {}
    for kv in a.control or []:
        k, _, v = kv.partition("=")
        controls[k] = v
    path = T.instantiate(pr, a.template, values, controls, name=a.out)
    print(f"[template] {path}")
    if not a.no_stills:
        d = engine.stills(pr, path)
        print(f"[template] storyboard → {d / 'storyboard.jpg'}")


def cmd_examples(a):
    """Render every template's example → templates/<id>/example.mp4 + poster.jpg + storyboard.jpg."""
    from director import templates as T
    from director.paths import ROOT
    ids = a.only or [t["id"] for t in T.list_templates()]
    for tid in ids:
        ex = json.loads((ROOT / "templates" / tid / "example.json").read_text())
        pr = T.example_project(tid)
        path = T.instantiate(pr, tid, ex["values"], ex.get("controls"), name="example")
        d = engine.stills(pr, path)
        shutil.copy2(d / "storyboard.jpg", ROOT / "templates" / tid / "storyboard.jpg")
        if a.render:
            out = engine.render(pr, path, out=ROOT / "templates" / tid / "example.mp4")
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(a.poster_at), "-i", str(out),
                            "-frames:v", "1", "-q:v", "3", str(ROOT / "templates" / tid / "poster.jpg")], check=True)
            print(f"[examples] {tid}: {out}")
        else:
            print(f"[examples] {tid}: {ROOT / 'templates' / tid / 'storyboard.jpg'}")


def cmd_serve(a):
    from director.server import serve
    serve(a.port)


def cmd_service(a):
    from director.service import serve
    serve(a.port)


def cmd_job(a):
    from director.job import main as run_job
    sys.exit(run_job(a.id))


def cmd_publish_examples(a):
    """Upload templates/*/example.mp4 + poster.jpg to R2 so the dashboard gallery can play them."""
    from director import store
    from director.paths import ROOT
    if not store.enabled():
        sys.exit("set R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY first")
    for d in sorted((ROOT / "templates").iterdir()):
        for f in ("example.mp4", "poster.jpg"):
            if (d / f).exists():
                store.put_file(d / f, f"motion/templates/{d.name}/{f}")
                print(f"[examples] {d.name}/{f}")


def cmd_film(a):
    from director import film
    film.run(a.video, a.step)


def cmd_voices(a):
    from director import voices
    if a.publish or a.push:
        print(f"[voices] {len(voices.publish_previews(push=a.push))} previews in {voices.PREVIEWS}")
    for v in voices.catalog(local=True):
        print(f"  {v['id']:<8} {v['gender']:<7} {v['accent']:<13} {v['description']}")


def cmd_registry(a):
    engine.export_registry()
    print(f"[registry] {ENGINE / 'registry.json'}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    def board_opts(p):
        p.add_argument("--variants", type=int, default=3)
        p.add_argument("--seconds", type=float, default=30)
        p.add_argument("--portrait", action="store_true", help="1080x1920 instead of 1920x1080")

    p = sub.add_parser("new", help="create project + extract brand from website")
    p.add_argument("name"); p.add_argument("--url"); p.add_argument("--script", help="file or text")
    p.add_argument("--ref", help="reference style/video notes (file or text)")
    p.add_argument("--assets", nargs="*", help="logo/screenshots/footage/music/voiceover.mp3 to include")
    p.set_defaults(fn=cmd_new)

    p = sub.add_parser("brand", help="(re)extract brand kit from a URL"); p.add_argument("name"); p.add_argument("--url", required=True)
    p.set_defaults(fn=cmd_brand)

    p = sub.add_parser("board", help="generate storyboard variants + stills")
    p.add_argument("name"); board_opts(p); p.add_argument("--ref"); p.add_argument("--script")
    p.add_argument("--no-stills", action="store_true"); p.set_defaults(fn=cmd_board)

    p = sub.add_parser("stills", help="one still per scene → storyboard.jpg")
    p.add_argument("name"); p.add_argument("spec"); p.add_argument("--at", type=float, default=0.65)
    p.add_argument("--scale", type=float, default=0.5); p.set_defaults(fn=cmd_stills)

    p = sub.add_parser("note", help="apply director notes → new spec revision")
    p.add_argument("name"); p.add_argument("spec"); p.add_argument("notes", nargs="+")
    p.add_argument("--no-stills", action="store_true"); p.set_defaults(fn=cmd_note)

    p = sub.add_parser("render", help="render final mp4")
    p.add_argument("name"); p.add_argument("spec"); p.add_argument("--out"); p.add_argument("--draft", action="store_true")
    p.add_argument("--concurrency", type=int); p.set_defaults(fn=cmd_render)

    p = sub.add_parser("go", help="new → board → stills → render variant --pick")
    p.add_argument("name"); p.add_argument("--url"); p.add_argument("--script", required=True); p.add_argument("--ref")
    p.add_argument("--assets", nargs="*"); p.add_argument("--pick", type=int, default=1); board_opts(p)
    p.set_defaults(fn=cmd_go)

    p = sub.add_parser("studio", help="open Remotion Studio on a project/spec"); p.add_argument("name"); p.add_argument("spec", nargs="?")
    p.set_defaults(fn=cmd_studio)
    p = sub.add_parser("specs", help="list a project's specs"); p.add_argument("name"); p.set_defaults(fn=cmd_specs)
    sub.add_parser("gallery", help="render every kit scene (smoke test)").set_defaults(fn=cmd_gallery)
    p = sub.add_parser("logos", help="list the app/social logos videos can show (search with a query)")
    p.add_argument("query", nargs="?"); p.add_argument("--limit", type=int, default=60); p.set_defaults(fn=cmd_logos)
    sub.add_parser("registry", help="re-export engine registry.json").set_defaults(fn=cmd_registry)

    sub.add_parser("templates", help="list templates, slots and controls").set_defaults(fn=cmd_templates)
    p = sub.add_parser("serve", help="run the Motion API for the Clep dashboard"); p.add_argument("--port", type=int, default=8791)
    p.set_defaults(fn=cmd_serve)
    p = sub.add_parser("service", help="internal service for the Worker API (Cloud Run service)")
    p.add_argument("--port", type=int); p.set_defaults(fn=cmd_service)
    sub.add_parser("publish-examples", help="upload template example videos to R2 for the dashboard").set_defaults(fn=cmd_publish_examples)
    p = sub.add_parser("job", help="run one queued job (Cloud Run Job; id from CLEP_JOB_ID)")
    p.add_argument("id", nargs="?"); p.set_defaults(fn=cmd_job)
    p = sub.add_parser("template", help="make a spec from a template: slot values + controls")
    p.add_argument("name"); p.add_argument("template")
    p.add_argument("--values", help="JSON file of slot values"); p.add_argument("--set", nargs="*", help='slot=value (JSON for lists)')
    p.add_argument("--controls", help="JSON file of controls"); p.add_argument("--control", nargs="*", help="fontPairing=editorial backdrop=pastel pace=snappy …")
    p.add_argument("--out", help="spec name"); p.add_argument("--no-stills", action="store_true")
    p.set_defaults(fn=cmd_template)
    p = sub.add_parser("film", help="hand-built film: voice → music → mix → render (engine/src/videos/<video>/timeline.json)")
    p.add_argument("video"); p.add_argument("step", choices=["voice", "music", "mix", "render", "preview", "all"])
    p.set_defaults(fn=cmd_film)
    p = sub.add_parser("voices", help="list narration voices (--publish makes previews, --push uploads them to R2)")
    p.add_argument("--publish", action="store_true"); p.add_argument("--push", action="store_true")
    p.set_defaults(fn=cmd_voices)
    p = sub.add_parser("examples", help="build every template's example (stills, --render for mp4)")
    p.add_argument("--render", action="store_true"); p.add_argument("--only", nargs="*"); p.add_argument("--poster-at", type=float, default=2.0)
    p.set_defaults(fn=cmd_examples)

    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
