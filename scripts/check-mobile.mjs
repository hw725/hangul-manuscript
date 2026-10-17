// 모바일 표시 검사: 메뉴 모델 단위 시험(tests/mobile.test.ts)을 돌리고, main.ts가 모바일에서 그 메뉴를 붙이는지 본다.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const fails = [];
// 모듈이 없으면 vitest는 import 오류(환경 오류처럼 보이는 스택)로 끝나므로, 없다는 사실을 먼저 단언한다.
if (!existsSync("src/editor/mobile-menu.ts")) fails.push("src/editor/mobile-menu.ts 없음");
else {
	const r = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/mobile.test.ts"], { encoding: "utf8" });
	process.stdout.write(r.stdout ?? "");
	process.stderr.write(r.stderr ?? "");
	if (r.status !== 0) fails.push("tests/mobile.test.ts 실패");
}

const main = readFileSync("src/main.ts", "utf8");
if (!/from "\.\/editor\/mobile-menu"/.test(main)) fails.push("main.ts가 mobile-menu를 쓰지 않음");
if (!/Platform\.isMobile/.test(main)) fails.push("main.ts에 모바일 분기 없음");

if (fails.length > 0) {
	for (const f of fails) console.log(`FAIL: ${f}`);
	process.exit(1);
}
console.log("mobile ok");
