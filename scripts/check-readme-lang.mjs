// 커뮤니티 디렉터리 자동 검토(2026-11-07) 「README does not appear to contain English text」 대응.
// 목록이 보여 주는 README.md는 영어판, 한국어판은 README.ko.md로 두고 서로 링크한다.
import { existsSync, readFileSync } from "node:fs";

const fails = [];
const strip = (t) =>
	t
		.replace(/```[\s\S]*?```/g, "")
		.replace(/`[^`\n]*`/g, "")
		.replace(/\(?https?:\/\/\S+/g, "");

const en = readFileSync("README.md", "utf8");
const letters = (strip(en).match(/\p{L}/gu) ?? []).length;
const latin = (strip(en).match(/[A-Za-z]/g) ?? []).length;
const ratio = letters ? latin / letters : 0;
// 명령 이름 등 한글 고유 표기는 남으므로 90%를 기준으로 둔다.
if (ratio < 0.9) fails.push(`README.md 글자 중 라틴 문자 ${(ratio * 100).toFixed(1)}%(90% 미만)`);
if (!en.includes("README.ko.md")) fails.push("README.md가 README.ko.md로 링크하지 않는다");

if (!existsSync("README.ko.md")) fails.push("README.ko.md가 없다");
else {
	const ko = readFileSync("README.ko.md", "utf8");
	const kl = (strip(ko).match(/\p{L}/gu) ?? []).length;
	const hangul = (strip(ko).match(/\p{Script=Hangul}/gu) ?? []).length;
	if (!kl || hangul / kl < 0.5) fails.push("README.ko.md가 한국어판이 아니다");
	if (!/\(README\.md(#[^)]*)?\)/.test(ko)) fails.push("README.ko.md가 README.md로 링크하지 않는다");
}

if (fails.length > 0) {
	for (const f of fails) console.log(`FAIL: ${f}`);
	process.exit(1);
}
console.log("readme lang ok");
