// 자동 모드의 문맥 규칙: Obsidian·마크다운 문법이 되는 괄호는 바꾸지 않는다.
// 입력기 상태와 무관하게 커서 앞 글만 보고 정하므로 데스크톱·모바일 어디서나 같게 동작한다.

const FENCE = /^\s*(`{3,}|~{3,})/;
const MATH_BLOCK = /^\s*\$\$/;
const LIST_MARKER = /^\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+$/;

/** 커서 앞(before)에서 ch를 칠 때 원래 괄호를 남겨야 하는 문맥인가. */
export function isLiteralContext(before: string, ch: string): boolean {
	const lines = before.split("\n");
	const line = lines[lines.length - 1];
	const prev = before.slice(-1);

	// 프런트매터: 문서가 ---로 시작하고 아직 닫히지 않았다.
	if (lines[0] === "---" && lines.length > 1 && !lines.slice(1, -1).some((l) => l === "---" || l === "...")) return true;

	// 코드 블록·수식 블록: 여닫는 줄 수가 홀수면 안에 있다.
	let fence: string | null = null;
	let mathBlock = false;
	for (const l of lines.slice(0, -1)) {
		const f = FENCE.exec(l);
		if (f) {
			if (fence === null) fence = f[1][0];
			else if (f[1][0] === fence) fence = null;
			continue;
		}
		if (fence === null && MATH_BLOCK.test(l)) mathBlock = !mathBlock;
	}
	if (fence !== null || mathBlock) return true;

	// 인라인 코드·수식: 줄 안에서 짝이 안 맞은 ` 나 $ 뒤.
	if (countUnescaped(line, "`") % 2 === 1) return true;
	if (countUnescaped(line, "$") % 2 === 1) return true;

	// 이스케이프 \[ 그대로.
	if (prev === "\\") return true;

	if (ch === "[") {
		// [[링크]] · ![[임베드]] · ![그림] · ][참조
		if (prev === "[" || prev === "!" || prev === "]") return true;
		// - [ ] 할 일
		if (LIST_MARKER.test(line)) return true;
	}
	if (ch === "{" && (prev === "{" || prev === "$")) return true;
	return false;
}

function countUnescaped(s: string, ch: string): number {
	let n = 0;
	for (let i = 0; i < s.length; i++) {
		if (s[i] === ch && (i === 0 || s[i - 1] !== "\\")) n++;
	}
	return n;
}

/** 같은 문단(빈 줄 이후)에 아직 닫히지 않은 여는 낫표가 있는가. */
export function unmatchedOpen(before: string, open: string, close: string): boolean {
	const para = before.slice(before.lastIndexOf("\n\n") + 1);
	let depth = 0;
	for (const c of para) {
		if (c === open) depth++;
		else if (c === close && depth > 0) depth--;
	}
	return depth > 0;
}
