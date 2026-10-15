import esbuild from "esbuild";
import { builtinModules } from "node:module";

const prod = process.argv[2] === "production";

const ctx = await esbuild.context({
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: ["obsidian", "electron", "@codemirror/*", "@lezer/*", ...builtinModules],
	format: "cjs",
	target: "es2020",
	loader: { ".hwpx": "binary" },
	logLevel: "warning",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	minify: prod,
	outfile: "main.js",
});

if (prod) {
	await ctx.rebuild();
	await ctx.dispose();
	console.log("build ok");
} else {
	await ctx.watch();
}
