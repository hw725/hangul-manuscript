# Hangul Manuscript

[한국어](#vs-code-hanmark의-obsidian판) · [English](#english)

Write Korean manuscripts in Obsidian with corner-bracket input, footnotes that renumber themselves, paragraph style commands and a 200-character manuscript count, then export to HWPX with real Hangul footnotes and images. This is a port of the VS Code extension HanMark by gkman1, made with the original author’s permission. The full English guide is in the [English](#english) section below.

Obsidian에서 한글 원고를 쓰는 플러그인입니다. 겹낫표 입력, 각주 삽입·자동 정렬, 한컴식 문단 스타일 명령, 200자 원고지 분량을 제공하고, 완성된 노트를 한글(한컴오피스)의 **진짜 각주/미주 객체**가 담긴 HWPX로 내보냅니다.

## VS Code HanMark의 Obsidian판

이 플러그인은 Jinseok Choi(gkman1)가 만든 VS Code 확장 [HanMark](https://marketplace.visualstudio.com/items?itemName=gkman1.vscode-hanmark) 0.15.0을 **원 저작자의 허락을 받아** Obsidian판으로 만든 것입니다. 원본과 같은 MIT 라이선스로 원 저작자 표시(Copyright (c) 2026 hangul-office-keys contributors)를 유지합니다([LICENSE](LICENSE)). 각주 재정렬·따옴표·원고지·HWPX 생성 규칙은 원본과 같은 결과를 내도록 옮겼고, 시험(`tests/parity.test.ts`)이 원본 코드와 출력을 대조합니다.

Obsidian 커뮤니티의 [HanMark](https://github.com/laguna821/hanmark)(laguna821, HWP 가져오기·내보내기)와는 다른 프로젝트입니다.

### 원본과 달라진 점(요점)

VS Code와 Obsidian의 환경 차이 때문에 다음은 원본과 다르게 동작합니다. 전체 목록은 아래 「[원본과 다른 점](#원본과-다른-점)」에 있습니다.

- **겹낫표 자동 모드** — 원본은 Windows 입력기의 한/영 상태를 읽어 정합니다(Windows 전용). Obsidian은 모바일·맥에서도 돌아야 하므로, 모든 기기에서 `[[링크]]`·`[^각주]` 같은 Obsidian 문법 괄호를 지키는 문맥 규칙으로 정하고, Windows 데스크톱에서만 원본처럼 입력기 상태를 더 확인합니다.
- **「주석」 → 「각주」** — 원본의 「주석」 명령들은 「각주」라는 이름으로 바뀌었습니다. Obsidian 한국어판에서 「주석」은 `%% %%` 숨김 메모를 뜻하기 때문입니다. 기능은 같습니다.
- **저장할 때 각주 재정렬** — Obsidian은 타이핑 중에도 자동 저장하므로, 저장 명령(Ctrl+S)을 직접 실행할 때만 재정렬합니다. 모바일에서는 「각주 번호 재정렬」 명령을 쓰세요.
- **모바일** — 상태 표시줄이 없어서 노트 머리에 `「」자동` 같은 단추를 둡니다. 단추에는 현재 겹낫표 모드가 보이고, 누르면 모드를 바꾸는 메뉴와 원고지 매수가 나옵니다.
- **기본 단축키 없음** — Obsidian 플러그인 지침에 따라 비워 두었습니다. 원본 배치는 아래 「단축키」 표를 보고 지정하세요.

## 기능

### 1. 겹낫표 입력

상태 표시줄의 `「」 끔` 항목을 누르거나 명령 **「겹낫표 입력 모드 전환」**으로 **끔 → 자동 → 켬**을 바꿉니다. 상태 표시줄이 없는 모바일에서는 노트 머리(제목 줄 오른쪽)의 `「」끔` 단추가 현재 모드를 보여 주고, 누르면 모드를 고르는 메뉴가 열립니다.

| 키 | 입력 결과 |
|----|-----------|
| `[` | 「 |
| `]` | 」 |
| `{` | 『 |
| `}` | 』 |

- **켬**: 항상 바꿉니다. 이때는 `[[링크]]`·`[^1]`·`- [ ]`처럼 Obsidian 문법에 쓰는 괄호도 바뀌므로, 링크를 자주 쓰면 **자동**을 권합니다.
- **자동** (모든 기기): **Obsidian 문법이 되는 괄호는 그대로 두고 그 밖의 괄호만** 바꿉니다. 커서 앞 글만 보고 정하는 고정 규칙이라 데스크톱·맥·모바일에서 똑같이 동작합니다.

  | 문맥 | 결과 |
  |------|------|
  | 코드 블록·인라인 코드·수식·프런트매터 안 | 원래 괄호 |
  | 바로 앞이 `[` `!` `]` `\` (`[[`, `![[`, `![`, `][`, `\[`) | 원래 괄호 |
  | 목록 기호 바로 뒤 (`- [ ]` 할 일) | 원래 괄호 |
  | `{` 바로 뒤의 `{` (`{{템플릿}}`) | 원래 괄호 |
  | 낫표로 바뀐 직후 `[` · `^` · `!` 를 이어 침 | `[[` · `[^` · `[!` 로 되돌림 (링크 제안도 그대로 뜸) |
  | 낫표로 바뀐 직후 백스페이스 | 원래 괄호로 되돌림 |
  | 닫는 `]` `}` | 같은 문단에 열린 「 『 가 있을 때만 」 』 |
  | 그 밖 | 「 『 |

  - **Windows 데스크톱에서는 한 겹을 더합니다.** 괄호 키를 누르는 순간 Windows 입력기(IME)에 한/영 상태를 직접 물어(원본과 같은 방식) 영어 입력 중이면 바꾸지 않습니다. 이를 위해 자동 모드를 켜면 작은 PowerShell 보조 프로세스를 하나 띄워 둡니다. 창이 뜨지 않고, 네트워크·파일에 접근하지 않으며, 입력기 상태만 읽습니다(`src/editor/ime-windows.ts`). 첫 질의는 준비에 1초 남짓, 그 뒤로는 몇 ms입니다. 상태를 읽지 못하면 원래 괄호를 넣습니다. 한글을 조합하던 중에 누른 괄호는 그 자체로 한글 상태라는 증거라 묻지 않습니다. 명령 **「입력기 한/영 상태 진단」**으로 지금 읽히는 값을 볼 수 있습니다.
  - macOS·모바일에서는 입력기 상태를 읽을 공개된 방법이 없어 문맥 규칙만 씁니다. 그래서 영문 원고에서 `[sic]`처럼 문법이 아닌 괄호를 칠 때도 낫표가 되는데, 바로 백스페이스를 누르면 원래 괄호로 돌아갑니다. 마크다운 링크 `[글](주소)`도 같습니다(Obsidian에서는 `[[링크]]`가 기본이라 드문 경우로 보았습니다).
  - **모바일 화면 키보드**: 아이폰(한글 두벌식 화면 키보드)과 안드로이드에서 낫표 변환을 확인했습니다. 키보드에 따라 괄호를 조합 입력으로 넘기면 플러그인이 괄호를 받지 못할 수 있는데, 그때는 낫표로 바뀌지 않고 **원래 괄호가 그대로 들어갑니다**(글이 망가지지는 않습니다). 안 되는 키보드가 있으면 이슈로 알려 주시면 고치겠습니다.
- **자동 닫기**: 여는 낫표를 넣으면 닫는 낫표가 함께 들어가고, 닫는 키를 누르면 바로 뒤의 닫는 낫표를 건너뜁니다. 설정에서 끌 수 있습니다.
- 텍스트를 선택한 상태에서 여는 키를 누르면 선택 영역을 낫표로 감쌉니다.

### 2. 각주

마크다운 각주(`[^n]` + 정의)를 관리합니다. HWPX로 내보낼 때 각주(기본) 또는 미주가 됩니다. 원본 HanMark는 이 기능을 「주석」이라 불렀지만, Obsidian 한국어판에서 「주석」은 `%% %%` 숨김 메모(「주석 켜기/끄기」)를 뜻하므로 여기서는 「각주」라고 부릅니다.

| 명령 | 동작 |
|------|------|
| 각주 넣기 (번호 자동 정렬) | 커서 위치에 `[^n]`을 넣고 정의로 커서를 옮김 |
| 각주에서 본문으로 돌아가기 | 각주 내용을 쓴 뒤 본문의 원래 자리로 복귀 |
| 각주 번호 재정렬 | 번호를 본문 등장 순서로 다시 매김 |

- 삽입할 때 새 각주는 등장 순서에 맞는 번호를 받고 뒤 번호는 밀립니다. 정의도 번호순 자리에 들어갑니다.
- **저장 명령(Ctrl+S)**을 실행하면 번호를 자동 재정렬합니다(설정에서 끌 수 있음). Obsidian은 수시로 자동 저장하므로, 타이핑 중에 번호가 바뀌지 않도록 **명시적인 저장 명령에만** 붙였습니다. 모바일에는 Ctrl+S가 없으므로 명령 팔레트에서 「각주 번호 재정렬」을 실행하세요.
- 여러 줄 각주는 블록째 움직이고, 정의 사이에 본문이 있으면 연속된 정의 묶음 안에서만 정렬합니다.
- 코드 블록·인라인 코드(`` `[^1]` ``)·수식 안의 `[^n]`은 각주로 보지 않습니다. 문법을 설명하려고 적어 둔 표기가 저장할 때 바뀌지 않고, HWPX에도 글자 그대로 들어갑니다.

### 3. 문단 스타일

한컴 한글의 Ctrl+숫자처럼 커서 줄(또는 선택한 줄들)의 문단 스타일을 바꿉니다.

| 명령 | 결과 |
|------|------|
| 문단 스타일: 바탕글 | 접두사 제거 |
| 문단 스타일: 인용문 | `> ` |
| 문단 스타일: 제목 1~6 | `#` ~ `######` |

### 4. HWPX 내보내기

명령 **「HWPX로 내보내기」**를 실행하면 노트와 같은 폴더에 같은 이름의 `.hwpx`가 생깁니다.

- **각주**는 한글의 진짜 각주/미주 객체가 됩니다(번호·구분선·배치가 한컴에서 그대로 동작).
- **그림**: 그림 한 줄만 있는 문단은 한글 그림 객체가 되고, 원본 파일이 hwpx 안에 담깁니다. 마크다운 그림 문법과 Obsidian 임베드(`![[사진.png]]`) 둘 다 됩니다. 폭은 설정의 최대 폭(기본 6인치)을 넘지 않습니다. 못 읽은 그림은 `[그림 없음: 경로]`로 남습니다.
- **제목**은 개요 1~, **인용문**은 템플릿의 인용문 스타일, **굵게·기울임**은 한글 글자 모양으로 바뀝니다. 표·목록 등 그 밖의 문법은 문자 그대로 들어갑니다.
- **큰따옴표 모양**·**작은따옴표 모양**(둥근·원문 그대로·곧은), **낫표·겹낫표 폭**(전각·반각), **인용문 앞뒤 빈 줄**, **HWPX 각주 위치**(각주·미주), **기준 템플릿**은 설정에서 고릅니다. 노트 원문은 바뀌지 않고 hwpx만 바뀝니다.
- **기준 템플릿**: 한컴에서 빈 새 문서를 저장한 `.hwpx`를 vault에 넣고 그 경로를 적으면 그 문서의 스타일을 물려받습니다. 비우면 내장 기본 템플릿을 씁니다(한컴오피스가 없어도 동작).
- **저장할 때마다 자동 내보내기**를 켜면 저장 명령마다 hwpx를 다시 만듭니다. hwpx는 단방향 생성물이라 hwpx 쪽에서 고친 내용은 덮어써집니다.
- 노트 맨 앞의 YAML 프런트매터는 내보내지 않습니다.

### 5. 원고지 분량

상태 표시줄에 **200자 원고지 매수**를 보여 줍니다. 한글(HWP) 문서통계와 같은 셈법으로 영문자는 반 칸, 각주는 포함하고, 마크다운 문법·빈 줄·프런트매터는 뺍니다. 텍스트를 선택하면 선택 영역 기준으로 바뀌고, 항목을 누르거나 명령 「원고지 분량 자세히 보기」를 실행하면 글자 수(공백 포함/제외)·어절 수를 보여 줍니다. 모바일에서는 노트 머리 단추의 메뉴에 매수가 나오고, 누르면 같은 자세한 내용을 보여 줍니다.

### 6. 한글 줄바꿈 단위

명령 **「한글 줄바꿈 단위」** 또는 설정에서 **글자 단위**(기본)·**어절 단위**·**관리 안 함**을 고릅니다. 편집기와 읽기 보기의 CSS `word-break`를 `normal`·`keep-all`로 바꿉니다. **관리 안 함**이면 테마 설정을 그대로 따릅니다.

### 7. 반각/전각 일괄 변환

명령 **「반각/전각 일괄 변환」**으로 선택 영역(없으면 노트 전체)의 영숫자·문장부호 폭을 바꿉니다. 영인본 OCR이나 일본어권 자료에서 섞여 들어온 전각 문자를 정리하는 용도입니다. 한글·한자는 건드리지 않고, 반각 공백은 전각으로 바꾸지 않습니다. 노트 전체를 전각으로 바꿀 때는 한 번 확인합니다. 낫표·겹낫표는 다루지 않습니다 — 겹낫표에는 표준 반각 문자가 없기 때문입니다(원본 README의 설명과 같음).

## 단축키

Obsidian 플러그인 지침에 따라 기본 단축키를 정하지 않았습니다. **설정 → 단축키**에서 「Hangul Manuscript」를 검색해 지정하세요. 원본과 같은 배치를 원하면 아래처럼 지정합니다.

| 명령 | 원본 단축키 |
|------|------------|
| 겹낫표 입력 모드 전환 | `Ctrl+Alt+K` |
| 각주 넣기 | `Ctrl+Alt+N` |
| 각주에서 본문으로 돌아가기 | `Shift+Esc` |
| 각주 번호 재정렬 | `Ctrl+Alt+R` |
| 문단 스타일: 바탕글 · 인용문 · 제목 1~6 | `Ctrl+1` · `Ctrl+2` · `Ctrl+3`~`Ctrl+8` |

`Ctrl+1`~`Ctrl+8`을 쓰면 Obsidian 기본 동작(탭 이동 등)과 겹치니 그쪽 단축키를 먼저 지우세요.

## 원본과 다른 점

| 항목 | 원본(VS Code) | 이 플러그인(Obsidian) | 이유 |
|------|--------------|---------------------|------|
| 겹낫표 자동 모드 | Windows IME를 PowerShell 헬퍼로 읽음(Windows 전용) | 모든 기기: Obsidian 문법 보호 문맥 규칙 + 되돌리기. Windows 데스크톱: 여기에 원본과 같은 IME 조회를 더함(헬퍼는 플러그인 안에 담아 실행) | Obsidian은 기기를 가리지 않아야 하고, [[링크]] 같은 문법 괄호를 지키는 것이 Obsidian에서 자동 모드의 핵심 |
| 각주 명령 이름 | 「주석 넣기」 등 | 「각주 넣기」 등 | Obsidian 한국어판의 「주석」(`%% %%` 숨김 메모)과 혼동 방지 |
| 모드·분량 표시 | 상태 표시줄 | 데스크톱은 상태 표시줄, 모바일은 노트 머리 단추 | 모바일에는 상태 표시줄이 없음 |
| 설정 화면 호환 | — | 1.13 이상은 선언형 설정(설정 검색에 잡힘), 그 미만은 기존 방식 | 한 설정 표에서 두 방식을 함께 만든다 |
| 저장 시 재정렬·내보내기 | 모든 저장 | 저장 명령(Ctrl+S)에만 | Obsidian 자동 저장이 타이핑 중에도 일어남 |
| 기본 단축키 | 있음 | 없음(위 표 참고) | Obsidian 플러그인 지침 |
| 설정 화면 | 하단 패널 | Obsidian 설정 탭 | 플랫폼 관례 |
| 템플릿 경로 | 파일 시스템 경로 | vault 안 경로 | 모바일·동기화 환경 |
| 그림 | `![](경로)` | `![](경로)` + `![[임베드]]` | Obsidian 문법 |
| 프런트매터 | 해당 없음 | 내보내기·분량에서 제외 | Obsidian 노트 관례 |
| 코드 속 `[^n]` | 각주로 셈(원본의 알려진 제한) | 각주로 보지 않음 | Obsidian 노트에는 문법 설명·코드가 흔해 저장 때 남의 표기를 고쳐 버림 |
| 줄바꿈 단위 | 편집기 설정을 대신 기록 | CSS 클래스로 전환 | Obsidian은 브라우저 줄바꿈을 그대로 씀 |
| 내보낸 뒤 한컴에서 열기 | 버튼 있음 | 없음(알림만) | 외부 프로그램 실행을 피함 |

## 설치

커뮤니티 플러그인 목록 등록 전에는 수동으로 설치합니다.

1. 릴리스에서 `main.js`·`manifest.json`·`styles.css`를 받습니다.
2. vault의 `.obsidian/plugins/hangul-manuscript/` 폴더에 넣습니다.
3. Obsidian 설정 → 커뮤니티 플러그인에서 켭니다.

[BRAT](https://github.com/TfTHacker/obsidian42-brat)를 쓰면 저장소 주소만으로 설치·갱신할 수 있습니다.

Windows 데스크톱, 아이폰(iOS), 안드로이드에서 시험했습니다(화면 키보드의 겹낫표 입력 포함). macOS·Linux에서는 시험하지 않았습니다.

## 개발

```
npm install
npm test          # 단위 시험 + 원본 대조 시험
npm run build     # 타입 검사 + main.js
npm run check     # 심사 lint·라이선스 표기 검사
```

## 라이선스

MIT. 원본 HanMark(gkman1)의 저작권 표시를 그대로 유지합니다. 동봉한 기본 HWPX 템플릿(`assets/template-default.hwpx`)과 대조 시험용 참조 코드(`tests/reference/`)는 원본 확장에서 바꾸지 않고 가져왔습니다.

---

## English

Hangul Manuscript helps you write Korean manuscripts in Obsidian: corner-bracket (「」『』) input, footnotes that renumber themselves, Hancom-style paragraph style commands, a 200-character manuscript-sheet count, and export to HWPX with **real Hangul (Hancom Office) footnote/endnote objects** and images.

### Obsidian edition of VS Code HanMark

This plugin is the Obsidian edition of the VS Code extension [HanMark](https://marketplace.visualstudio.com/items?itemName=gkman1.vscode-hanmark) 0.15.0 by Jinseok Choi (gkman1), **made with the original author’s permission**. It keeps the same MIT license and the original copyright notice (Copyright (c) 2026 hangul-office-keys contributors; see [LICENSE](LICENSE)). Footnote renumbering, quote conversion, manuscript count and HWPX generation follow the original’s rules, and a test suite (`tests/parity.test.ts`) compares the output with the original code.

It is unrelated to the Obsidian community plugin [HanMark](https://github.com/laguna821/hanmark) by laguna821 (HWP import/export).

### What differs from the original

Because Obsidian is a different environment from VS Code, these behave differently. The full table is in the Korean section “[원본과 다른 점](#원본과-다른-점)”.

- **Auto bracket mode** — The original reads the Windows IME Korean/English state (Windows only). Obsidian also runs on mobile and macOS, so on every device the plugin decides by context, leaving Obsidian syntax brackets such as `[[links]]` and `[^footnotes]` alone. On Windows desktop it additionally checks the IME state like the original.
- **“Footnote” (각주) instead of “annotation” (주석)** — The original calls its footnote commands 주석. In Korean Obsidian, 주석 means `%% %%` comments, so the commands here are named 각주. They work the same.
- **Renumber on save** — Obsidian autosaves while you type, so footnotes are renumbered only when you run the save command (Ctrl+S) yourself. On mobile, run the “각주 번호 재정렬” (renumber footnotes) command.
- **Mobile** — There is no status bar on mobile, so a button in the note header (e.g. `「」자동`) shows the current bracket mode; tap it for a menu to change the mode and to see the manuscript count.
- **No default hotkeys** — Left empty per Obsidian plugin guidelines. The original key layout is listed in the Korean “단축키” section.

### Installation

Until the plugin is listed in Community plugins, download `main.js`, `manifest.json` and `styles.css` from the latest release into `.obsidian/plugins/hangul-manuscript/` in your vault, then enable it in Settings → Community plugins. [BRAT](https://github.com/TfTHacker/obsidian42-brat) can install and update it from the repository address.

Tested on Windows desktop, iOS (iPhone) and Android, including corner-bracket input with the on-screen Korean keyboard. Not tested on macOS or Linux.

### License

MIT, keeping the original HanMark (gkman1) copyright notice. The bundled default HWPX template (`assets/template-default.hwpx`) and the reference code for parity tests (`tests/reference/`) are taken unchanged from the original extension.
