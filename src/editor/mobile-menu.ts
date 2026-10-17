// 모바일 노트 머리 단추와 그 메뉴에 보일 내용.
// 모바일에는 상태 표시줄이 없어서 겹낫표 모드·원고지 매수를 여기서 보여 주고 모드를 바꾸게 한다.
import { BRACKET_MODE_LABEL, type BracketMode } from "./brackets";

export interface MobileMenuModel {
	/** 단추의 접근성 이름(길게 누르면 보임) */
	title: string;
	/** 단추에 바로 보이는 짧은 글자 */
	badge: string;
	modes: { mode: BracketMode; label: string; checked: boolean }[];
	/** 원고지 항목. 마크다운 노트가 아니거나 표시를 끈 때는 null */
	countLabel: string | null;
}

const ORDER: BracketMode[] = ["off", "auto", "on"];

export function mobileMenuModel(mode: BracketMode, sheets: number | null): MobileMenuModel {
	const count = sheets === null ? null : `원고지 ${sheets.toFixed(1)}매`;
	return {
		title: `「」 ${BRACKET_MODE_LABEL[mode]}` + (count ? ` · ${count}` : ""),
		badge: `「」${BRACKET_MODE_LABEL[mode]}`,
		modes: ORDER.map((m) => ({ mode: m, label: `겹낫표: ${BRACKET_MODE_LABEL[m]}`, checked: m === mode })),
		countLabel: count === null ? null : `${count} — 자세히 보기`,
	};
}
