"""Raw product capture + trace.json (the Clep recorder contract, minimal).

Drives a live page with Playwright, records video, and logs every focus /
click as {t, x, y, label, click} in clip seconds + viewport fractions. The
clip_showcase scene turns that trace into camera moves and callouts.

Steps (JSON list):
  {"do": "wait", "s": 1.0}
  {"do": "click", "selector": "...", "label": "Copy the install command"}
  {"do": "hover", "selector": "...", "label": "..."}
  {"do": "type", "selector": "...", "text": "...", "label": "..."}
  {"do": "scroll", "selector": "..."}          # smooth-scroll element into the middle
  {"do": "focus", "selector": "...", "label": "..."}   # camera beat, no interaction
"""
from __future__ import annotations

import json
import shutil
import subprocess
import time
from pathlib import Path
from typing import List

CURSOR_JS = """
(() => {
  if (window.__motionCursor) return;
  const c = document.createElement('div');
  c.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24"><path d="M4 2 L4 19 L8.6 14.8 L11.6 21.4 L14.4 20.2 L11.4 13.7 L17.6 13.4 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  Object.assign(c.style, {position:'fixed', left:'0px', top:'0px', zIndex: 2147483647, pointerEvents:'none',
    transform:'translate(-3px,-2px)', filter:'drop-shadow(0 3px 6px rgba(0,0,0,.3))', transition:'scale .08s'});
  document.documentElement.appendChild(c);
  window.__motionCursor = c;
  addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', () => c.style.scale = '0.85', true);
  addEventListener('mouseup', () => c.style.scale = '1', true);
})();
"""


def record(url: str, steps: List[dict], out_dir: Path, name: str = "capture",
           viewport=(1920, 1080)) -> dict:
    from playwright.sync_api import sync_playwright

    out_dir.mkdir(parents=True, exist_ok=True)
    tmp = out_dir / "_rec"
    focuses = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport={"width": viewport[0], "height": viewport[1]},
                                  record_video_dir=str(tmp), record_video_size={"width": viewport[0], "height": viewport[1]})
        ctx.add_init_script(CURSOR_JS)
        page = ctx.new_page()
        t_page = time.monotonic()
        _load(page, url)
        page.evaluate(CURSOR_JS)
        page.mouse.move(viewport[0] * 0.62, viewport[1] * 0.78)
        page.wait_for_timeout(900)
        t0 = time.monotonic() - t_page  # clip starts once the page is settled
        mx, my = viewport[0] * 0.62, viewport[1] * 0.78

        def center(sel):
            box = page.locator(sel).first.bounding_box()
            return box["x"] + box["width"] / 2, box["y"] + box["height"] / 2

        def glide(x, y, dur=0.6):
            nonlocal mx, my
            n = max(8, int(dur * 60))
            for i in range(1, n + 1):
                k = i / n
                e = 1 - (1 - k) ** 3
                page.mouse.move(mx + (x - mx) * e, my + (y - my) * e)
                page.wait_for_timeout(dur * 1000 / n)
            mx, my = x, y

        def log(x, y, label=None, click=False):
            focuses.append({"t": round(time.monotonic() - t_page - t0, 2), "x": round(x / viewport[0], 4),
                            "y": round(y / viewport[1], 4), **({"label": label} if label else {}), "click": click})

        for st in steps:
            d = st["do"]
            if d == "_mark":
                page.evaluate(AUTO_MARK_JS)
                continue
            if d == "wait":
                page.wait_for_timeout(st.get("s", 1) * 1000)
            elif d == "scroll":
                page.evaluate("""s => document.querySelector(s).scrollIntoView({behavior:'smooth', block:'center'})""", st["selector"])
                page.wait_for_timeout(st.get("s", 1.2) * 1000)
            elif d in ("click", "hover", "focus", "type"):
                x, y = center(st["selector"])
                if d != "focus":
                    glide(x, y, st.get("move", 0.7))
                log(x, y, st.get("label") or None, click=d == "click")
                if d == "click":
                    page.mouse.down()
                    page.wait_for_timeout(90)
                    page.mouse.up()
                elif d == "type":
                    page.mouse.click(x, y)
                    page.keyboard.type(st["text"], delay=st.get("delay", 55))
                page.wait_for_timeout(st.get("after", 1.0) * 1000)
        page.wait_for_timeout(600)
        total = time.monotonic() - t_page - t0
        video = page.video.path()
        ctx.close()
        browser.close()

    mp4 = out_dir / f"{name}.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{t0:.2f}", "-i", str(video), "-t", f"{total:.2f}",
                    "-c:v", "libx264", "-crf", "14", "-preset", "slow", "-pix_fmt", "yuv420p", "-r", "30", str(mp4)], check=True)
    shutil.rmtree(tmp, ignore_errors=True)
    trace = {"kind": "clep-capture", "url": url, "viewport": {"w": viewport[0], "h": viewport[1]},
             "duration": round(total, 2), "focuses": focuses, "video": mp4.name}
    (out_dir / f"{name}.trace.json").write_text(json.dumps(trace, indent=2))
    print(f"[capture] {mp4} ({total:.1f}s, {len(focuses)} focuses)")
    return trace


