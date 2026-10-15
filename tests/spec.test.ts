// README에 적힌 동작과 Obsidian 이식에서 더한 동작.
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { insertFootnote, renumberFootnotes } from "../src/core/footnotes";
import { markdownToHwpx } from "../src/core/hwpx";
import { countManuscript, parseParagraphs, stripFrontmatter } from "../src/core/markdown";
import { maskCode, unmask } from "../src/core/mask";
import { applyParagraphStyle, convertQuotes, convertWidth, toHalfwidthBrackets } from "../src/core/text";
import { spawn } from "node:child_process";
import { EditorSelection, EditorState } from "@codemirror/state";
import { vi } from "vitest";
import { autoDecide, bracketAction, bracketFromKey, bracketTransaction, revertTransaction } from "../src/editor/brackets";
import { isLiteralContext, unmatchedOpen } from "../src/editor/context";
import { ImeProbe, encodeHelperCommand } from "../src/editor/ime-windows";

vi.mock("obsidian", () => ({ Platform: { isDesktopApp: true, isWin: true } }));
(globalThis as { window?: unknown }).window ??= globalThis;

const template = readFileSync(new URL("../assets/template-default.hwpx", import.meta.url));
const curly = { double: "curly", single: "curly" } as const;

async function section(md: string, opt = {}) {
	const z = await JSZip.loadAsync(await markdownToHwpx(md, template, opt));
	return (await z.file("Contents/section0.xml")?.async("string")) ?? "";
}

describe("주석", () => {
	it("삽입하면 등장 순서 번호를 받고 뒤 번호가 밀린다", () => {
		const doc = "가[^1] 나\n\n[^1]: 하나\n";
		const r = insertFootnote(doc, doc.indexOf(" 나") + 1);
		expect(r.newNumber).toBe(2);
		expect(r.text).toBe("가[^1] [^2]나\n\n[^1]: 하나\n[^2]: ");
		const front = insertFootnote(doc, 0);
		expect(front.text).toBe("[^1]가[^2] 나\n\n[^1]: \n[^2]: 하나");
		expect(front.text.slice(front.cursorOffset - 6, front.cursorOffset)).toBe("[^1]: ");
		expect(front.markerEndOffset).toBe(4);
	});
	it("저장 시 재정렬은 정의 사이에 본문이 끼면 묶음 안에서만 정렬한다", () => {
		const r = renumberFootnotes("갑[^b] 을[^a]\n\n[^a]: A\n\n본문\n\n[^b]: B\n");
		expect(r.text).toBe("갑[^1] 을[^2]\n\n[^2]: A\n\n본문\n\n[^1]: B\n");
	});
	it("이미 정렬돼 있으면 바꾸지 않는다", () => {
		const r = renumberFootnotes("가[^1]\n\n[^1]: 하나");
		expect(r.changed).toBe(false);
		expect(r.count).toBe(1);
	});
});

describe("코드·수식 안의 [^n]은 주석이 아니다", () => {
	const doc = [
		"본문[^b] 설명 `[^n]` 과 $[^x]$ 표기.[^a]",
		"",
		"```",
		"[^1]: 코드 안 정의",
		"코드 [^z]",
		"```",
		"",
		"$$",
		"[^m]",
		"$$",
		"",
		"[^a]: 에이",
		"[^b]: 비 `[^c]`",
	].join("\n");
	it("재정렬은 코드·수식을 건드리지 않는다", () => {
		const r = renumberFootnotes(doc);
		expect(r.count).toBe(2);
		expect(r.text).toBe(
			[
				"본문[^1] 설명 `[^n]` 과 $[^x]$ 표기.[^2]",
				"",
				"```",
				"[^1]: 코드 안 정의",
				"코드 [^z]",
				"```",
				"",
				"$$",
				"[^m]",
				"$$",
				"",
				"[^1]: 비 `[^c]`",
				"[^2]: 에이",
			].join("\n"),
		);
	});
	it("확인 목록에서 일어난 사고: 인라인 코드 속 설명은 그대로", () => {
		const r = renumberFootnotes("- `[^b]`·`[^a]`가 `[^1]`·`[^2]`로 바뀐다\n\n본문[^x]\n\n[^x]: 주");
		expect(r.text).toBe("- `[^b]`·`[^a]`가 `[^1]`·`[^2]`로 바뀐다\n\n본문[^1]\n\n[^1]: 주");
	});
	it("삽입도 코드 속 표기를 세지 않는다", () => {
		const r = insertFootnote("`[^1]` 가", 9);
		expect(r.newNumber).toBe(1);
		expect(r.text).toBe("`[^1]` 가[^1]\n\n[^1]: ");
	});
	it("내보내기·분량에서 코드 속 표기는 글자 그대로", () => {
		const p = parseParagraphs("가 `[^1]` 나[^1]\n\n[^1]: 주");
		expect(p[0].parts).toEqual([
			{ kind: "text", text: "가 `[^1]` 나" },
			{ kind: "footnote", content: "주" },
		]);
	});
	it("가릴 글자는 문서에 없는 것을 고른다", () => {
		const m = maskCode(" `[^1]`");
		expect(m.sentinel).toBe("");
		expect(unmask(m.text, m.sentinel)).toBe(" `[^1]`");
	});
});

