// 모바일에는 상태 표시줄이 없어 겹낫표 모드·원고지 매수를 노트 머리의 메뉴로 보여 준다.
import { describe, expect, it } from "vitest";
import { mobileMenuModel } from "../src/editor/mobile-menu";

describe("모바일 메뉴", () => {
	it("단추 이름에 현재 모드와 원고지 매수가 보인다", () => {
		const m = mobileMenuModel("auto", 3.24);
		expect(m.title).toBe("「」 자동 · 원고지 3.2매");
	});

	it("마크다운 노트가 아니면 매수 없이 모드만 보인다", () => {
		const m = mobileMenuModel("off", null);
		expect(m.title).toBe("「」 끔");
		expect(m.countLabel).toBeNull();
	});

	it("세 모드를 고를 수 있고 현재 모드에만 표시가 붙는다", () => {
		const m = mobileMenuModel("on", 1);
		expect(m.modes.map((x) => x.mode)).toEqual(["off", "auto", "on"]);
		expect(m.modes.filter((x) => x.checked).map((x) => x.mode)).toEqual(["on"]);
		expect(m.modes.map((x) => x.label)).toEqual(["겹낫표: 끔", "겹낫표: 자동", "겹낫표: 켬"]);
	});

	it("원고지 항목은 매수를 소수 한 자리로 보여 준다", () => {
		expect(mobileMenuModel("auto", 12).countLabel).toBe("원고지 12.0매 — 자세히 보기");
	});
});
