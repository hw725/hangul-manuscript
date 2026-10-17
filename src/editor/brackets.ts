// 겹낫표 입력: [ ] { } 를 「 」 『 』 로 바꿔 넣는다.
//  - 켬: 늘 바꾼다.
//  - 자동: Obsidian 문법을 지키고 그 밖의 괄호만 바꾼다(모든 기기 공통, src/editor/context.ts).
//    Windows 데스크톱에서는 여기에 더해 키를 누르는 순간 입력기에 한/영을 물어, 영어면 바꾸지 않는다.
//    한글을 조합하던 중에 누른 괄호는 그 자체로 한글 상태라는 증거라 묻지 않는다.
//    입력기 상태를 못 읽으면(시간 초과·실패) 원래 괄호를 넣는다 — 원본 HanMark와 같은 안전한 폴백.
//  - 바꾼 직후에는 되돌릴 길이 있다: [ ^ ! { 를 이어 누르면 [[ [^ [! {{ 로, 백스페이스면 원래 괄호로.
import { EditorSelection, Prec, type EditorState, type Extension, type Text, type Transaction } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { isLiteralContext, unmatchedOpen } from "./context";

export type BracketMode = "off" | "auto" | "on";

export const BRACKET_MODE_LABEL: Record<BracketMode, string> = { off: "끔", auto: "자동", on: "켬" };

const PAIRS: Record<string, { open: string; close: string; closing: boolean }> = {
	"[": { open: "「", close: "」", closing: false },
	"]": { open: "「", close: "」", closing: true },
	"{": { open: "『", close: "』", closing: false },
	"}": { open: "『", close: "』", closing: true },
};

/** 낫표로 바뀐 직후 이 글자를 누르면 원래 괄호 + 그 글자로 되돌린다. */
const RETRO: Record<string, string[]> = { "[": ["[", "^", "!"], "{": ["{"] };

export function isBracketChar(ch: string): boolean {
	return ch in PAIRS;
}

/** 물리 키(code)와 Shift로 어떤 괄호인지 안다. 조합 중에는 key가 "Process"로 와서 code를 본다. */
export function bracketFromKey(code: string, shift: boolean): string | null {
	if (code === "BracketLeft") return shift ? "{" : "[";
	if (code === "BracketRight") return shift ? "}" : "]";
	return null;
}

export type BracketAction =
	| { kind: "open"; open: string; close: string }
	| { kind: "wrap"; open: string; close: string }
	| { kind: "insert"; text: string }
	| { kind: "skip" };

export interface BracketContext {
	autoClose: boolean;
	hasSelection: boolean;
	/** 모든 커서 바로 뒤 글자가 닫는 낫표인가 */
	closeFollows: boolean;
}

/** 원본 HanMark의 insertBracket과 같은 판단(변환하기로 정한 뒤의 동작). */
export function bracketAction(ch: string, ctx: BracketContext): BracketAction | null {
	const p = PAIRS[ch];
	if (!p) return null;
	if (!p.closing) {
		if (ctx.hasSelection) return { kind: "wrap", open: p.open, close: p.close };
		return ctx.autoClose ? { kind: "open", open: p.open, close: p.close } : { kind: "insert", text: p.open };
	}
	if (ctx.autoClose && !ctx.hasSelection && ctx.closeFollows) return { kind: "skip" };
	return { kind: "insert", text: p.close };
}

/** 방금 바꿔 넣은 여는 낫표. 문서·커서가 그대로일 때만 되돌리기에 쓴다. */
export interface LastConversion {
	doc: Text;
	head: number;
	from: number;
	to: number;
	literal: string;
}

export type AutoOutcome =
	| { kind: "convert" }
	| { kind: "literal" }
	| { kind: "ask-ime" }
	| { kind: "retro"; replay: string[] }
	| null;

function closeFollows(state: EditorState, ch: string): boolean {
	const p = PAIRS[ch];
	return !!p && state.selection.ranges.every((r) => state.sliceDoc(r.head, r.head + 1) === p.close);
}

