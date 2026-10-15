// 마크다운 주석([^n] + 정의) 파싱·재정렬·삽입.
// 원본: VS Code 확장 HanMark(gkman1) 0.15.0 — MIT. 동작을 그대로 옮겼다.
// 다른 점 하나: 코드·수식 안의 [^n]은 주석으로 보지 않는다(./mask.ts). 코드가 없는 글에서는 원본과 같다.

import { maskCode, unmask } from "./mask";

const MARKER_RE = /\[\^([^\]\s]+)\]/g;
const DEF_LINE_RE = /^\[\^([^\]\s]+)\]:/;
/** 삽입 중인 새 주석을 가리키는 임시 표지. 사용자가 쓸 수 없는 문자다. */
const PENDING_LABEL = "\0";

export interface Marker {
	label: string;
	index: number;
	length: number;
	isDefinition: boolean;
}

export interface TextEdit {
	start: number;
	end: number;
	text: string;
}

interface DefBlock {
	startLine: number;
	endLine: number;
	label: string;
}

/** 본문의 주석 표지. 코드·수식 안의 [^n]은 빼고 찾는다(위치는 원문 기준). */
export function findMarkers(text: string): Marker[] {
	const out: Marker[] = [];
	for (const m of maskCode(text).text.matchAll(MARKER_RE)) {
		const index = m.index ?? 0;
		const atLineStart = index === 0 || text[index - 1] === "\n";
		out.push({
			label: m[1],
			index,
			length: m[0].length,
			isDefinition: atLineStart && text[index + m[0].length] === ":",
		});
	}
	return out;
}

/** 본문 등장 순서대로 번호를 매긴다. 본문에 없는 정의는 그 뒤에 정의 순서대로. */
function numbering(markers: Marker[]): Map<string, string> {
	const refs: string[] = [];
	const defsOnly: string[] = [];
	for (const m of markers) {
		const bucket = m.isDefinition ? defsOnly : refs;
		if (!refs.includes(m.label) && !bucket.includes(m.label)) bucket.push(m.label);
	}
	const order = [...refs, ...defsOnly.filter((l) => !refs.includes(l))];
	return new Map(order.map((label, i) => [label, String(i + 1)]));
}

/** 문서 끝에 새 정의 줄을 붙일 때 앞에 넣을 줄바꿈과 정의 머리. */
function definitionSuffix(text: string, label: string): string {
	const head = `[^${label}]: `;
	if (text.length === 0) return `\n\n${head}`;
	const trimmed = text.replace(/\n+$/, "");
	const trailing = text.length - trimmed.length;
	const lastLine = trimmed.slice(trimmed.lastIndexOf("\n") + 1);
	const need = /^\[\^[^\]\s]+\]:/.test(lastLine) ? 1 : 2;
	return "\n".repeat(Math.max(0, need - trailing)) + head;
}

/** 정의 블록(들여쓴 연속 줄 포함)을 찾는다. */
export function findDefinitionBlocks(lines: string[]): DefBlock[] {
	const out: DefBlock[] = [];
	for (let i = 0; i < lines.length; i++) {
		const m = DEF_LINE_RE.exec(lines[i]);
		if (!m) continue;
		let end = i;
		let j = i + 1;
		while (j < lines.length) {
			if (/^\s+\S/.test(lines[j])) {
				end = j;
				j += 1;
				continue;
			}
			if (lines[j].trim() === "") {
				let k = j;
				while (k < lines.length && lines[k].trim() === "") k += 1;
				if (k < lines.length && /^\s+\S/.test(lines[k])) {
					end = k;
					j = k + 1;
					continue;
				}
			}
			break;
		}
		out.push({ startLine: i, endLine: end, label: m[1] });
		i = end;
	}
	return out;
}

export interface RenumberResult {
	text: string;
	changed: boolean;
	count: number;
	edits: TextEdit[];
}

/** 주석 번호를 본문 등장 순서로 다시 매기고, 연속된 정의 묶음 안에서 번호순으로 정렬한다. */
export function renumberFootnotes(text: string): RenumberResult {
	const m = maskCode(text);
	const r = renumberMasked(m.text);
	if (!m.sentinel) return r;
	return {
		...r,
		text: unmask(r.text, m.sentinel),
		edits: r.edits.map((e) => ({ ...e, text: unmask(e.text, m.sentinel) })),
	};
}

