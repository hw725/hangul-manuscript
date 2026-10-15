// 사람 확인(C-006)용 표본 HWPX를 만든다: test-vault/시험 원고.md → tests/out/*.hwpx
// 실행: npx esbuild scripts/make-sample.ts --bundle --platform=node --format=esm --outfile=tests/out/make-sample.mjs && node tests/out/make-sample.mjs
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { markdownToHwpx } from "../src/core/hwpx";

const vault = "test-vault";
const md = readFileSync(join(vault, "시험 원고.md"), "utf8");
const template = readFileSync("assets/template-default.hwpx");
const readImage = (src: string, wiki: boolean) => {
	const p = wiki ? join(vault, "그림", src) : join(vault, decodeURI(src));
	return Promise.resolve(existsSync(p) ? new Uint8Array(readFileSync(p)) : undefined);
};

mkdirSync("tests/out", { recursive: true });
const variants = {
	"시험 원고-각주": { noteType: "footnote", quoteBlankLines: true },
	"시험 원고-미주-반각": { noteType: "endnote", quoteBlankLines: true, halfwidthBrackets: true },
} as const;
for (const [name, opt] of Object.entries(variants)) {
	const bytes = await markdownToHwpx(md, template, { ...opt, readImage });
	writeFileSync(join("tests/out", `${name}.hwpx`), bytes);
	console.log(`${name}.hwpx ${bytes.length} bytes`);
}
