// README가 게시된 제품 설명으로 읽히는지 본다(2026-10-17 사용자 지적).
// ① 굵게(**)가 낫표·괄호에 붙고 바깥에 글자가 이어지면 CommonMark가 굵게로 보지 않아 별표가 그대로 보인다
//    (예: **「HWPX로 내보내기」**를). 굵게는 「**…**」처럼 문장부호 안쪽에 둔다.
// ② 발행 전 과정(목록 등록 전 수동 설치·시험 경위·미확인 안내)은 담지 않는다.
import { readFileSync } from "node:fs";

const text = readFileSync("README.md", "utf8").replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, "")).replace(/`[^`\n]*`/g, "``");
const lines = text.split(/\r?\n/);
const fails = [];

// 한 줄의 ** 를 차례로 여는 것·닫는 것으로 짝지어, CommonMark 조건으로 렌더링되지 않는 쪽을 찾는다.
// 여는 **: 앞이 글자이고 뒤가 문장부호면 깨진다. 닫는 **: 앞이 문장부호이고 뒤가 글자면 깨진다.
const isWord = (c) => !!c && /[\p{L}\p{N}]/u.test(c);
const isPunct = (c) => !!c && /[\p{P}\p{S}]/u.test(c);
lines.forEach((l, i) => {
	const at = [...l.matchAll(/\*\*/g)].map((m) => m.index);
	at.forEach((p, k) => {
		const before = l[p - 1];
		const after = l[p + 2];
		const opening = k % 2 === 0;
		const broken = opening ? isWord(before) && isPunct(after) : isPunct(before) && isWord(after);
		if (broken) fails.push(`${i + 1}행 굵게가 문장부호 바깥에 붙어 렌더링되지 않음: …${l.slice(Math.max(0, p - 15), p + 15)}…`);
	});
});

const PROCESS = ["목록 등록 전", "BRAT", "시험했습니다", "확인하지 않았습니다", "확인했습니다", "이슈로 알려", "Until the plugin is listed", "Tested on", "Not tested"];
for (const p of PROCESS) {
	const i = lines.findIndex((l) => l.includes(p));
	if (i >= 0) fails.push(`${i + 1}행 발행 전 과정 문구 「${p}」`);
}

if (fails.length > 0) {
	for (const f of fails) console.log(`FAIL: ${f}`);
	process.exit(1);
}
console.log("readme ok");
