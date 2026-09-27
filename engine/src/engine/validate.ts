import { VideoSpec, VideoSpecT } from "./spec";
import { REGISTRY } from "./registry";
import { STYLES } from "./styles";

export type ValidationResult = { ok: true; spec: VideoSpecT; warnings: string[] } | { ok: false; errors: string[] };

/**
 * Full validation: the VideoSpec envelope + every scene's props against its
 * registry schema. Errors are phrased for an LLM to fix in a retry loop.
 */
export function validateSpec(raw: unknown): ValidationResult {
  const env = VideoSpec.safeParse(raw);
  if (!env.success) {
    return { ok: false, errors: env.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
  }
  const spec = env.data;
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!STYLES[spec.style]) warnings.push(`style "${spec.style}" unknown — falling back to clean-saas. Known: ${Object.keys(STYLES).join(", ")}`);

  spec.scenes.forEach((scene, i) => {
    const tag = `scenes[${i}] (${scene.type})`;
    const def = REGISTRY[scene.type];
    if (!def) {
      errors.push(`${tag}: unknown scene type. Use one of: ${Object.keys(REGISTRY).join(", ")}`);
      return;
    }
    const r = def.schema.safeParse(scene.props ?? {});
    if (!r.success) {
      for (const issue of r.error.issues) errors.push(`${tag}.props.${issue.path.join(".")}: ${issue.message}`);
    } else {
      // Normalize props with schema defaults so downstream sees the full shape.
      scene.props = r.data as Record<string, unknown>;
    }
    const [lo, hi] = def.duration;
    if (scene.duration < lo * 0.6 || scene.duration > hi * 1.8) {
      warnings.push(`${tag}: duration ${scene.duration}s is far outside the typical ${lo}-${hi}s`);
    }
  });
  return errors.length ? { ok: false, errors } : { ok: true, spec, warnings };
}