describe("따옴표", () => {
	it("README 예시", () => {
		expect(convertQuotes('이른바"용어"라고', curly)).toBe("이른바“용어”라고");
		expect(convertQuotes("don't government's", curly)).toBe("don’t government’s");
		expect(convertQuotes('"말"', { double: "straight", single: "keep" })).toBe('"말"');
		expect(convertQuotes("“말”", { double: "straight", single: "keep" })).toBe('"말"');
	});
});

describe("반각/전각", () => {
	it("README 예시", () => {
		expect(convertWidth("１９６５年　Ｓｅｄａｉ！", "toHalf").text).toBe("1965年 Sedai!");
		expect(convertWidth("A1!", "toFull").text).toBe("Ａ１！");
		expect(convertWidth("가 나", "toFull").text).toBe("가 나");
	});
	it("낫표 반각", () => {
		expect(toHalfwidthBrackets("「가」『나』")).toBe("｢가｣\u{F0854}나\u{F0855}");
	});
});

describe("문단 스타일", () => {
	it("Ctrl+숫자 대응", () => {
		expect(applyParagraphStyle("## 제목", { kind: "body" })).toBe("제목");
		expect(applyParagraphStyle("본문", { kind: "quote" })).toBe("> 본문");
		expect(applyParagraphStyle("> 인용", { kind: "heading", level: 3 })).toBe("### 인용");
		expect(applyParagraphStyle("", { kind: "heading", level: 1 })).toBe("");
	});
});

describe("원고지", () => {
	it("영문은 반 칸, 주석 포함", () => {
		const c = countManuscript("가나다 abcd[^1]\n\n[^1]: 라마");
		expect(c.chars).toBe(8 + 3);
		expect(c.latinChars).toBe(4);
		expect(c.sheets).toBeCloseTo((11 - 2) / 200);
	});
});

describe("Obsidian 이식에서 더한 것", () => {
	it("프런트매터는 내보내기·분량에서 뺀다", () => {
		expect(stripFrontmatter("---\ntitle: x\n---\n본문")).toBe("본문");
		expect(stripFrontmatter("본문\n---\n")).toBe("본문\n---\n");
		expect(countManuscript("---\ntags: [a]\n---\n가나").chars).toBe(2);
	});
	it("![[그림]] 임베드는 그림 문단이 된다", () => {
		const p = parseParagraphs("![[사진.png|300]]");
		expect(p[0].parts[0]).toEqual({ kind: "image", src: "사진.png", alt: "300", wiki: true });
	});
	it("못 읽은 그림은 [그림 없음: 경로]로 남는다", async () => {
		expect(await section("![[없음.png]]")).toContain("[그림 없음: 없음.png]");
	});
});

