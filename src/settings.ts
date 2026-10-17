import { type App, PluginSettingTab, Setting, type SettingDefinitionItem, type TFile } from "obsidian";
import type { BracketMode } from "./editor/brackets";
import type { NoteType } from "./core/hwpx";
import type { QuoteStyle } from "./core/text";
import type HangulManuscriptPlugin from "./main";

export type LineBreakMode = "character" | "word" | "off";

export interface HangulManuscriptSettings {
	bracketMode: BracketMode;
	autoClosingBrackets: boolean;
	koreanLineBreak: LineBreakMode;
	showManuscriptCount: boolean;
	autoRenumberOnSave: boolean;
	hwpxHalfwidthBrackets: boolean;
	hwpxDoubleQuotes: QuoteStyle;
	hwpxSingleQuotes: QuoteStyle;
	hwpxQuoteBlankLines: boolean;
	hwpxNoteType: NoteType;
	hwpxImageWidthInch: number;
	/** vault 안 경로. 비우면 내장 기본 템플릿. */
	hwpxTemplate: string;
	exportHwpxOnSave: boolean;
}

export const DEFAULT_SETTINGS: HangulManuscriptSettings = {
	bracketMode: "off",
	autoClosingBrackets: true,
	koreanLineBreak: "character",
	showManuscriptCount: true,
	autoRenumberOnSave: true,
	hwpxHalfwidthBrackets: false,
	hwpxDoubleQuotes: "curly",
	hwpxSingleQuotes: "curly",
	hwpxQuoteBlankLines: true,
	hwpxNoteType: "footnote",
	hwpxImageWidthInch: 6,
	hwpxTemplate: "",
	exportHwpxOnSave: false,
};

export { BRACKET_MODE_LABEL } from "./editor/brackets";

export const LINE_BREAK_LABEL: Record<LineBreakMode, string> = {
	character: "글자 단위",
	word: "어절 단위",
	off: "관리 안 함",
};

export const LINE_BREAK_DETAIL: Record<LineBreakMode, string> = {
	character: "한글이 음절 단위로 끊깁니다 — 오른쪽 여백이 가지런합니다",
	word: "한글이 공백(어절) 단위로 끊깁니다 — 낱말이 잘리지 않습니다",
	off: "줄바꿈 관련 스타일을 플러그인이 건드리지 않습니다(테마 설정을 따름)",
};

type Key = keyof HangulManuscriptSettings;

/** 설정 한 줄의 정의. 1.13+ 선언형 정의와 구버전 display()가 모두 이 표에서 만들어진다. */
type Field =
	| { key: Key; name: string; desc: string; kind: "toggle" }
	| { key: Key; name: string; desc: string; kind: "dropdown"; options: () => Record<string, string>; validate?: (v: string) => string | void }
	| { key: Key; name: string; desc: string; kind: "number"; min: number; max: number; step: number }
	| { key: Key; name: string; desc: string; kind: "hwpxFile"; placeholder: string };

interface Group {
	heading: string;
	fields: Field[];
}

const quoteOptions = (open: string, close: string, straight: string): Record<QuoteStyle, string> => ({
	curly: `둥근 따옴표 ${open} ${close}`,
	keep: "원문 그대로",
	straight: `곧은 따옴표 ${straight} ${straight}`,
});

/** 저장값과 화면값이 다른 항목(불리언을 두 선택지로 보여 주는 것). */
const HALF_KEY: Key = "hwpxHalfwidthBrackets";

