// 커뮤니티 디렉터리 자동 검토(2026-11-07)가 짚은 폐기 예정 API를 소스에서 직접 부르지 않는다.
// ① KeyboardEvent.keyCode — 조합 중 판정은 isComposing·key === "Process"로 한다.
// ② setWarning — 1.13 미만에서만 쓰는 옛 경로는 남기되 소스에서 직접 부르지 않는다(동적 접근으로만).
// ③ display() — 호출은 막고 정의는 예외로 둔다. minAppVersion이 1.13 미만이면 공식 lint(obsidianmd/settings-tab/require-display)가
// display() 구현을 요구하고, 자동 검토는 그 재정의를 폐기 예정으로 짚는다 — 1.6 호환을 지키는 동안 둘은 함께 풀 수 없다.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const files = [];
const walk = (d) => {
	for (const n of readdirSync(d)) {
		const p = join(d, n);
		if (statSync(p).isDirectory()) walk(p);
		else if (p.endsWith(".ts")) files.push(p);
	}
};
walk("src");

const RULES = [
	[/\.keyCode\b/, "keyCode"],
	[/\.setWarning\s*\(/, "setWarning()"],
	[/\.display\s*\(\s*\)/, "display() 호출"],
];

const fails = [];
for (const f of files) {
	const lines = readFileSync(f, "utf8").split(/\r?\n/);
	lines.forEach((l, i) => {
		if (/^\s*(\/\/|\*)/.test(l)) return;
		for (const [re, name] of RULES) if (re.test(l)) fails.push(`${f}:${i + 1} 폐기 예정 API ${name}`);
	});
}

if (fails.length > 0) {
	for (const f of fails) console.log(`FAIL: ${f}`);
	process.exit(1);
}
console.log("deprecated ok");