describe("HWPX", () => {
	it("각주·미주가 진짜 객체로 들어간다", async () => {
		const md = "가[^1]\n\n[^1]: 주석 **굵게**";
		const foot = await section(md);
		expect(foot).toContain('<hp:footNote number="1"');
		expect(foot).toContain('numType="FOOTNOTE"');
		const end = await section(md, { noteType: "endnote" });
		expect(end).toContain('<hp:endNote number="1"');
	});
	it("인용문 앞뒤 빈 줄", async () => {
		const xml = await section("앞\n\n> 인용\n\n뒤", { quoteBlankLines: true });
		expect(xml.match(/<hp:p /g)?.length).toBe(5);
	});
	it("템플릿이 아니면 오류", async () => {
		const z = new JSZip();
		z.file("a.txt", "x");
		await expect(markdownToHwpx("가", await z.generateAsync({ type: "uint8array" }))).rejects.toThrow("hwpx 템플릿");
	});
});

describe("겹낫표 입력", () => {
	it("문맥 규칙: Obsidian·마크다운 문법이 되는 괄호는 그대로", () => {
		const lit = (before: string, ch = "[") => isLiteralContext(before, ch);
		expect(lit("본문 ")).toBe(false);
		expect(lit("")).toBe(false);
		expect(lit("[")).toBe(true); // [[링크
		expect(lit("!")).toBe(true); // ![[임베드 · ![그림
		expect(lit("[글]")).toBe(true); // ][참조
		expect(lit("\\")).toBe(true); // \[
		expect(lit("- ")).toBe(true); // - [ ] 할 일
		expect(lit("  1. ")).toBe(true);
		expect(lit("> - ")).toBe(true);
		expect(lit("- 할 일 ")).toBe(false);
		expect(lit("코드 `a ")).toBe(true);
		expect(lit("코드 `a` ")).toBe(false);
		expect(lit("수식 $x ")).toBe(true);
		expect(lit("```js\nconst a = ")).toBe(true);
		expect(lit("```js\nx\n```\n본문 ")).toBe(false);
		expect(lit("$$\nx = ")).toBe(true);
		expect(lit("---\ntags: ")).toBe(true);
		expect(lit("---\ntags: a\n---\n본문 ")).toBe(false);
		expect(lit("{", "{")).toBe(true); // {{템플릿
		expect(lit("본문 ", "{")).toBe(false);
	});
	it("닫는 괄호는 같은 문단에 열린 낫표가 있을 때만", () => {
		expect(unmatchedOpen("「가", "「", "」")).toBe(true);
		expect(unmatchedOpen("「가」 나", "「", "」")).toBe(false);
		expect(unmatchedOpen("「가\n\n나", "「", "」")).toBe(false);
		expect(unmatchedOpen("「가 『나』", "「", "」")).toBe(true);
	});
	it("자동 모드 판단과 되돌리기", () => {
		const st = (doc: string, head = doc.length) => EditorState.create({ doc, selection: EditorSelection.cursor(head) });
		expect(autoDecide(st("본문 "), "[", null, false)).toEqual({ kind: "convert" });
		expect(autoDecide(st("본문 "), "[", null, true)).toEqual({ kind: "ask-ime" });
		expect(autoDecide(st("[["), "[", null, true)).toEqual({ kind: "literal" });
		expect(autoDecide(st("본문 "), "]", null, false)).toEqual({ kind: "literal" });
		expect(autoDecide(st("「가"), "]", null, false)).toEqual({ kind: "convert" });
		expect(autoDecide(st("본문"), "a", null, false)).toBeNull();

		// 「」로 바꾼 직후
		const s = st("가「」", 2);
		const last = { doc: s.doc, head: 2, from: 1, to: 3, literal: "[" };
		expect(autoDecide(s, "[", last, true)).toEqual({ kind: "retro", replay: ["[", "["] });
		expect(autoDecide(s, "^", last, false)).toEqual({ kind: "retro", replay: ["[", "^"] });
		expect(autoDecide(s, "!", last, false)).toEqual({ kind: "retro", replay: ["[", "!"] });
		expect(autoDecide(s, "가", last, false)).toBeNull();
		// 커서가 움직였거나 문서가 바뀌면 되돌리지 않는다
		expect(autoDecide(st("가「」", 1), "^", last, false)).toBeNull();
		expect(autoDecide(st("가「」", 2), "^", last, false)).toBeNull(); // 다른 문서 객체

		expect(revertTransaction(s, last).state.doc.toString()).toBe("가");
		const back = revertTransaction(s, last, "[").state;
		expect([back.doc.toString(), back.selection.main.head]).toEqual(["가[", 2]);
	});
	it("물리 키로 괄호를 안다(조합 중 key가 Process여도)", () => {
		expect(bracketFromKey("BracketLeft", false)).toBe("[");
		expect(bracketFromKey("BracketLeft", true)).toBe("{");
		expect(bracketFromKey("BracketRight", false)).toBe("]");
		expect(bracketFromKey("BracketRight", true)).toBe("}");
		expect(bracketFromKey("KeyA", false)).toBeNull();
	});
	it("키별 동작", () => {
		const base = { autoClose: true, hasSelection: false, closeFollows: false };
		expect(bracketAction("[", base)).toEqual({ kind: "open", open: "「", close: "」" });
		expect(bracketAction("{", base)).toEqual({ kind: "open", open: "『", close: "』" });
		expect(bracketAction("]", { ...base, closeFollows: true })).toEqual({ kind: "skip" });
		expect(bracketAction("]", base)).toEqual({ kind: "insert", text: "」" });
		expect(bracketAction("}", { ...base, autoClose: false, closeFollows: true })).toEqual({ kind: "insert", text: "』" });
		expect(bracketAction("[", { ...base, hasSelection: true })).toEqual({ kind: "wrap", open: "「", close: "」" });
		expect(bracketAction("[", { ...base, autoClose: false })).toEqual({ kind: "insert", text: "「" });
		expect(bracketAction("a", base)).toBeNull();
	});
	it("편집기 트랜잭션: 짝 넣기·감싸기·건너뛰기", () => {
		const run = (doc: string, anchor: number, head: number, ch: string) => {
			const st = EditorState.create({ doc, selection: EditorSelection.single(anchor, head) });
			const r = bracketTransaction(st, ch, true);
			if (!r) return null;
			if ("skipTo" in r) return { doc, cursor: r.skipTo.main.head };
			return { doc: r.state.doc.toString(), cursor: r.state.selection.main.head };
		};
		expect(run("가나", 1, 1, "[")).toEqual({ doc: "가「」나", cursor: 2 });
		expect(run("가나다", 1, 2, "{")).toEqual({ doc: "가『나』다", cursor: 3 });
		expect(run("「」", 1, 1, "]")).toEqual({ doc: "「」", cursor: 2 });
		expect(run("가", 1, 1, "]")).toEqual({ doc: "가」", cursor: 2 });
	});
});

