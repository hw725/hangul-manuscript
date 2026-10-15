// 원본 HanMark 0.15.0 순수 함수와 출력이 같은지 대조한다(이식 충실도).
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { insertFootnote, renumberFootnotes } from "../src/core/footnotes";
import { markdownToHwpx } from "../src/core/hwpx";
import { countManuscript, parseParagraphs } from "../src/core/markdown";
import { applyParagraphStyle, convertQuotes, convertWidth, toHalfwidthBrackets } from "../src/core/text";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ref = require("./reference/hanmark-0.15.0-core.cjs") as Record<string, (...a: unknown[]) => unknown>;
const template = readFileSync(new URL("../assets/template-default.hwpx", import.meta.url));

const DOCS: Record<string, string> = {
	plain: "첫 문단입니다.\n\n둘째 문단.",
	notes: "가[^b] 나[^a] 다[^b].\n\n[^a]: 에이\n[^b]: 비\n",
	unordered: "본문[^2] 그리고[^1]\n\n[^1]: 하나\n    이어지는 줄\n\n    빈 줄 뒤 들여쓴 줄\n[^2]: 둘\n",
	interleaved: "갑[^3] 을[^1]\n\n[^1]: 일\n\n중간 본문\n\n[^3]: 삼\n[^9]: 고아 정의\n",
	headings: "# 제목\n\n## 소제목 **굵게**\n\n####### 일곱\n\n본문 *기울임* ***둘다*** 3 * 4 **짝없음",
	quotes: '그는 "안녕"이라 했다. 이른바"용어"라고. don\'t \'single\' "**강조**" “이미” ‘이미’',
	quoteBlocks: "앞 문단\n\n> 인용 1\n> 이어짐\n>\n> 인용 2\n\n> 다른 묶음\n\n뒤 문단\n\n> 끝 인용",
	brackets: "「논문」과 『잡지』 [^1]\n\n[^1]: 주석 안 「낫표」 *기울임* **굵게**",
	images: "![그림](img/a.png)\n\n캡션\n\n![없는](missing.png \"t\")\n\n> ![인용그림](a.png)",
	width: "１９６５年　Ｓｅｄａｉ！ A1! 한자漢字",
	empty: "",
	crlf: "가[^1]\r\n\r\n[^1]: 주\r\n",
	control: "제어\u0001문자 & < > \" 이스케이프",
};

const PNG = (() => {
	const b = new Uint8Array(33);
	b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	const dv = new DataView(b.buffer);
	dv.setUint32(16, 1200);
	dv.setUint32(20, 300);
	return b;
})();

async function unzipText(bytes: Uint8Array) {
	const z = await JSZip.loadAsync(bytes);
	const out: Record<string, string> = {};
	for (const name of Object.keys(z.files).sort()) {
		const f = z.files[name];
		if (!f.dir) out[name] = await f.async("base64");
	}
	return out;
}

describe("원본과 같은 출력", () => {
	for (const [name, doc] of Object.entries(DOCS)) {
		it(`renumber · ${name}`, () => {
			expect(renumberFootnotes(doc)).toEqual(ref.renumber(doc));
		});
		it(`parse · ${name}`, () => {
			expect(parseParagraphs(doc)).toEqual(ref.parse(doc));
		});
		it(`count · ${name}`, () => {
			expect(countManuscript(doc)).toEqual(ref.count(doc));
		});
		it(`quotes · ${name}`, () => {
			for (const double of ["curly", "keep", "straight"] as const) {
				for (const single of ["curly", "keep", "straight"] as const) {
					expect(convertQuotes(doc, { double, single })).toBe(ref.quotes(doc, { double, single }));
				}
			}
		});
		it(`width · ${name}`, () => {
			expect(convertWidth(doc, "toHalf")).toEqual(ref.width(doc, "toHalf"));
			expect(convertWidth(doc, "toFull")).toEqual(ref.width(doc, "toFull"));
			expect(toHalfwidthBrackets(doc)).toBe(ref.halfBrackets(doc));
		});
		it(`insert · ${name}`, () => {
			for (const off of new Set([0, Math.floor(doc.length / 2), doc.length])) {
				expect(insertFootnote(doc, off)).toEqual(ref.insert(doc, off));
			}
		});
		it(`hwpx · ${name}`, async () => {
			const variants = [
				{},
				{ noteType: "endnote", halfwidthBrackets: true, quoteBlankLines: true, doubleQuotes: "straight", singleQuotes: "keep", imageWidthInch: 3 },
			] as const;
			for (const v of variants) {
				const mine = await markdownToHwpx(doc, template, { ...v, readImage: (src) => Promise.resolve(src.includes("missing") ? undefined : PNG) });
				const theirs = (await ref.toHwpx(doc, template, { ...v, readImage: (src: string) => (src.includes("missing") ? undefined : PNG) })) as Uint8Array;
				expect(await unzipText(mine)).toEqual(await unzipText(theirs));
			}
		});
	}
	it("문단 스타일", () => {
		const styles = [{ kind: "body" }, { kind: "quote" }, { kind: "heading", level: 1 }, { kind: "heading", level: 9 }, { kind: "heading", level: 0 }] as const;
		for (const line of ["본문", "> 인용", "### 제목", "  > ## 섞임", "", "   "]) {
			for (const s of styles) expect(applyParagraphStyle(line, s)).toBe(ref.paraStyle(line, s));
		}
	});
});
