// 커뮤니티 디렉터리 목록 규칙: manifest 설명, README 영어, LICENSE 인식.
// 2026-10-17 첫 제출의 자동 검토 지적(설명에 「Obsidian」 금지·짧은 설명 200자 제한, README 영어 미검출,
// LICENSE 미인식 — 저작권 줄과 허가 문장 사이의 설명 문단 때문에 GitHub가 MIT로 보지 못했다)을 막는다.
import { readFileSync } from "node:fs";

const fails = [];

const desc = JSON.parse(readFileSync("manifest.json", "utf8")).description ?? "";
if (/obsidian/i.test(desc)) fails.push("manifest 설명에 「Obsidian」이 있다");
if (desc.length > 200) fails.push(`manifest 설명이 ${desc.length}자(200자 초과)`);
if (!desc.endsWith(".")) fails.push("manifest 설명이 마침표로 끝나지 않는다");

// README 첫 15줄 안에 영어 문장이 있어야 한다: URL을 뺀 뒤 라틴 문자 단어 12개 이상이고, 글자의 80% 이상이 라틴 문자인 줄.
const english = (line) => {
	const t = line.replace(/\(?https?:\/\/\S+/g, "");
	const words = (t.match(/\b[A-Za-z]{2,}\b/g) ?? []).length;
	const latin = (t.match(/[A-Za-z]/g) ?? []).length;
	const letters = (t.match(/\p{L}/gu) ?? []).length;
	return words >= 12 && letters > 0 && latin / letters >= 0.8;
};
const head = readFileSync("README.md", "utf8").split(/\r?\n/).slice(0, 15);
if (!head.some(english)) fails.push("README 첫 15줄에 영어 설명이 없다");

// LICENSE: 「MIT License」 다음에는 빈 줄과 저작권 줄만 오고 바로 허가 문장이 이어져야 한다.
const lic = readFileSync("LICENSE", "utf8").split(/\r?\n/);
const permit = lic.findIndex((l) => l.startsWith("Permission is hereby granted"));
if (lic[0] !== "MIT License" || permit < 0) fails.push("LICENSE가 MIT 표준 형식이 아니다");
else {
	const extra = lic.slice(1, permit).filter((l) => l.trim() && !/^Copyright \(c\)/.test(l));
	if (extra.length > 0) fails.push(`LICENSE의 저작권 줄과 허가 문장 사이에 다른 글 ${extra.length}줄`);
	const tail = lic.slice(permit).join("\n").trimEnd();
	if (!tail.endsWith("OTHER DEALINGS IN THE\nSOFTWARE.")) fails.push("LICENSE가 MIT 면책 문장으로 끝나지 않는다");
}

if (fails.length > 0) {
	for (const f of fails) console.log(`FAIL: ${f}`);
	process.exit(1);
}
console.log("listing ok");
