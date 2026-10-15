// 마크다운 → 문단 모델, 원고지 분량.
// 원본: VS Code 확장 HanMark(gkman1) 0.15.0 — MIT.
// Obsidian 이식에서 더한 것: YAML 프런트매터 제외, ![[그림]] 위키 임베드.

import { findDefinitionBlocks } from "./footnotes";
import { maskCode, unmask } from "./mask";

export type Part =
	| { kind: "text"; text: string; bold?: boolean; italic?: boolean }
	| { kind: "footnote"; content: string }
	| { kind: "image"; src: string; alt: string; wiki?: boolean };

export interface Paragraph {
	/** 0 = 본문, 1~6 = 제목 수준 */
	outlineLevel: number;
	quote: boolean;
	/** 같은 인용문 묶음에 속한 문단은 같은 번호를 받는다. */
	quoteBlock?: number;
	parts: Part[];
}

export interface Span {
	text: string;
	bold: boolean;
	italic: boolean;
}

const MARKER_RE = /\[\^([^\]\s]+)\]/g;
const EMPHASIS_RE = /\*\*\*(\S(?:[^*]*\S)?)\*\*\*|\*\*(\S(?:[^*]*\S)?)\*\*|\*(\S(?:[^*]*\S)?)\*/g;
const MD_IMAGE_RE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/;
const WIKI_IMAGE_RE = /^!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]$/;

/** 문서 맨 앞의 YAML 프런트매터를 뺀다. */
export function stripFrontmatter(text: string): string {
	const m = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
	return m ? text.slice(m[0].length) : text;
}

/** ***굵게기울임*** · **굵게** · *기울임* 을 나눈다. 중첩 강조는 지원하지 않는다. */
export function splitEmphasis(text: string): Span[] {
	const out: Span[] = [];
	let last = 0;
	for (const m of text.matchAll(EMPHASIS_RE)) {
		const i = m.index ?? 0;
		if (i > last) out.push({ text: text.slice(last, i), bold: false, italic: false });
		if (m[1] !== undefined) out.push({ text: m[1], bold: true, italic: true });
		else if (m[2] !== undefined) out.push({ text: m[2], bold: true, italic: false });
		else out.push({ text: m[3], bold: false, italic: true });
		last = i + m[0].length;
	}
	if (last < text.length) out.push({ text: text.slice(last), bold: false, italic: false });
	return out;
}

function splitDefinitions(text: string): { bodyLines: string[]; definitions: Map<string, string> } {
	const lines = text.split("\n");
	const used = new Set<number>();
	const definitions = new Map<string, string>();
	for (const b of findDefinitionBlocks(lines)) {
		for (let k = b.startLine; k <= b.endLine; k++) used.add(k);
		const pieces = [lines[b.startLine].replace(/^\[\^[^\]\s]+\]:\s?/, "")];
		for (let k = b.startLine + 1; k <= b.endLine; k++) {
			const t = lines[k].trim();
			if (t) pieces.push(t);
		}
		if (!definitions.has(b.label)) definitions.set(b.label, pieces.join(" ").trim());
	}
	return { bodyLines: lines.filter((_, i) => !used.has(i)), definitions };
}

