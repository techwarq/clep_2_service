/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import path from "path";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

// __dirname is unreliable when Remotion loads this file, but the CLI always
// runs from the engine root (director/render.py sets cwd), so cwd is stable.
const SRC_DIR = path.join(process.cwd(), "src");

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setEntryPoint("src/index.ts");
// enableTailwind() must run first — it replaces `resolve` wholesale, so our
// "@" alias has to be merged in afterward or it gets dropped.
Config.overrideBundlerConfig((c) => {
  const withTailwind = enableTailwind(c);
  return {
    ...withTailwind,
    resolve: {
      ...withTailwind.resolve,
      alias: {
        ...(withTailwind.resolve && "alias" in withTailwind.resolve ? withTailwind.resolve.alias : {}),
        "@": SRC_DIR,
      },
    },
  };
});
