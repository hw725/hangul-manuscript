import { EditorView } from "@codemirror/view";
import {
	type App,
	type Editor,
	type EditorPosition,
	MarkdownView,
	Menu,
	Modal,
	Notice,
	Platform,
	Plugin,
	Setting,
	SuggestModal,
	TFile,
	normalizePath,
} from "obsidian";
import templateDefault from "../assets/template-default.hwpx";
import { applyEdits, insertFootnote, renumberFootnotes } from "./core/footnotes";
import { markdownToHwpx } from "./core/hwpx";
import { countManuscript } from "./core/markdown";
import { applyParagraphStyle, convertWidth, normalizeQuoteStyle, type ParagraphStyle, type WidthDirection } from "./core/text";
import { type BracketMode, bracketExtension } from "./editor/brackets";
import { ImeProbe } from "./editor/ime-windows";
import { mobileMenuModel } from "./editor/mobile-menu";
import {
	BRACKET_MODE_LABEL,
	DEFAULT_SETTINGS,
	type HangulManuscriptSettings,
	HangulManuscriptSettingTab,
	LINE_BREAK_DETAIL,
	LINE_BREAK_LABEL,
	type LineBreakMode,
} from "./settings";

const BREAK_CLASSES: Record<Exclude<LineBreakMode, "off">, string> = {
	character: "hangul-manuscript-break-character",
	word: "hangul-manuscript-break-word",
};

interface SaveCommand {
	checkCallback?: (checking: boolean) => boolean | void;
	callback?: () => unknown;
}

export default class HangulManuscriptPlugin extends Plugin {
	settings: HangulManuscriptSettings = { ...DEFAULT_SETTINGS };
	private bracketItem: HTMLElement | null = null;
	private countItem: HTMLElement | null = null;
	private countTimer: number | null = null;
	private footnoteReturn: { path: string; offset: number } | null = null;
	private readonly probe = new ImeProbe();
	private settingTab: HangulManuscriptSettingTab | null = null;
	/** 모바일: 노트마다 머리에 붙인 단추(상태 표시줄 대신) */
	private readonly mobileActions = new Map<MarkdownView, HTMLElement>();

