// 글자 단위 변환: 따옴표 모양, 반각/전각, 낫표 반각, 문단 스타일 접두사.
// 원본: VS Code 확장 HanMark(gkman1) 0.15.0 — MIT.

export type QuoteStyle = "curly" | "keep" | "straight";

export function normalizeQuoteStyle(v: unknown): QuoteStyle {
	return v === "keep" || v === "straight" ? v : "curly";
}

const OPEN_CONTEXT = /[\s([{<«‹「『《〈【〔“‘—–]/u;
const CLOSE_CONTEXT = /[\s.,;:!?)\]}>»›」』》〉】〕”’…·]/u;
const ALNUM = /[A-Za-z0-9]/;

function nextNonStar(chars: string[], i: number): string {
	for (let k = i + 1; k < chars.length; k++) if (chars[k] !== "*") return chars[k];
	return "";
}

function lastNonStar(out: string[]): string {
	for (let k = out.length - 1; k >= 0; k--) if (out[k] !== "*") return out[k];
	return "";
}

/** 곧은 따옴표를 앞뒤 글자에 따라 여는·닫는 둥근 따옴표로(또는 반대로) 바꾼다. 강조 별표는 건너뛰고 본다. */
export function convertQuotes(text: string, opt: { double: QuoteStyle; single: QuoteStyle }): string {
	if (opt.double === "keep" && opt.single === "keep") return text;
	const chars = [...text];
	const out: string[] = [];
	let doubleOpen = false;
	let singleOpen = false;
	for (let i = 0; i < chars.length; i++) {
		const c = chars[i];
		const prev = lastNonStar(out);
		const next = nextNonStar(chars, i);
		const opensHere = prev === "" || OPEN_CONTEXT.test(prev);
		const closesHere = next === "" || CLOSE_CONTEXT.test(next);
		if (c === '"' || c === "“" || c === "”") {
			if (opt.double === "straight") out.push('"');
			else if (opt.double === "curly" && c === '"') {
				const isOpen: boolean = opensHere ? true : closesHere ? false : !doubleOpen;
				out.push(isOpen ? "“" : "”");
				doubleOpen = isOpen;
			} else {
				out.push(c);
				if (c === "“") doubleOpen = true;
				else if (c === "”") doubleOpen = false;
			}
			continue;
		}
		if (c === "'" || c === "‘" || c === "’") {
			const apostrophe = ALNUM.test(prev) && ALNUM.test(next);
			if (opt.single === "straight") out.push("'");
			else if (opt.single === "curly" && c === "'") {
				if (apostrophe) out.push("’");
				else {
					const isOpen: boolean = opensHere ? true : closesHere ? false : !singleOpen;
					out.push(isOpen ? "‘" : "’");
					singleOpen = isOpen;
				}
			} else {
				out.push(c);
				if (c === "‘") singleOpen = true;
				else if (c === "’" && !apostrophe) singleOpen = false;
			}
			continue;
		}
		out.push(c);
	}
	return out.join("");
}

export type WidthDirection = "toHalf" | "toFull";

/** 영숫자·문장부호의 반각/전각 변환. 한글·한자는 건드리지 않고, 반각 공백은 전각으로 바꾸지 않는다. */
export function convertWidth(text: string, direction: WidthDirection): { text: string; converted: number } {
	let converted = 0;
	let out = "";
	for (const ch of text) {
		const cp = ch.codePointAt(0) ?? 0;
		if (direction === "toHalf") {
			if (cp >= 0xff01 && cp <= 0xff5e) {
				out += String.fromCharCode(cp - 0xfee0);
				converted++;
				continue;
			}
			if (ch === "　") {
				out += " ";
				converted++;
				continue;
			}
		} else if (cp >= 0x21 && cp <= 0x7e) {
			out += String.fromCharCode(cp + 0xfee0);
			converted++;
			continue;
		}
		out += ch;
	}
	return { text: out, converted };
}

const HALFWIDTH_BRACKETS: Record<string, string> = {
	"「": "｢",
	"」": "｣",
	// 한컴 사설 영역의 반각 겹낫표 — 함초롬 계열 글꼴에만 글리프가 있다.
	"『": "\u{F0854}",
	"』": "\u{F0855}",
};

export function toHalfwidthBrackets(text: string): string {
	let out = "";
	for (const ch of text) out += HALFWIDTH_BRACKETS[ch] ?? ch;
	return out;
}

export type ParagraphStyle = { kind: "body" } | { kind: "quote" } | { kind: "heading"; level: number };

/** 한 줄의 마크다운 문단 접두사(인용·제목)를 바꾼다. 빈 줄에는 접두사를 붙이지 않는다. */
export function applyParagraphStyle(line: string, style: ParagraphStyle): string {
	const body = line.replace(/^\s*(?:>\s*)?(?:#{1,6}\s+)?/, "");
	switch (style.kind) {
		case "body":
			return body;
		case "quote":
			return body ? `> ${body}` : line;
		case "heading": {
			const level = Math.min(Math.max(style.level, 1), 6);
			return body ? `${"#".repeat(level)} ${body}` : line;
		}
	}
}
