import { continueRender, delayRender, staticFile } from "remotion";
import { loadFont as loadLocalFont } from "@remotion/fonts";
import { getAvailableFonts } from "@remotion/google-fonts";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadJetBrains } from "@remotion/google-fonts/JetBrainsMono";
import type { BrandT } from "./spec";

// Always-available fallbacks.
loadInter("normal", { weights: ["400", "500", "600", "700", "800", "900"], subsets: ["latin"] });
loadJetBrains("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });

const loaded = new Set<string>();

/**
 * Load the brand's fonts before the first frame renders: local files from the
 * project's assets (extracted from the site by director/brand.py) or Google
 * Fonts by family name. Blocks rendering via delayRender until ready.
 */
export function loadBrandFonts(brand: BrandT) {
  const refs = [brand.fonts?.display, brand.fonts?.body, brand.fonts?.mono, brand.fonts?.accent, brand.wordmark?.font].filter(Boolean) as NonNullable<
    BrandT["fonts"]["display"]
  >[];
  const jobs: Promise<unknown>[] = [];
  for (const f of refs) {
    const key = `${f.family}|${f.src ?? ""}`;
    if (loaded.has(key)) continue;
    loaded.add(key);
    if (f.src) {
      jobs.push(
        loadLocalFont({
          family: f.family,
          url: /^https?:/.test(f.src) ? f.src : staticFile(f.src),
          weight: f.weight ? String(f.weight) : undefined,
          style: f.italic ? "italic" : undefined,
        }).catch((e) => console.warn(`[fonts] failed ${f.src}`, e)),
      );
      continue;
    }
    const g = getAvailableFonts().find((x) => x.fontFamily.toLowerCase() === f.family.toLowerCase());
    if (g) {
      jobs.push(
        g
          .load()
          .then((m) => m.loadFont(f.italic ? "italic" : "normal", { subsets: ["latin"] }).waitUntilDone())
          .catch((e) => console.warn(`[fonts] google font ${f.family} failed`, e)),
      );
    }
  }
  if (jobs.length === 0) return;
  const handle = delayRender(`Loading brand fonts`, { timeoutInMilliseconds: 60000 });
  Promise.all(jobs).finally(() => continueRender(handle));
}