/** 코드·수식 안의 [^가 이미 가려진 글에서 재정렬한다. */
function renumberMasked(text: string): RenumberResult {
	const markers = findMarkers(text);
	const map = numbering(markers);
	const labelEdits: TextEdit[] = [];
	for (const m of markers) {
		const n = map.get(m.label);
		if (n === undefined || n === m.label) continue;
		labelEdits.push({ start: m.index, end: m.index + m.length, text: `[^${n}]` });
	}

	const lines = text.split("\n");
	const lineStart: number[] = [];
	let off = 0;
	for (const l of lines) {
		lineStart.push(off);
		off += l.length + 1;
	}

	// 사이에 본문이 없는 정의끼리 한 묶음으로 본다.
	const groups: DefBlock[][] = [];
	let cur: DefBlock[] = [];
	for (const b of findDefinitionBlocks(lines)) {
		if (cur.length > 0) {
			const prev = cur[cur.length - 1];
			let onlyBlank = true;
			for (let k = prev.endLine + 1; k < b.startLine; k++) {
				if (lines[k].trim() !== "") {
					onlyBlank = false;
					break;
				}
			}
			if (!onlyBlank) {
				groups.push(cur);
				cur = [];
			}
		}
		cur.push(b);
	}
	if (cur.length > 0) groups.push(cur);

	const relabel = (s: string) =>
		s.replace(MARKER_RE, (all, label: string) => {
			const n = map.get(label);
			return n === undefined ? all : `[^${n}]`;
		});
	const rank = (b: DefBlock) => {
		const n = Number(map.get(b.label) ?? b.label);
		return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
	};

	const blockEdits: TextEdit[] = [];
	for (const g of groups) {
		if (g.length < 2) continue;
		const sorted = [...g].sort((a, b) => rank(a) - rank(b));
		if (sorted.every((b, i) => b === g[i])) continue;
		const gaps: string[][] = [];
		for (let i = 0; i < g.length - 1; i++) {
			const gap: string[] = [];
			for (let k = g[i].endLine + 1; k < g[i + 1].startLine; k++) gap.push(lines[k]);
			gaps.push(gap);
		}
		const outLines: string[] = [];
		sorted.forEach((b, i) => {
			for (let k = b.startLine; k <= b.endLine; k++) outLines.push(relabel(lines[k]));
			if (i < gaps.length) outLines.push(...gaps[i]);
		});
		const s = g[0].startLine;
		const e = g[g.length - 1].endLine;
		blockEdits.push({ start: lineStart[s], end: lineStart[e] + lines[e].length, text: outLines.join("\n") });
	}

	const edits = [
		...labelEdits.filter((le) => !blockEdits.some((be) => le.start >= be.start && le.end <= be.end)),
		...blockEdits,
	].sort((a, b) => a.start - b.start);
	return { text: applyEdits(text, edits), changed: edits.length > 0, count: map.size, edits };
}

export function applyEdits(text: string, edits: TextEdit[]): string {
	let out = text;
	for (const e of [...edits].sort((a, b) => b.start - a.start)) {
		out = out.slice(0, e.start) + e.text + out.slice(e.end);
	}
	return out;
}

export interface InsertResult {
	newNumber: number;
	text: string;
	/** 본문 표지 [^n] 바로 뒤 위치(복귀 지점). */
	markerEndOffset: number;
	/** 새 정의의 내용 입력 위치. */
	cursorOffset: number;
}

/** offset 위치에 새 주석을 넣고 번호를 정렬한 문서 전체를 돌려준다. */
export function insertFootnote(text: string, offset: number): InsertResult {
	const withMarker = text.slice(0, offset) + `[^${PENDING_LABEL}]` + text.slice(offset);
	const withDef = withMarker + definitionSuffix(withMarker, PENDING_LABEL);
	const r = renumberFootnotes(withDef);

	const firstRef = new Map<string, number>();
	for (const m of findMarkers(text)) {
		if (!m.isDefinition && !firstRef.has(m.label)) firstRef.set(m.label, m.index);
	}
	let before = 0;
	for (const idx of firstRef.values()) if (idx < offset) before += 1;
	const newNumber = before + 1;

	let shift = 0;
	for (const e of r.edits) if (e.end <= offset) shift += e.text.length - (e.end - e.start);
	const markerStart = offset + shift;
	const def = new RegExp(`^\\[\\^${newNumber}\\]: $`, "m").exec(maskCode(r.text).text);
	return {
		newNumber,
		text: r.text,
		markerEndOffset: markerStart + `[^${newNumber}]`.length,
		cursorOffset: def ? def.index + def[0].length : r.text.length,
	};
}