function stillFresh(state: EditorState, last: LastConversion | null): last is LastConversion {
	return !!last && state.doc === last.doc && state.selection.ranges.length === 1 && state.selection.main.empty && state.selection.main.head === last.head;
}

/**
 * 자동 모드에서 글자 하나를 어떻게 처리할지 정한다(입력기 질의 전 단계).
 * null이면 이 확장이 관여하지 않는다.
 */
export function autoDecide(state: EditorState, ch: string, last: LastConversion | null, imeAvailable: boolean): AutoOutcome {
	if (stillFresh(state, last) && RETRO[last.literal]?.includes(ch)) return { kind: "retro", replay: [last.literal, ch] };
	const p = PAIRS[ch];
	if (!p) return null;
	const head = state.selection.main.head;
	const before = state.sliceDoc(0, head);
	if (isLiteralContext(before, ch)) return { kind: "literal" };
	if (p.closing && !closeFollows(state, ch) && !unmatchedOpen(before, p.open, p.close)) return { kind: "literal" };
	return imeAvailable ? { kind: "ask-ime" } : { kind: "convert" };
}

export function bracketTransaction(state: EditorState, ch: string, autoClose: boolean): Transaction | { skipTo: EditorSelection } | null {
	const p = PAIRS[ch];
	if (!p) return null;
	const sel = state.selection;
	const action = bracketAction(ch, {
		autoClose,
		hasSelection: sel.ranges.some((r) => !r.empty),
		closeFollows: closeFollows(state, ch),
	});
	if (!action) return null;
	if (action.kind === "skip") {
		return { skipTo: EditorSelection.create(sel.ranges.map((r) => EditorSelection.cursor(r.head + 1)), sel.mainIndex) };
	}
	const spec = state.changeByRange((r) => {
		if (action.kind === "wrap") {
			if (r.empty) return { range: r };
			return {
				changes: [
					{ from: r.from, insert: action.open },
					{ from: r.to, insert: action.close },
				],
				range: EditorSelection.range(r.from + action.open.length, r.to + action.open.length),
			};
		}
		const text = action.kind === "open" ? action.open + action.close : action.text;
		const caret = action.kind === "open" ? action.open.length : text.length;
		return { changes: { from: r.from, to: r.to, insert: text }, range: EditorSelection.cursor(r.from + caret) };
	});
	return state.update(spec, { userEvent: "input.type", scrollIntoView: true });
}

/** 되돌리기: 바꿔 넣은 낫표(와 짝)를 지운 상태. 그 뒤 원래 글자들을 다시 친다. */
export function revertTransaction(state: EditorState, last: LastConversion, insert = ""): Transaction {
	return state.update({
		changes: { from: last.from, to: last.to, insert },
		selection: { anchor: last.from + insert.length },
		userEvent: "input.type",
	});
}

export interface BracketHost {
	mode(): BracketMode;
	autoClose(): boolean;
	probe: {
		readonly available: boolean;
		isKoreanMode(): Promise<boolean | null>;
	};
}

