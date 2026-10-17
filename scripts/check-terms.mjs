// 사용자에게 보이는 문자열에 「주석」을 쓰지 않는지 검사한다.
// Obsidian 한국어판은 「주석」을 %% 숨김 메모(editor:toggle-comments)에 쓰므로, 이 플러그인의 각주 기능은 「각주」라고 부른다.
// 코드 주석은 사용자에게 보이지 않으니 검사하지 않는다 — TypeScript 파서로 문자열·템플릿 리터럴만 뽑아 본다.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const FORBIDDEN = "주석";

function* walkTs(dir) {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* walkTs(p);
		else if (p.endsWith(".ts")) yield p;
	}
}

const hits = [];
for (const file of walkTs("src")) {
	const src = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
	const visit = (node) => {
		if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
			if (node.text.includes(FORBIDDEN)) {
				const { line } = src.getLineAndCharacterOfPosition(node.getStart());
				hits.push(`${file}:${line + 1}: ${node.text}`);
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(src);
}

if (hits.length > 0) {
	for (const h of hits) console.log(`FAIL: ${h}`);
	console.log(`FAIL: 사용자 문자열 ${hits.length}곳에 「${FORBIDDEN}」`);
	process.exit(1);
}
console.log("terms ok");
