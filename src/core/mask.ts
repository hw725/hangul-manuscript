// 코드·수식 안의 [^n]을 주석으로 보지 않게 가린다(Obsidian 이식에서 더함 — 원본 HanMark의 알려진 제한).
// 코드 블록(``` ~~~)·수식 블록($$)·인라인 코드(`…`)·인라인 수식($…$) 안의 「[^」에서 [ 한 글자를
// 문서에 없는 사설 영역 문자로 바꾼다. 길이가 같으므로 가린 글에서 구한 위치를 원문에 그대로 쓸 수 있다.

export interface Masked {
	text: string;
	/** 가린 글자. 가린 것이 없으면 null */
	sentinel: string | null;
}

const FENCE = /^\s*(`{3,}|~{3,})/;
const MATH_BLOCK = /^\s*\$\$/;

/** 줄 안에서 짝이 맞는 `…` · $…$ 구간(끝 포함 안 함). */
function inlineRanges(line: string): [number, number][] {
	const out: [number, number][] = [];
	let i = 0;
	while (i < line.length) {
		const c = line[i];
		if ((c === "`" || c === "$") && (i === 0 || line[i - 1] !== "\\")) {
			let run = 1;
			while (line[i + run] === c) run++;
			const delim = c.repeat(run);
			const end = line.indexOf(delim, i + run);
			if (end >= 0) {
				out.push([i, end + run]);
				i = end + run;
				continue;
			}
			i += run;
			continue;
		}
		i++;
	}
	return out;
}

function pickSentinel(text: string): string | null {
	for (let cp = 0xe000; cp <= 0xf8ff; cp++) {
		const ch = String.fromCharCode(cp);
		if (!text.includes(ch)) return ch;
	}
	return null;
}

export function maskCode(text: string): Masked {
	if (!text.includes("[^")) return { text, sentinel: null };
	const lines = text.split("\n");
	const hide: boolean[][] = [];
	let fence: string | null = null;
	let math = false;
	for (const line of lines) {
		const flags = new Array<boolean>(line.length).fill(false);
		const f = FENCE.exec(line);
		if (fence !== null || math) {
			flags.fill(true);
			if (fence !== null && f && f[1][0] === fence) fence = null;
			else if (math && MATH_BLOCK.test(line)) math = false;
		} else if (f) {
			fence = f[1][0];
			flags.fill(true);
		} else if (MATH_BLOCK.test(line)) {
			flags.fill(true);
			// 한 줄짜리 $$…$$는 그 줄만 가리고, 여는 줄이면 닫는 $$까지 가린다.
			const t = line.trim();
			if (!(t.length > 4 && t.endsWith("$$"))) math = true;
		} else {
			for (const [a, b] of inlineRanges(line)) for (let k = a; k < b; k++) flags[k] = true;
		}
		hide.push(flags);
	}
	const sentinel = pickSentinel(text);
	if (!sentinel) return { text, sentinel: null };
	let changed = false;
	const out = lines.map((line, li) => {
		let s = "";
		for (let k = 0; k < line.length; k++) {
			if (line[k] === "[" && line[k + 1] === "^" && hide[li][k]) {
				s += sentinel;
				changed = true;
			} else s += line[k];
		}
		return s;
	});
	return changed ? { text: out.join("\n"), sentinel } : { text, sentinel: null };
}

export function unmask(s: string, sentinel: string | null): string {
	return sentinel ? s.split(sentinel).join("[") : s;
}