export function bracketExtension(host: BracketHost): Extension {
	let last: LastConversion | null = null;
	/** 조합 중에 누른 괄호. 입력기가 조합을 끝내며 넣는 그 괄호를 바꾼다. */
	let fromComposition: string | null = null;
	/** 질의 중인 괄호 키 — 그동안 들어온 키는 순서대로 뒤에 붙인다. */
	let queue: Promise<void> = Promise.resolve();

	const passThrough = (view: EditorView, ch: string) => {
		// 기본 타이핑과 같게: 다른 입력 처리기(괄호 짝 맞추기 등)에 먼저 맡기고, 없으면 그대로 넣는다.
		const { from, to } = view.state.selection.main;
		const insert = () => view.state.update({ changes: { from, to, insert: ch }, selection: { anchor: from + ch.length }, userEvent: "input.type", scrollIntoView: true });
		for (const h of view.state.facet(EditorView.inputHandler)) {
			if (h === inputHandlerFn) continue;
			if (h(view, from, to, ch, insert)) return;
		}
		view.dispatch(insert());
	};

	const convert = (view: EditorView, ch: string) => {
		const r = bracketTransaction(view.state, ch, host.autoClose());
		if (!r) return;
		if ("skipTo" in r) {
			view.dispatch({ selection: r.skipTo, userEvent: "select" });
			last = null;
			return;
		}
		const from = view.state.selection.main.from;
		const single = view.state.selection.ranges.length === 1 && view.state.selection.main.empty;
		view.dispatch(r);
		const p = PAIRS[ch];
		last =
			single && p && !p.closing
				? { doc: view.state.doc, head: view.state.selection.main.head, from, to: from + (host.autoClose() ? 2 : 1), literal: ch }
				: null;
	};

	const retro = (view: EditorView, replay: string[]) => {
		const l = last;
		last = null;
		if (!l) return;
		view.dispatch(revertTransaction(view.state, l));
		for (const c of replay) passThrough(view, c);
	};

	/** 자동 모드 한 글자 처리. 처리했으면 true. */
	const handleAuto = (view: EditorView, ch: string, viaKeydown: boolean): boolean => {
		const out = autoDecide(view.state, ch, last, host.probe.available && viaKeydown);
		if (!out) {
			last = null;
			return false;
		}
		if (out.kind === "retro") {
			retro(view, out.replay);
			return true;
		}
		if (out.kind === "literal") {
			last = null;
			if (!viaKeydown) return false;
			passThrough(view, ch);
			return true;
		}
		if (out.kind === "convert") {
			convert(view, ch);
			return true;
		}
		queue = queue.then(async () => {
			const korean = await host.probe.isKoreanMode();
			if (korean === true) convert(view, ch);
			else {
				last = null;
				passThrough(view, ch);
			}
		});
		return true;
	};

	const inputHandlerFn = (view: EditorView, _from: number, _to: number, text: string): boolean => {
		if (text.length !== 1) {
			last = null;
			return false;
		}
		const m = host.mode();
		if (m === "on") {
			if (!isBracketChar(text)) return false;
			convert(view, text);
			return true;
		}
		if (m !== "auto") return false;
		if (fromComposition === text) {
			fromComposition = null;
			convert(view, text);
			return true;
		}
		// Windows 데스크톱의 괄호 키는 keydown에서 처리한다. 여기 오는 것은 그 밖의 기기·입력 경로다.
		return handleAuto(view, text, false);
	};

	const keys = EditorView.domEventHandlers({
		keydown(e, view) {
			if (host.mode() !== "auto" || !host.probe.available || e.ctrlKey || e.metaKey || e.altKey) return false;
			const ch = bracketFromKey(e.code, e.shiftKey);
			if (!ch) return false;
			if (e.isComposing || e.keyCode === 229 || view.composing) {
				// 조합 중 = 한글 상태. 문법 문맥만 보고 정한다.
				const out = autoDecide(view.state, ch, null, false);
				fromComposition = out?.kind === "convert" ? ch : null;
				return false;
			}
			if (!handleAuto(view, ch, true)) return false;
			e.preventDefault();
			return true;
		},
		compositionend(_e, view) {
			// 입력기가 「글자+괄호」를 조합 결과로 한꺼번에 넣으면 입력 처리기를 거치지 않는다. 그때는 넣은 뒤 바꾼다.
			const ch = fromComposition;
			if (!ch) return false;
			window.setTimeout(() => {
				if (fromComposition !== ch) return;
				fromComposition = null;
				const head = view.state.selection.main.head;
				if (view.state.sliceDoc(head - 1, head) !== ch) return;
				view.dispatch({ changes: { from: head - 1, to: head }, selection: { anchor: head - 1 }, userEvent: "delete" });
				convert(view, ch);
			}, 30);
			return false;
		},
	});

	const backspace = keymap.of([
		{
			key: "Backspace",
			run: (view) => {
				if (!stillFresh(view.state, last)) return false;
				const l = last;
				last = null;
				view.dispatch(revertTransaction(view.state, l, l.literal));
				return true;
			},
		},
	]);

	return [Prec.highest(EditorView.inputHandler.of(inputHandlerFn)), Prec.highest(keys), Prec.highest(backspace)];
}