export function parseParagraphs(source: string): Paragraph[] {
	// 코드·수식 안의 [^n]은 주석이 아니다 — 가렸다가 끝에 되돌린다.
	const masked = maskCode(stripFrontmatter(source).replace(/\r\n/g, "\n"));
	const { bodyLines, definitions } = splitDefinitions(masked.text);
	const out: Paragraph[] = [];
	let pending: string[] = [];
	let quoteCount = 0;

	const emit = (lines: string[], quoteBlock?: number) => {
		const isQuote = quoteBlock !== undefined;
		const q = isQuote ? { quoteBlock } : {};
		let joined = lines.join(" ").trim();
		if (!joined) return;

		const md = MD_IMAGE_RE.exec(joined);
		if (md) {
			out.push({ outlineLevel: 0, quote: false, ...q, parts: [{ kind: "image", src: md[2], alt: md[1] }] });
			return;
		}
		const wiki = WIKI_IMAGE_RE.exec(joined);
		if (wiki) {
			out.push({
				outlineLevel: 0,
				quote: false,
				...q,
				parts: [{ kind: "image", src: wiki[1].trim(), alt: (wiki[2] ?? "").trim(), wiki: true }],
			});
			return;
		}

		let level = 0;
		if (!isQuote) {
			const h = /^(#{1,6})\s+(.*)$/.exec(joined);
			if (h) {
				level = h[1].length;
				joined = h[2];
			}
		}
		const parts: Part[] = [];
		for (const span of splitEmphasis(joined)) {
			const style = { ...(span.bold ? { bold: true } : {}), ...(span.italic ? { italic: true } : {}) };
			let last = 0;
			for (const m of span.text.matchAll(MARKER_RE)) {
				const i = m.index ?? 0;
				if (i > last) parts.push({ kind: "text", text: span.text.slice(last, i), ...style });
				parts.push({ kind: "footnote", content: definitions.get(m[1]) ?? "" });
				last = i + m[0].length;
			}
			if (last < span.text.length) parts.push({ kind: "text", text: span.text.slice(last), ...style });
		}
		if (parts.length === 0) parts.push({ kind: "text", text: joined });
		out.push({ outlineLevel: level, quote: isQuote, ...q, parts });
	};

	const flush = () => {
		if (pending.length === 0) return;
		const lines = pending;
		pending = [];
		if (!lines.every((l) => /^\s*>/.test(l))) {
			emit(lines);
			return;
		}
		quoteCount += 1;
		let cur: string[] = [];
		for (const l of lines) {
			const inner = l.replace(/^\s*>\s?/, "");
			if (inner.trim() === "") {
				emit(cur, quoteCount);
				cur = [];
			} else cur.push(inner);
		}
		emit(cur, quoteCount);
	};

	for (const l of bodyLines) {
		if (l.trim() === "") flush();
		else pending.push(l);
	}
	flush();
	const s = masked.sentinel;
	if (!s) return out;
	for (const p of out) {
		p.parts = p.parts.map((x) =>
			x.kind === "text"
				? { ...x, text: unmask(x.text, s) }
				: x.kind === "footnote"
					? { ...x, content: unmask(x.content, s) }
					: { ...x, src: unmask(x.src, s), alt: unmask(x.alt, s) },
		);
	}
	return out;
}

export interface ManuscriptCount {
	chars: number;
	charsNoSpace: number;
	latinChars: number;
	words: number;
	rows: number;
	sheets: number;
}

const SHEET_CHARS = 200;
const ROW_CHARS = 20;

/** 200자 원고지 분량. 한글(HWP) 문서통계와 같은 셈법: 영문자는 반 칸, 주석 포함, 마크다운 문법·빈 줄 제외. */
export function countManuscript(source: string): ManuscriptCount {
	const texts: string[] = [];
	for (const p of parseParagraphs(source)) {
		let body = "";
		for (const part of p.parts) if (part.kind === "text") body += part.text;
		if (body.trim()) texts.push(body);
		for (const part of p.parts) {
			if (part.kind === "footnote" && part.content.trim()) texts.push(" " + part.content);
		}
	}
	let chars = 0;
	let charsNoSpace = 0;
	let latinChars = 0;
	let words = 0;
	for (const t of texts) {
		const cs = [...t];
		chars += cs.length;
		charsNoSpace += cs.filter((c) => !/\s/.test(c)).length;
		latinChars += cs.filter((c) => /[A-Za-z]/.test(c)).length;
		words += t.split(/\s+/).filter(Boolean).length;
	}
	const cells = chars - latinChars * 0.5;
	return { chars, charsNoSpace, latinChars, words, rows: Math.ceil(cells / ROW_CHARS), sheets: cells / SHEET_CHARS };
}