describe("Windows 입력기 조회", () => {
	it("EncodedCommand는 UTF-16LE base64", () => {
		expect(encodeHelperCommand("a가")).toBe(Buffer.from("a가", "utf16le").toString("base64"));
	});
	it("가짜 프로세스로 요청·응답·시간 초과를 확인한다", async () => {
		const sent: string[] = [];
		let onData: (d: string) => void = () => undefined;
		const fake = {
			stdin: { write: (s: string) => sent.push(s) },
			stdout: { setEncoding: () => undefined, on: (_e: string, f: (d: string) => void) => (onData = f) },
			on: () => undefined,
			kill: () => undefined,
		};
		const probe = new ImeProbe(() => () => fake as never);
		const a = probe.isKoreanMode(1000);
		const b = probe.isKoreanMode(1000);
		onData("1\r\n0");
		onData("\r\n");
		expect(await a).toBe(true);
		expect(await b).toBe(false);
		expect(sent).toEqual(["q\n", "q\n"]);
		expect(await probe.isKoreanMode(20)).toBeNull();
	});
	it.runIf(process.platform === "win32")("실제 PowerShell 헬퍼가 응답한다", async () => {
		const probe = new ImeProbe(() => spawn as never);
		try {
			const dbg = await probe.debugInfo(20000);
			expect(dbg).toMatch(/^open=-?\d+ conv=-?\d+$/);
			expect([true, false]).toContain(await probe.isKoreanMode(5000));
		} finally {
			probe.dispose();
		}
	}, 30000);
});