AUTO_MARK_JS = r"""
() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
    return r.width > 40 && r.height > 16 && s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity) > 0.3; };
  const tag = (e, k) => { if (e) e.setAttribute('data-motion-step', k); return !!e; };
  const out = {};
  const h1 = Array.from(document.querySelectorAll('h1')).find(vis);
  out.h1 = tag(h1, 'h1') ? h1.innerText.trim().split('\n')[0].slice(0, 40) : null;
  const heroBottom = window.innerHeight * 1.05;
  const cta = Array.from(document.querySelectorAll('main a, main button, header ~ * a, a[class*=btn i], button'))
    .find(e => vis(e) && e.getBoundingClientRect().top < heroBottom && e.getBoundingClientRect().top > 120 && e.innerText.trim().length > 1 && e.innerText.trim().length < 28);
  out.cta = tag(cta, 'cta') ? cta.innerText.trim() : null;
  const heads = Array.from(document.querySelectorAll('main h2, section h2, h2')).filter(vis)
    .filter(e => e.getBoundingClientRect().top + window.scrollY > window.innerHeight * 0.9).slice(0, 2);
  out.sections = heads.map((e, i) => { tag(e, 'h2-' + i); return e.innerText.trim().split('\n')[0].slice(0, 36); });
  return out;
}
"""


def _load(page, url: str) -> None:
    """Sites with analytics beacons / websockets never reach networkidle — load the DOM,
    give the network a short window to settle, then carry on either way."""
    page.goto(url, wait_until="domcontentloaded", timeout=45000)
    try:
        page.wait_for_load_state("networkidle", timeout=10000)
    except Exception:
        pass
    page.wait_for_timeout(600)


def auto_tour(url: str, out_dir: Path, name: str = "tour", viewport=(1920, 1080)) -> dict:
    """Clep Capture lite: record a guided tour of any page — hero headline, primary CTA
    (hover + click-free), then the next two section headings — with a trace."""
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        p = b.new_page(viewport={"width": viewport[0], "height": viewport[1]})
        _load(p, url if url.startswith("http") else "https://" + url)
        p.add_style_tag(content="html,body{scroll-behavior:auto!important}")
        marks = p.evaluate(AUTO_MARK_JS)
        b.close()
    steps: List[dict] = [{"do": "wait", "s": 0.5}]
    if marks.get("h1"):
        steps.append({"do": "focus", "selector": "[data-motion-step=h1]", "label": None, "after": 1.2})
    if marks.get("cta"):
        steps.append({"do": "hover", "selector": "[data-motion-step=cta]", "label": marks["cta"], "after": 1.3})
    for i, title in enumerate(marks.get("sections") or []):
        steps.append({"do": "scroll", "selector": f"[data-motion-step=h2-{i}]", "s": 1.2})
        steps.append({"do": "focus", "selector": f"[data-motion-step=h2-{i}]", "label": title, "after": 1.5})
    # The marks were set on a throwaway page; re-mark on the recording page before each step.
    return record(url, [{"do": "_mark"}] + steps, out_dir, name, viewport)
