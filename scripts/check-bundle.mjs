// 커뮤니티 디렉터리 자동 검토가 오류·권장으로 잡는 코드가 번들(main.js)에 없는지 본다.
// 2026-10-17 첫 제출에서 JSZip 배포판에 섞인 setImmediate·Promise 대체 코드가
// 「Code creates script elements at runtime」(오류)·「Dynamic Code Execution」(권장)으로 잡혔다.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const build = spawnSync(process.execPath, ["esbuild.config.mjs", "production"], { encoding: "utf8" });
if (build.status !== 0) {
	console.log(`FAIL: 빌드 실패\n${build.stderr}`);
	process.exit(1);
}

const code = readFileSync("main.js", "utf8");
const rules = [
	{ name: "script 요소 생성", re: /createElement\(\s*["'`]script["'`]\s*\)/ },
	{ name: "new Function", re: /new Function\s*\(/ },
	{ name: "eval 호출", re: /(^|[^.\w$])eval\s*\(/ },
];
const fails = rules.filter((r) => r.re.test(code)).map((r) => r.name);
if (fails.length > 0) {
	for (const f of fails) console.log(`FAIL: main.js에 ${f}`);
	process.exit(1);
}
console.log("bundle ok");
