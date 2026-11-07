// 커뮤니티 디렉터리 자동 검토(2026-11-07) 「Missing GitHub artifact attestations for release assets」 대응.
// 릴리스가 발행되면 Actions가 그 태그를 다시 빌드해 올린 main.js와 바이트가 같은지 확인하고,
// main.js·manifest.json·styles.css에 출처 증명을 붙이는 워크플로가 있어야 한다.
import { existsSync, readFileSync } from "node:fs";

const P = ".github/workflows/attest-release.yml";
const fails = [];
if (!existsSync(P)) fails.push(`${P}가 없다`);
else {
	const y = readFileSync(P, "utf8");
	const need = [
		[/release:\s*\n\s*types:\s*\[\s*published\s*\]/, "release published 트리거"],
		[/id-token:\s*write/, "id-token: write 권한"],
		[/attestations:\s*write/, "attestations: write 권한"],
		[/actions\/attest-build-provenance@/, "attest-build-provenance 단계"],
		[/npm ci/, "npm ci"],
		[/cmp\b/, "올린 main.js와 다시 빌드한 main.js 바이트 비교"],
	];
	for (const [re, name] of need) if (!re.test(y)) fails.push(`${P}에 ${name}이 없다`);
	for (const f of ["main.js", "manifest.json", "styles.css"])
		if (!y.includes(`release/${f}`)) fails.push(`${P}가 ${f}에 출처 증명을 붙이지 않는다`);
}

if (fails.length > 0) {
	for (const f of fails) console.log(`FAIL: ${f}`);
	process.exit(1);
}
console.log("attest ok");
