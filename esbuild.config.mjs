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
	// JSZip 배포판(dist) 대신 원본(lib)을 묶고, script 요소·new Function을 쓰는 의존성 셋을 shims/로 바꾼다
	// (커뮤니티 디렉터리 자동 검토 대응, scripts/check-bundle.mjs).
	alias: {
		jszip: "./node_modules/jszip/lib/index.js",
		setimmediate: "./shims/setimmediate.cjs",
		lie: "./shims/lie.cjs",
		"readable-stream": "./shims/readable-stream.cjs",
	},
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
