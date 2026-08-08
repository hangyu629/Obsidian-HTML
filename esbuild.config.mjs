import builtins from "builtin-modules";
import { build, context } from "esbuild";

const production = process.argv[2] === "production";

const options = {
  banner: { js: "/* HTML Preview for Obsidian */" },
  bundle: true,
  entryPoints: ["src/main.ts"],
  external: ["obsidian", "electron", ...builtins],
  format: "cjs",
  logLevel: "info",
  outfile: "main.js",
  platform: "browser",
  sourcemap: production ? false : "inline",
  target: "es2022",
  treeShaking: true
};

if (production) {
  await build(options);
} else {
  const buildContext = await context(options);
  await buildContext.watch();
}

