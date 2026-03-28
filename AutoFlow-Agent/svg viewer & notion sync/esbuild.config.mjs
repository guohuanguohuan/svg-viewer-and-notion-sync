import esbuild from "esbuild";

const production = process.argv.includes("production");
const watch = process.argv.includes("--watch");

const context = await esbuild.context({
  entryPoints: ["main.ts"],
  bundle: true,
  outfile: "main.js",
  format: "cjs",
  target: "es2018",
  sourcemap: production ? false : "inline",
  minify: production,
  platform: "browser",
  external: ["obsidian", "electron"],
  logLevel: "info"
});

if (watch) {
  await context.watch();
} else {
  await context.rebuild();
  await context.dispose();
}