	async onload() {
		await this.loadSettings();
		this.settingTab = new HangulManuscriptSettingTab(this.app, this);
		this.addSettingTab(this.settingTab);
		this.register(() => this.probe.dispose());
		if (this.settings.bracketMode === "auto") this.probe.warmUp();

		this.registerEditorExtension([
			bracketExtension({ mode: () => this.settings.bracketMode, autoClose: () => this.settings.autoClosingBrackets, probe: this.probe }),
			EditorView.updateListener.of((u) => {
				if (u.selectionSet || u.docChanged) this.scheduleCount();
			}),
		]);

		this.bracketItem = this.addStatusBarItem();
		this.bracketItem.addClass("mod-clickable");
		this.bracketItem.setAttribute("aria-label", "겹낫표 입력 모드 — 눌러서 전환");
		this.registerDomEvent(this.bracketItem, "click", () => void this.cycleBracketMode());
		this.countItem = this.addStatusBarItem();
		this.countItem.addClass("mod-clickable");
		this.registerDomEvent(this.countItem, "click", () => this.showManuscriptDetail());

		this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.scheduleCount()));
		this.registerEvent(this.app.workspace.on("editor-change", () => this.scheduleCount()));
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (this.footnoteReturn?.path === oldPath) this.footnoteReturn.path = file.path;
			}),
		);

		if (Platform.isMobile) {
			// 모바일에는 상태 표시줄이 없다 — 노트 머리 단추로 모드·원고지 매수를 보인다.
			this.registerEvent(this.app.workspace.on("layout-change", () => this.attachMobileActions()));
			this.app.workspace.onLayoutReady(() => this.attachMobileActions());
			this.register(() => {
				for (const el of this.mobileActions.values()) el.remove();
				this.mobileActions.clear();
			});
		}

		this.registerCommands();
		this.app.workspace.onLayoutReady(() => this.wrapSaveCommand());
		this.applyLineBreak();
		this.refreshBracketItem();
		this.scheduleCount();
	}

	onunload() {
		document.body.removeClasses(Object.values(BREAK_CLASSES));
		if (this.countTimer !== null) window.clearTimeout(this.countTimer);
	}

	async loadSettings() {
		const data = ((await this.loadData()) ?? {}) as Partial<HangulManuscriptSettings>;
		this.settings = { ...DEFAULT_SETTINGS, ...data };
		this.settings.hwpxDoubleQuotes = normalizeQuoteStyle(this.settings.hwpxDoubleQuotes);
		this.settings.hwpxSingleQuotes = normalizeQuoteStyle(this.settings.hwpxSingleQuotes);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		if (this.settings.bracketMode === "auto") this.probe.warmUp();
		this.applyLineBreak();
		this.refreshBracketItem();
		this.scheduleCount();
	}

	// ── 명령 ──────────────────────────────────────────────

	private registerCommands() {
		this.addCommand({
			id: "toggle-bracket-mode",
			name: "겹낫표 입력 모드 전환 (끔 → 자동 → 켬)",
			callback: () => void this.cycleBracketMode(),
		});
		this.addCommand({
			id: "diagnose-ime",
			name: "입력기 한/영 상태 진단 (Windows)",
			callback: () => void this.showImeDiagnosis(),
		});
		this.addCommand({
			id: "insert-footnote",
			name: "각주 넣기 (번호 자동 정렬)",
			editorCallback: (editor, ctx) => {
				if (ctx.file) this.insertFootnoteAt(editor, ctx.file);
			},
		});
		this.addCommand({
			id: "return-from-footnote",
			name: "각주에서 본문으로 돌아가기",
			editorCheckCallback: (checking, editor, ctx) => {
				const r = this.footnoteReturn;
				if (!r || !ctx.file || r.path !== ctx.file.path) return false;
				if (!checking) {
					const pos = editor.offsetToPos(Math.min(r.offset, editor.getValue().length));
					editor.setCursor(pos);
					editor.scrollIntoView({ from: pos, to: pos }, true);
				}
				return true;
			},
		});
		this.addCommand({
			id: "renumber-footnotes",
			name: "각주 번호 재정렬",
			editorCallback: (editor) => {
				const r = this.renumberEditor(editor);
				new Notice(r.changed ? `각주 ${r.count}개 번호 재정렬 완료` : r.count === 0 ? "각주가 없습니다" : "각주 번호가 이미 정렬되어 있습니다", 2000);
			},
		});

		const styles: { id: string; name: string; style: ParagraphStyle }[] = [
			{ id: "style-body", name: "문단 스타일: 바탕글", style: { kind: "body" } },
			{ id: "style-quote", name: "문단 스타일: 인용문", style: { kind: "quote" } },
		];
		for (let level = 1; level <= 6; level++) {
			styles.push({ id: `style-heading-${level}`, name: `문단 스타일: 제목 ${level}`, style: { kind: "heading", level } });
		}
		for (const s of styles) {
			this.addCommand({ id: s.id, name: s.name, editorCallback: (editor) => this.applyStyle(editor, s.style) });
		}

		this.addCommand({
			id: "export-hwpx",
			name: "HWPX로 내보내기",
			editorCallback: (editor, ctx) => {
				if (ctx.file) void this.exportHwpx(ctx.file, editor.getValue(), false);
			},
		});
		this.addCommand({
			id: "convert-width",
			name: "반각/전각 일괄 변환 (영숫자·문장부호)",
			editorCallback: (editor) => new WidthModal(this.app, (d) => this.convertWidthIn(editor, d)).open(),
		});
		this.addCommand({
			id: "set-line-break",
			name: "한글 줄바꿈 단위",
			callback: () =>
				new LineBreakModal(this.app, this.settings.koreanLineBreak, async (mode) => {
					this.settings.koreanLineBreak = mode;
					await this.saveSettings();
					new Notice(`한글 줄바꿈: ${LINE_BREAK_LABEL[mode]}`, 2000);
				}).open(),
		});
		this.addCommand({
			id: "manuscript-detail",
			name: "원고지 분량 자세히 보기",
			editorCallback: () => this.showManuscriptDetail(),
		});
	}

	imeProbeAvailable(): boolean {
		return this.probe.available;
	}

	/** 끔 → 자동 → 켬 */
	private async cycleBracketMode() {
		const order: BracketMode[] = ["off", "auto", "on"];
		const i = order.indexOf(this.settings.bracketMode);
		await this.setBracketMode(order[(i + 1) % order.length]);
	}

	private async setBracketMode(mode: BracketMode) {
		this.settings.bracketMode = mode;
		await this.saveSettings();
		this.settingTab?.refresh();
		new Notice(`겹낫표 입력: ${BRACKET_MODE_LABEL[mode]}`, 1500);
	}

	// ── 모바일 노트 머리 단추 ─────────────────────────────

	private attachMobileActions() {
		this.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view;
			if (!(view instanceof MarkdownView) || this.mobileActions.has(view)) return;
			const el = view.addAction("quote", "겹낫표·원고지", (evt) => this.openMobileMenu(evt));
			el.addClass("hangul-manuscript-mobile-action");
			this.mobileActions.set(view, el);
		});
		this.refreshMobileActions();
	}

	private refreshMobileActions() {
		if (this.mobileActions.size === 0) return;
		const m = mobileMenuModel(this.settings.bracketMode, this.activeSheets());
		for (const [view, el] of this.mobileActions) {
			if (!el.isConnected) {
				this.mobileActions.delete(view);
				continue;
			}
			el.setText(m.badge);
			el.setAttribute("aria-label", m.title);
		}
	}

	private openMobileMenu(evt: MouseEvent) {
		const m = mobileMenuModel(this.settings.bracketMode, this.activeSheets());
		const menu = new Menu();
		for (const x of m.modes) {
			menu.addItem((item) => item.setTitle(x.label).setChecked(x.checked).onClick(() => void this.setBracketMode(x.mode)));
		}
		if (m.countLabel) {
			const label = m.countLabel;
			menu.addSeparator();
			menu.addItem((item) => item.setTitle(label).setIcon("file-text").onClick(() => this.showManuscriptDetail()));
		}
		menu.showAtMouseEvent(evt);
	}

	/** 지금 노트(또는 선택 영역)의 원고지 매수. 마크다운 노트가 아니거나 표시를 끈 때는 null. */
	private activeSheets(): number | null {
		if (!this.settings.showManuscriptCount) return null;
		const t = this.countTarget();
		return t ? countManuscript(t.text).sheets : null;
	}

	private async showImeDiagnosis() {
		if (!this.probe.available) {
			new Notice("입력기 상태 조회는 Windows 데스크톱에서만 됩니다. 이 기기의 자동 모드는 문맥 규칙(Obsidian 문법 보호)만 씁니다.");
			return;
		}
		const raw = await this.probe.debugInfo();
		const korean = await this.probe.isKoreanMode(3000);
		const verdict = korean === null ? "알 수 없음(자동 모드에서는 원래 괄호를 넣음)" : korean ? "한글" : "영어";
		new Notice(`입력기 상태: ${verdict}\n원시 값: ${raw ?? "응답 없음"}`, 8000);
	}

	private insertFootnoteAt(editor: Editor, file: TFile) {
		const before = editor.getValue();
		const r = insertFootnote(before, editor.posToOffset(editor.getCursor()));
		replaceDiff(editor, before, r.text);
		this.footnoteReturn = { path: file.path, offset: r.markerEndOffset };
		const pos = editor.offsetToPos(r.cursorOffset);
		editor.setCursor(pos);
		editor.scrollIntoView({ from: pos, to: pos }, true);
		new Notice(`각주 [^${r.newNumber}] 삽입 — 「각주에서 본문으로 돌아가기」로 복귀`, 3000);
	}

	private renumberEditor(editor: Editor) {
		const text = editor.getValue();
		const r = renumberFootnotes(text);
		if (r.changed) {
			// 커서는 그 앞의 편집 길이만큼 옮겨 제자리에 둔다.
			const cursor = editor.posToOffset(editor.getCursor());
			let shift = 0;
			for (const e of r.edits) if (e.end <= cursor) shift += e.text.length - (e.end - e.start);
			editor.transaction({
				changes: r.edits.map((e) => ({ from: editor.offsetToPos(e.start), to: editor.offsetToPos(e.end), text: e.text })),
			});
			editor.setCursor(editor.offsetToPos(Math.min(cursor + shift, applyEdits(text, r.edits).length)));
		}
		return r;
	}

	private applyStyle(editor: Editor, style: ParagraphStyle) {
		const lines = new Set<number>();
		for (const sel of editor.listSelections()) {
			const a = Math.min(sel.anchor.line, sel.head.line);
			const b = Math.max(sel.anchor.line, sel.head.line);
			for (let l = a; l <= b; l++) lines.add(l);
		}
		const changes = [];
		for (const l of lines) {
			const old = editor.getLine(l);
			const next = applyParagraphStyle(old, style);
			if (next !== old) changes.push({ from: { line: l, ch: 0 }, to: { line: l, ch: old.length }, text: next });
		}
		if (changes.length > 0) editor.transaction({ changes });
	}

	private convertWidthIn(editor: Editor, direction: WidthDirection) {
		const hasSelection = editor.somethingSelected();
		const run = () => {
			const text = hasSelection ? editor.getSelection() : editor.getValue();
			const r = convertWidth(text, direction);
			if (r.converted === 0) {
				new Notice("바꿀 문자가 없습니다", 2000);
				return;
			}
			if (hasSelection) editor.replaceSelection(r.text);
			else replaceDiff(editor, text, r.text);
			new Notice(`${hasSelection ? "선택 영역" : "문서 전체"}에서 ${r.converted}자 변환`, 3000);
		};
		if (!hasSelection && direction === "toFull") {
			new ConfirmModal(
				this.app,
				"문서 전체의 반각 문자를 전각으로 바꿉니다. 마크다운 문법 기호(#, *, [, ] 등)도 함께 바뀌어 문서 구조가 깨질 수 있습니다.",
				"그래도 진행",
				run,
			).open();
		} else run();
	}

	// ── 저장 훅 ──────────────────────────────────────────

	/** Obsidian은 저장 이벤트를 따로 주지 않으므로 저장 명령(editor:save-file)을 감싼다. 언로드 때 되돌린다. */
	private wrapSaveCommand() {
		const registry = (this.app as unknown as { commands?: { commands?: Record<string, SaveCommand> } }).commands?.commands;
		const save = registry?.["editor:save-file"];
		if (!save) return;
		const originalCheck = save.checkCallback;
		const originalCallback = save.callback;
		if (originalCheck) {
			save.checkCallback = (checking: boolean) => {
				if (!checking) this.beforeSave();
				const result = originalCheck.call(save, checking);
				if (!checking) this.afterSave();
				return result;
			};
		} else if (originalCallback) {
			save.callback = () => {
				this.beforeSave();
				const result = originalCallback.call(save);
				this.afterSave();
				return result;
			};
		} else return;
		this.register(() => {
			save.checkCallback = originalCheck;
			save.callback = originalCallback;
		});
	}

	private activeMarkdown(): { editor: Editor; file: TFile } | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		return view?.file ? { editor: view.editor, file: view.file } : null;
	}

	private beforeSave() {
		const a = this.activeMarkdown();
		if (a && this.settings.autoRenumberOnSave) this.renumberEditor(a.editor);
	}

	private afterSave() {
		const a = this.activeMarkdown();
		if (a && this.settings.exportHwpxOnSave) void this.exportHwpx(a.file, a.editor.getValue(), true);
	}

	// ── HWPX ─────────────────────────────────────────────

	private async readTemplate(): Promise<Uint8Array | null> {
		const path = this.settings.hwpxTemplate.trim();
		if (!path) return templateDefault;
		const f = this.app.vault.getFileByPath(normalizePath(path));
		if (!f) {
			new Notice(`hwpx 템플릿을 찾을 수 없습니다: ${path} — 설정의 「기준 템플릿」을 확인하세요.`);
			return null;
		}
		return new Uint8Array(await this.app.vault.readBinary(f));
	}

	private async readImage(src: string, wiki: boolean, note: TFile): Promise<Uint8Array | undefined> {
		if (/^[a-z]+:\/\//i.test(src)) return undefined;
		let link = src;
		try {
			link = decodeURI(src);
		} catch {
			// 잘못된 % 인코딩이면 원문 그대로 찾는다.
		}
		let file: TFile | null = null;
		if (!wiki) {
			const dir = note.parent?.path ?? "";
			file = this.app.vault.getFileByPath(normalizePath(dir && dir !== "/" ? `${dir}/${link}` : link));
		}
		file ??= this.app.metadataCache.getFirstLinkpathDest(link.replace(/#.*$/, ""), note.path);
		if (!file) return undefined;
		return new Uint8Array(await this.app.vault.readBinary(file));
	}

	async exportHwpx(file: TFile, markdown: string, quiet: boolean) {
		if (file.extension !== "md") {
			if (!quiet) new Notice("HWPX 내보내기는 마크다운 노트에서만 동작합니다.");
			return;
		}
		const template = await this.readTemplate();
		if (!template) return;
		const s = this.settings;
		const outPath = normalizePath(`${file.parent && file.parent.path !== "/" ? file.parent.path + "/" : ""}${file.basename}.hwpx`);
		try {
			const bytes = await markdownToHwpx(markdown, template, {
				noteType: s.hwpxNoteType,
				readImage: (src, wiki) => this.readImage(src, wiki, file),
				imageWidthInch: s.hwpxImageWidthInch,
				halfwidthBrackets: s.hwpxHalfwidthBrackets,
				quoteBlankLines: s.hwpxQuoteBlankLines,
				doubleQuotes: s.hwpxDoubleQuotes,
				singleQuotes: s.hwpxSingleQuotes,
			});
			const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
			const existing = this.app.vault.getFileByPath(outPath);
			if (existing) await this.app.vault.modifyBinary(existing, data);
			else await this.app.vault.createBinary(outPath, data);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			const hint = /EBUSY|EPERM/.test(msg) ? " (한컴오피스에서 해당 파일이 열려 있으면 닫고 다시 시도하세요)" : "";
			new Notice(`HWPX 내보내기 실패: ${msg}${hint}`);
			return;
		}
		new Notice(`HWPX 내보내기 완료: ${outPath}`, quiet ? 2000 : 4000);
	}

	// ── 상태 표시줄 ──────────────────────────────────────

	private refreshBracketItem() {
		this.bracketItem?.setText(`「」 ${BRACKET_MODE_LABEL[this.settings.bracketMode]}`);
		this.refreshMobileActions();
	}

	private scheduleCount() {
		if (this.countTimer !== null) window.clearTimeout(this.countTimer);
		this.countTimer = window.setTimeout(() => {
			this.countTimer = null;
			this.refreshCount();
		}, 300);
	}

	private countTarget(): { text: string; selected: boolean } | null {
		const a = this.activeMarkdown();
		if (!a) return null;
		const selected = a.editor.somethingSelected();
		return { text: selected ? a.editor.getSelection() : a.editor.getValue(), selected };
	}

	private refreshCount() {
		this.refreshMobileActions();
		const item = this.countItem;
		if (!item) return;
		const t = this.settings.showManuscriptCount ? this.countTarget() : null;
		if (!t) {
			item.hide();
			return;
		}
		const c = countManuscript(t.text);
		item.setText(`${t.selected ? "선택 " : ""}원고지 ${c.sheets.toFixed(1)}매`);
		item.setAttribute(
			"aria-label",
			`200자 원고지 ${c.sheets.toFixed(1)}매 (${c.rows}줄)\n글자 ${c.chars.toLocaleString()}자(공백 제외 ${c.charsNoSpace.toLocaleString()}자, 영문 ${c.latinChars.toLocaleString()}자) · 어절 ${c.words.toLocaleString()}개`,
		);
		item.show();
	}

	private showManuscriptDetail() {
		const t = this.countTarget();
		if (!t) {
			new Notice("원고지 분량은 마크다운 노트에서 계산합니다.");
			return;
		}
		const c = countManuscript(t.text);
		new Notice(
			`${t.selected ? "선택 영역" : "문서 전체"}: 200자 원고지 ${c.sheets.toFixed(1)}매 (${c.rows}줄)\n` +
				`글자 ${c.chars.toLocaleString()}자 (공백 제외 ${c.charsNoSpace.toLocaleString()}자, 영문 ${c.latinChars.toLocaleString()}자) · 어절 ${c.words.toLocaleString()}개\n` +
				"한글(HWP) 문서통계 호환: 영문자 반 칸, 각주 포함, 마크다운 문법·빈 줄 제외",
			8000,
		);
	}

	private applyLineBreak() {
		document.body.removeClasses(Object.values(BREAK_CLASSES));
		const mode = this.settings.koreanLineBreak;
		if (mode !== "off") document.body.addClass(BREAK_CLASSES[mode]);
	}
}

/** 앞뒤 공통 부분을 남기고 가운데만 바꿔, 실행 취소 한 번·스크롤 유지가 되게 한다. */
function replaceDiff(editor: Editor, before: string, after: string) {
	if (before === after) return;
	let start = 0;
	const max = Math.min(before.length, after.length);
	while (start < max && before[start] === after[start]) start++;
	let end = 0;
	while (end < max - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end++;
	const from: EditorPosition = editor.offsetToPos(start);
	const to: EditorPosition = editor.offsetToPos(before.length - end);
	editor.replaceRange(after.slice(start, after.length - end), from, to);
}

class WidthModal extends SuggestModal<{ label: string; detail: string; direction: WidthDirection }> {
	constructor(
		app: App,
		private readonly onChoose: (d: WidthDirection) => void,
	) {
		super(app);
		this.setPlaceholder("선택 영역이 있으면 그 안에서만, 없으면 문서 전체에서 바꿉니다");
	}
	getSuggestions() {
		return [
			{ label: "전각 → 반각", detail: "ＡＢ１！　→ AB1! — 영인본 OCR·일본어권 자료의 전각 영숫자·문장부호를 정리", direction: "toHalf" as const },
			{ label: "반각 → 전각", detail: "A1! → Ａ１！ — 마크다운 문법 기호까지 바뀌니 선택 영역에만 쓰기를 권함", direction: "toFull" as const },
		];
	}
	renderSuggestion(item: { label: string; detail: string }, el: HTMLElement) {
		el.createDiv({ text: item.label });
		el.createEl("small", { text: item.detail, cls: "hangul-manuscript-detail" });
	}
	onChooseSuggestion(item: { direction: WidthDirection }) {
		this.onChoose(item.direction);
	}
}

class LineBreakModal extends SuggestModal<LineBreakMode> {
	constructor(
		app: App,
		private readonly current: LineBreakMode,
		private readonly onChoose: (m: LineBreakMode) => void | Promise<void>,
	) {
		super(app);
		this.setPlaceholder("마크다운 노트의 자동 줄바꿈을 어떻게 끊을지 고르세요");
	}
	getSuggestions(): LineBreakMode[] {
		return ["character", "word", "off"];
	}
	renderSuggestion(mode: LineBreakMode, el: HTMLElement) {
		el.createDiv({ text: LINE_BREAK_LABEL[mode] + (mode === this.current ? " (현재 설정)" : "") });
		el.createEl("small", { text: LINE_BREAK_DETAIL[mode], cls: "hangul-manuscript-detail" });
	}
	onChooseSuggestion(mode: LineBreakMode) {
		void this.onChoose(mode);
	}
}

class ConfirmModal extends Modal {
	constructor(
		app: App,
		private readonly message: string,
		private readonly confirmText: string,
		private readonly onConfirm: () => void,
	) {
		super(app);
	}
	onOpen() {
		this.contentEl.createEl("p", { text: this.message });
		new Setting(this.contentEl)
			.addButton((b) => {
				b.setButtonText(this.confirmText).onClick(() => {
					this.close();
					this.onConfirm();
				});
				// 1.13+는 setDestructive, 그 전 버전은 setWarning.
				const destructive = (b as unknown as { setDestructive?: () => unknown }).setDestructive;
				if (typeof destructive === "function") destructive.call(b);
				else b.setWarning();
			})
			.addButton((b) => b.setButtonText("취소").onClick(() => this.close()));
	}
	onClose() {
		this.contentEl.empty();
	}
}