export class HangulManuscriptSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: HangulManuscriptPlugin,
	) {
		super(app, plugin);
	}

	private groups(): Group[] {
		const autoOk = this.plugin.imeProbeAvailable();
		return [
			{
				heading: "입력",
				fields: [
					{
						key: "bracketMode",
						name: "겹낫표 입력 모드",
						desc:
							"[ ] { } 를 「 」 『 』 로 바꿔 넣습니다. 자동은 [[링크]]·[^각주]·- [ ] 할 일·코드·수식처럼 Obsidian 문법이 되는 괄호는 그대로 두고, 바꾼 직후 [ ^ ! 를 이어 치거나 백스페이스를 누르면 원래 괄호로 되돌립니다." +
							(autoOk ? " 이 기기(Windows)에서는 입력기에 한/영도 물어 영어 입력 중이면 바꾸지 않습니다." : ""),
						kind: "dropdown",
						options: () => ({
							off: "끔 — [ ] { } 그대로",
							auto: "자동 — 문법 괄호는 그대로",
							on: "켬 — 항상 「」 『』",
						}),
					},
					{ key: "autoClosingBrackets", name: "낫표 자동 닫기", desc: "여는 낫표를 넣으면 닫는 낫표를 함께 넣고 커서를 사이에 둡니다.", kind: "toggle" },
				],
			},
			{
				heading: "편집기",
				fields: [
					{
						key: "koreanLineBreak",
						name: "한글 줄바꿈 단위",
						desc: "글자 단위: 음절마다 끊어 오른쪽 여백이 가지런함. 어절 단위: 낱말이 잘리지 않음. 관리 안 함: 테마 설정을 따름.",
						kind: "dropdown",
						options: () => ({ ...LINE_BREAK_LABEL }),
					},
					{ key: "showManuscriptCount", name: "원고지 분량 표시", desc: "200자 원고지 매수를 상태 표시줄(모바일은 노트 머리 단추의 메뉴)에 보여 줍니다.", kind: "toggle" },
					{
						key: "autoRenumberOnSave",
						name: "저장할 때 각주 번호 재정렬",
						desc: "저장 명령(Ctrl+S)을 실행할 때 각주 번호를 본문에 나온 순서대로 다시 매깁니다. 자동 저장에는 적용하지 않습니다.",
						kind: "toggle",
					},
				],
			},
			{
				heading: "HWPX 내보내기",
				fields: [
					{
						key: HALF_KEY,
						name: "낫표·겹낫표 폭",
						desc: "반각 겹낫표는 한컴 사설 영역 문자라 함초롬 계열 글꼴에서만 보입니다. 노트 원문은 그대로 두고 HWPX만 바꿉니다.",
						kind: "dropdown",
						options: () => ({ full: "전각 「」 『』", half: "반각 ｢｣ + 한컴 반각 겹낫표" }),
					},
					{
						key: "hwpxDoubleQuotes",
						name: "큰따옴표 모양",
						desc: "둥근 따옴표로 통일하면 곧은 따옴표를 앞뒤 글자에 따라 여는 “·닫는 ”로 바꿉니다.",
						kind: "dropdown",
						options: () => quoteOptions("“", "”", '"'),
					},
					{
						key: "hwpxSingleQuotes",
						name: "작은따옴표 모양",
						desc: "둥근 따옴표로 통일하면 영문 낱말 속 아포스트로피(don't)는 ’가 됩니다.",
						kind: "dropdown",
						options: () => quoteOptions("‘", "’", "'"),
					},
					{ key: "hwpxQuoteBlankLines", name: "인용문 앞뒤 빈 줄", desc: "인용문(> ) 문단 묶음의 앞과 뒤에 빈 줄을 한 줄씩 넣습니다.", kind: "toggle" },
					{
						key: "hwpxNoteType",
						name: "HWPX 각주 위치",
						desc: "한글 문서에서 각주(페이지 하단) 또는 미주(문서 끝)로 넣습니다.",
						kind: "dropdown",
						options: () => ({ footnote: "각주", endnote: "미주" }),
					},
					{ key: "hwpxImageWidthInch", name: "그림 최대 폭(인치)", desc: "원본이 이보다 좁으면 확대하지 않습니다. 1~12.", kind: "number", min: 1, max: 12, step: 0.5 },
					{
						key: "hwpxTemplate",
						name: "기준 템플릿",
						desc: "한컴에서 빈 새 문서를 저장한 HWPX 파일을 vault에 넣고 고르면 그 문서의 스타일을 물려받습니다. 비우면 내장 기본 스타일.",
						kind: "hwpxFile",
						placeholder: "예: templates/기본.hwpx",
					},
					{
						key: "exportHwpxOnSave",
						name: "저장할 때마다 자동 내보내기",
						desc: "저장 명령(Ctrl+S)을 실행하면 같은 이름의 HWPX를 다시 만듭니다. HWPX 쪽에서 고친 내용은 덮어써집니다.",
						kind: "toggle",
					},
				],
			},
		];
	}

	// ── 값 읽기·쓰기(두 경로 공용) ───────────────────────────

	getControlValue(key: string): unknown {
		const s = this.plugin.settings as unknown as Record<string, unknown>;
		if (key === HALF_KEY) return s[key] ? "half" : "full";
		return s[key];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const s = this.plugin.settings as unknown as Record<string, unknown>;
		if (!(key in s)) return;
		if (key === HALF_KEY) s[key] = value === "half";
		else if (key === "hwpxImageWidthInch") {
			const n = Number(value);
			if (!Number.isFinite(n) || n < 1 || n > 12) return;
			s[key] = n;
		} else if (key === "hwpxTemplate") s[key] = typeof value === "string" ? value.trim() : "";
		else s[key] = value;
		await this.plugin.saveSettings();
	}

	/** 설정이 명령 등 밖에서 바뀌었을 때 열린 탭을 다시 그린다. */
	refresh(): void {
		const tab = this as unknown as { update?: () => void };
		if (typeof tab.update === "function") tab.update();
		else if (this.containerEl.isShown()) this.display();
	}

	// ── Obsidian 1.13+: 선언형 정의(설정 검색에 잡힌다) ──────────

	getSettingDefinitions(): SettingDefinitionItem[] {
		return this.groups().map((g) => ({
			type: "group" as const,
			heading: g.heading,
			items: g.fields.map((f) => {
				const base = { name: f.name, desc: f.desc };
				switch (f.kind) {
					case "toggle":
						return { ...base, control: { type: "toggle" as const, key: f.key } };
					case "dropdown":
						return { ...base, control: { type: "dropdown" as const, key: f.key, options: f.options(), validate: f.validate } };
					case "number":
						return { ...base, control: { type: "number" as const, key: f.key, min: f.min, max: f.max, step: f.step } };
					case "hwpxFile":
						return {
							...base,
							control: {
								type: "file" as const,
								key: f.key,
								placeholder: f.placeholder,
								filter: (file: TFile) => file.extension === "hwpx",
							},
						};
				}
			}),
		}));
	}

	// ── Obsidian 1.13 미만: 명령형 그리기(위 정의가 쓰이면 호출되지 않는다) ──

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		for (const g of this.groups()) {
			new Setting(containerEl).setName(g.heading).setHeading();
			for (const f of g.fields) {
				const row = new Setting(containerEl).setName(f.name).setDesc(f.desc);
				const current = this.getControlValue(f.key);
				switch (f.kind) {
					case "toggle":
						row.addToggle((t) => t.setValue(current === true).onChange((v) => this.setControlValue(f.key, v)));
						break;
					case "dropdown":
						row.addDropdown((d) =>
							d
								.addOptions(f.options())
								.setValue(String(current))
								.onChange(async (v) => {
									const err = f.validate?.(v);
									if (err) {
										row.setDesc(err);
										d.setValue(String(this.getControlValue(f.key)));
										return;
									}
									row.setDesc(f.desc);
									await this.setControlValue(f.key, v);
								}),
						);
						break;
					case "number":
						row.addText((t) => t.setValue(String(current)).onChange((v) => this.setControlValue(f.key, v)));
						break;
					case "hwpxFile":
						row.addText((t) => t.setPlaceholder(f.placeholder).setValue(typeof current === "string" ? current : "").onChange((v) => this.setControlValue(f.key, v)));
						break;
				}
			}
		}
	}
}
