// 게시 전 검사(C-004): Obsidian 심사 lint 오류 0, 원 저작자 표시 유지, README 출처 표기.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const fail = [];

const lint = spawnSync(process.execPath, ["node_modules/eslint/bin/eslint.js", ".", "--format", "json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
try {
	const results = JSON.parse(lint.stdout);
	const errors = results.flatMap((r) => r.messages.filter((m) => m.severity === 2).map((m) => `${r.filePath}:${m.line} ${m.ruleId} ${m.message}`));
	const warnings = results.reduce((n, r) => n + r.warningCount, 0);
	if (errors.length > 0) fail.push(`lint 오류 ${errors.length}건:\n  ${errors.join("\n  ")}`);
	console.log(`lint: 오류 ${errors.length} · 경고 ${warnings} · 파일 ${results.length}`);
} catch {
	fail.push(`lint 실행 실패: ${lint.stderr || lint.stdout}`);
}

const license = readFileSync("LICENSE", "utf8");
if (!/^MIT License/m.test(license)) fail.push("LICENSE가 MIT가 아니다");
if (!license.includes("Copyright (c) 2026 hangul-office-keys contributors")) fail.push("LICENSE에 원 저작자 저작권 줄이 없다");
if (!license.includes("gkman1.vscode-hanmark")) fail.push("LICENSE에 원본 확장 표기가 없다");

const readme = readFileSync("README.md", "utf8");
for (const need of ["HanMark", "gkman1", "https://marketplace.visualstudio.com/items?itemName=gkman1.vscode-hanmark", "MIT"]) {
	if (!readme.includes(need)) fail.push(`README에 출처 표기 「${need}」가 없다`);
}

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const versions = JSON.parse(readFileSync("versions.json", "utf8"));
if (manifest.version !== pkg.version) fail.push(`manifest(${manifest.version})와 package(${pkg.version}) 버전이 다르다`);
if (versions[manifest.version] !== manifest.minAppVersion) fail.push("versions.json에 현재 버전·minAppVersion이 없다");

if (fail.length > 0) {
	console.log(fail.join("\n"));
	process.exit(1);
}
console.log("release check ok");
