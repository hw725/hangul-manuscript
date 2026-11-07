# Hangul Manuscript

English · [한국어](README.ko.md)

Write Korean manuscripts in Obsidian with corner-bracket input, footnotes that renumber themselves, paragraph style commands and a 200-character manuscript count, then export to HWPX with real Hangul (Hancom Office) footnote/endnote objects and images.

The plugin’s commands and settings are in Korean. Each command below is listed with its exact name so you can find it in the command palette.

## Obsidian edition of VS Code HanMark

This plugin is the Obsidian edition of the VS Code extension [HanMark](https://marketplace.visualstudio.com/items?itemName=gkman1.vscode-hanmark) 0.15.0 by Jinseok Choi (gkman1), made **with the original author’s permission**. It keeps the same MIT license and the original copyright notice (Copyright (c) 2026 hangul-office-keys contributors; see [LICENSE](LICENSE)). Footnote renumbering, quote conversion, manuscript count and HWPX generation give the same results as the original.

It is unrelated to the Obsidian community plugin [HanMark](https://github.com/laguna821/hanmark) by laguna821 (HWP import/export).

### What differs from the original (summary)

Obsidian is a different environment from VS Code, so these behave differently. The full list is in “[Differences from the original](#differences-from-the-original)” below.

- **Auto bracket mode** — The original reads the Windows IME Korean/English state (Windows only). Obsidian also runs on mobile and macOS, so on every device the plugin decides by context, leaving Obsidian syntax brackets such as `[[links]]` and `[^footnotes]` alone. On Windows desktop it additionally checks the IME state like the original.
- **Footnote commands are named `각주`** — The original calls them `주석`. In Korean Obsidian, `주석` means `%% %%` hidden comments, so the commands here use `각주` (footnote). They work the same.
- **Renumber on save** — Obsidian autosaves while you type, so footnotes are renumbered only when you run the save command (Ctrl+S) yourself. On mobile, run the renumber command.
- **Mobile** — There is no status bar on mobile, so a button in the note header (for example `「」자동`) shows the current bracket mode. Tap it for a menu to change the mode and to see the manuscript count.
- **No default hotkeys** — Left empty per Obsidian plugin guidelines. The original key layout is in “[Hotkeys](#hotkeys)” below.

## Features

### 1. Corner-bracket input

Click the `「」 끔` item in the status bar, or run the command `겹낫표 입력 모드 전환` (toggle bracket input mode), to cycle **off → auto → on**. On mobile, where there is no status bar, a `「」끔` button in the note header (right of the title bar) shows the current mode; tap it to choose a mode from a menu.

| Key | Result |
|-----|--------|
| `[` | 「 |
| `]` | 」 |
| `{` | 『 |
| `}` | 』 |

- **On**: always converts. This also converts brackets used in Obsidian syntax such as `[[link]]`, `[^1]` and `- [ ]`, so **auto** is recommended if you use links often.
- **Auto** (all devices): leaves brackets that form Obsidian syntax alone and converts **only the others**. It is a fixed rule that looks only at the text before the cursor, so it behaves the same on desktop, macOS and mobile.

  | Context | Result |
  |---------|--------|
  | Inside a code block, inline code, math or frontmatter | Plain bracket |
  | Right after `[` `!` `]` `\` (`[[`, `![[`, `![`, `][`, `\[`) | Plain bracket |
  | Right after a list marker (`- [ ]` task) | Plain bracket |
  | `{` right after `{` (`{{template}}`) | Plain bracket |
  | Typing `[`, `^` or `!` right after a converted bracket | Reverts to `[[`, `[^` or `[!` (link suggestions still appear) |
  | Backspace right after a converted bracket | Reverts to the plain bracket |
  | Closing `]` `}` | 」 』 only if an open 「 『 is in the same paragraph |
  | Anything else | 「 『 |

  - **Windows desktop adds one more check.** When you press a bracket key, the plugin asks the Windows IME for its Korean/English state (the same method as the original) and does not convert while you are typing English. For this, turning on auto mode starts a small PowerShell helper process. It opens no window, does not touch the network or files, and only reads the IME state (`src/editor/ime-windows.ts`). The first query takes about a second to get ready; later queries take a few milliseconds. If the state cannot be read, the plain bracket is inserted. A bracket typed while composing Hangul is itself proof of Korean input, so no query is made. The command `입력기 한/영 상태 진단` (diagnose IME state) shows the value currently read.
  - On macOS and mobile there is no public way to read the IME state, so only the context rule is used. A non-syntax bracket such as `[sic]` in English text therefore becomes a corner bracket; press Backspace right away to get the plain bracket back. Markdown links `[text](url)` work the same way (in Obsidian `[[links]]` are the norm, so this should be rare).
  - On on-screen keyboards that send brackets as composed input, brackets are not converted and the plain bracket is inserted.
- **Auto-close**: inserting an opening corner bracket also inserts the closing one, and pressing the closing key skips over a closing bracket right after the cursor. You can turn this off in settings.
- With text selected, pressing an opening key wraps the selection in corner brackets.

### 2. Footnotes

Manages Markdown footnotes (`[^n]` plus definition). On HWPX export they become footnotes (default) or endnotes.

| Command | Action |
|---------|--------|
| `각주 넣기 (번호 자동 정렬)` (insert footnote) | Inserts `[^n]` at the cursor and moves the cursor to the definition |
| `각주에서 본문으로 돌아가기` (back to text) | After writing the footnote, returns to its place in the text |
| `각주 번호 재정렬` (renumber footnotes) | Renumbers footnotes in order of appearance |

- A new footnote gets the number matching its position, and later numbers shift. Its definition is placed in numeric order too.
- Running the save command (**Ctrl+S**) renumbers footnotes automatically (can be turned off in settings). Obsidian autosaves constantly, so this runs **only on the explicit save command** to keep numbers from changing while you type. Mobile has no Ctrl+S; run the renumber command from the command palette.
- Multi-line footnotes move as a block. If text sits between definitions, sorting happens only within each run of consecutive definitions.
- `[^n]` inside code blocks, inline code (`` `[^1]` ``) or math is not treated as a footnote. Notation written to explain the syntax is not changed on save and goes into the HWPX as plain text.

### 3. Paragraph styles

Like Ctrl+number in Hancom Hangul, changes the paragraph style of the cursor line (or selected lines).

| Command | Result |
|---------|--------|
| `문단 스타일: 바탕글` (body) | Removes the prefix |
| `문단 스타일: 인용문` (quote) | `> ` |
| `문단 스타일: 제목 1`–`제목 6` (heading 1–6) | `#` to `######` |

### 4. HWPX export

Running the command `HWPX로 내보내기` (export to HWPX) creates a `.hwpx` with the same name in the same folder as the note.

- **Footnotes** become real Hangul footnote/endnote objects (numbering, separator line and placement work as usual in Hancom Office).
- **Images**: a paragraph containing only an image becomes a Hangul picture object, and the image file is stored inside the hwpx. Both Markdown image syntax and Obsidian embeds (`![[photo.png]]`) work. Width never exceeds the maximum width in settings (default 6 inches). An image that cannot be read is left as `[그림 없음: path]`.
- **Headings** become outline levels 1 and up, **quotes** use the template’s quote style, and **bold/italic** become Hangul character formatting. Other syntax such as tables and lists goes in as plain text.
- Double-quote shape and single-quote shape (curly, as written, straight), corner-bracket width (full-width, half-width), blank lines around quotes, footnote placement (footnote, endnote) and the base template are chosen in settings. Only the hwpx changes; the note itself is not modified.
- **Base template**: save an empty new document from Hancom Office as `.hwpx`, put it in your vault and select it to inherit that document’s styles. Leave it empty to use the built-in default template (works without Hancom Office).
- With **export on every save** turned on, every save command rebuilds the hwpx. The hwpx is a one-way output, so edits made on the hwpx side are overwritten.
- YAML frontmatter at the top of the note is not exported.

### 5. Manuscript count

The status bar shows the count in **200-character manuscript sheets**. It counts the same way as Hangul (HWP) document statistics: Latin letters count as half a cell, footnotes are included, and Markdown syntax, blank lines and frontmatter are excluded. With text selected it counts the selection. Click the item or run `원고지 분량 자세히 보기` (manuscript count details) to see character counts (with and without spaces) and word counts. On mobile the count appears in the note header button’s menu; tap it for the same details.

### 6. Hangul line breaking

Choose **by character** (default), **by word** or **unmanaged** with the command `한글 줄바꿈 단위` (Hangul line-break unit) or in settings. This switches the CSS `word-break` of the editor and reading view between `normal` and `keep-all`. **Unmanaged** follows your theme.

### 7. Half-width/full-width conversion

The command `반각/전각 일괄 변환` (convert half-width/full-width) changes the width of Latin letters, digits and punctuation in the selection (or the whole note if nothing is selected). It is meant for cleaning up full-width characters from facsimile OCR or Japanese sources. Hangul and Hanja are left alone, and half-width spaces are not converted to full-width. Converting a whole note to full-width asks for confirmation first. Corner brackets are not handled, since the double corner bracket has no standard half-width form (as in the original README).

## Hotkeys

Following Obsidian plugin guidelines, there are no default hotkeys. Search for “Hangul Manuscript” in **Settings → Hotkeys** to assign them. For the original layout, assign as below.

| Command | Original hotkey |
|---------|-----------------|
| `겹낫표 입력 모드 전환` (toggle bracket input mode) | `Ctrl+Alt+K` |
| `각주 넣기` (insert footnote) | `Ctrl+Alt+N` |
| `각주에서 본문으로 돌아가기` (back to text) | `Shift+Esc` |
| `각주 번호 재정렬` (renumber footnotes) | `Ctrl+Alt+R` |
| `문단 스타일: 바탕글` · `인용문` · `제목 1`–`6` | `Ctrl+1` · `Ctrl+2` · `Ctrl+3`–`Ctrl+8` |

`Ctrl+1` to `Ctrl+8` overlap Obsidian’s defaults (switching tabs and so on), so remove those hotkeys first.

## Differences from the original

| Item | Original (VS Code) | This plugin (Obsidian) | Reason |
|------|--------------------|------------------------|--------|
| Auto bracket mode | Reads the Windows IME with a PowerShell helper (Windows only) | All devices: context rule that protects Obsidian syntax, plus undo. Windows desktop: adds the same IME query as the original (helper bundled in the plugin) | Obsidian must work on every device, and protecting syntax brackets like [[links]] is the core of auto mode in Obsidian |
| Footnote command names | `주석` | `각주` | Avoids confusion with `주석` (`%% %%` hidden comments) in Korean Obsidian |
| Mode and count display | Status bar | Status bar on desktop, note header button on mobile | Mobile has no status bar |
| Settings screen | — | Declarative settings on 1.13+ (found by settings search), the classic form below that | Both are built from one settings table |
| Renumber and export on save | Every save | Only the save command (Ctrl+S) | Obsidian autosaves while you type |
| Default hotkeys | Yes | None (see the table above) | Obsidian plugin guidelines |
| Settings location | Bottom panel | Obsidian settings tab | Platform convention |
| Template path | File system path | Path inside the vault | Mobile and sync setups |
| Images | `![](path)` | `![](path)` and `![[embed]]` | Obsidian syntax |
| Frontmatter | Not applicable | Excluded from export and count | Obsidian note convention |
| `[^n]` inside code | Counted as a footnote (known limitation of the original) | Not treated as a footnote | Obsidian notes often contain syntax explanations and code; saving would otherwise rewrite them |
| Line-break unit | Writes editor settings | Switches a CSS class | Obsidian uses the browser’s line breaking |
| Open in Hancom after export | Button | None (notice only) | Avoids launching external programs |

## Installation

In Obsidian, open Settings → Community plugins → Browse, search for “Hangul Manuscript”, then install and enable it.

## Development

```
npm install
npm test          # unit tests + parity tests against the original
npm run build     # type check + main.js
npm run check     # review lint and license notice checks
```

## License

MIT, keeping the original HanMark (gkman1) copyright notice. The bundled default HWPX template (`assets/template-default.hwpx`) and the reference code for parity tests (`tests/reference/`) are taken unchanged from the original extension.
