// 마크다운 → HWPX. 템플릿의 header.xml 스타일을 물려받고, 주석은 한글의 진짜 각주/미주 객체로 만든다.
// 원본: VS Code 확장 HanMark(gkman1) 0.15.0 — MIT. 생성 XML은 원본과 같다.

import JSZip from "jszip";
import { type Paragraph, parseParagraphs, splitEmphasis } from "./markdown";
import { convertQuotes, type QuoteStyle, toHalfwidthBrackets } from "./text";

export type NoteType = "footnote" | "endnote";

export interface HwpxOptions {
	noteType?: NoteType;
	/** 그림 경로 → 바이트. 못 읽으면 undefined. */
	readImage?: (src: string, wiki: boolean) => Promise<Uint8Array | undefined>;
	imageWidthInch?: number;
	halfwidthBrackets?: boolean;
	quoteBlankLines?: boolean;
	doubleQuotes?: QuoteStyle;
	singleQuotes?: QuoteStyle;
}

interface StyleRef {
	id: string;
	paraPr: string;
	charPr: string;
}

interface TemplateStyles {
	normal: StyleRef;
	footnote: StyleRef;
	endnote: StyleRef;
	outlines: StyleRef[];
	quotation: StyleRef | undefined;
}

interface ImageItem {
	id: string;
	fileName: string;
	bytes: Uint8Array;
	mediaType: string;
	width: number;
	height: number;
	clipWidth: number;
	clipHeight: number;
	comment: string;
}

const HWPUNIT_PER_INCH = 7200;

export function readImageSize(b: Uint8Array): { width: number; height: number } | undefined {
	if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e) {
		const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
		return { width: dv.getUint32(16), height: dv.getUint32(20) };
	}
	if (b.length > 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
		const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
		return { width: dv.getUint16(6, true), height: dv.getUint16(8, true) };
	}
	if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
		let i = 2;
		while (i + 9 < b.length) {
			if (b[i] !== 0xff) {
				i += 1;
				continue;
			}
			const marker = b[i + 1];
			const len = (b[i + 2] << 8) | b[i + 3];
			if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
				return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
			}
			if (len <= 0) break;
			i += 2 + len;
		}
	}
	return undefined;
}

function extOf(src: string): string {
	return /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(src)?.[1]?.toLowerCase() ?? "png";
}

function mediaTypeOf(src: string): string {
	const ext = extOf(src);
	if (ext === "jpg" || ext === "jpeg") return "image/jpg";
	if (ext === "gif") return "image/gif";
	if (ext === "bmp") return "image/bmp";
	return "image/png";
}

function makeImage(id: string, fileName: string, bytes: Uint8Array, src: string, maxInch = 6): ImageItem {
	const px = readImageSize(bytes) ?? { width: 800, height: 600 };
	const maxW = Math.round(maxInch * HWPUNIT_PER_INCH);
	const natW = Math.round((px.width * HWPUNIT_PER_INCH) / 96);
	const natH = Math.round((px.height * HWPUNIT_PER_INCH) / 96);
	const width = Math.min(maxW, natW);
	const height = Math.max(1, Math.round((width * px.height) / px.width));
	return {
		id,
		fileName,
		bytes,
		mediaType: mediaTypeOf(src),
		width,
		height,
		clipWidth: natW,
		clipHeight: natH,
		comment: `그림입니다.\n원본 그림의 이름: ${fileName}\n원본 그림의 크기: 가로 ${px.width}pixel, 세로 ${px.height}pixel`,
	};
}

function addImagesToManifest(hpf: string, images: ImageItem[]): string {
	if (images.length === 0) return hpf;
	const items = images
		.filter((im) => !hpf.includes(`href="BinData/${im.fileName}"`))
		.map((im) => `<opf:item id="${im.id}" href="BinData/${im.fileName}" media-type="${im.mediaType}" isEmbeded="1"/>`)
		.join("");
	if (!items) return hpf;
	const i = hpf.indexOf("<opf:item ");
	return i < 0 ? hpf.replace(/(<opf:manifest[^>]*>)/, `$1${items}`) : hpf.slice(0, i) + items + hpf.slice(i);
}

export function readTemplateStyles(headerXml: string): TemplateStyles {
	const styles: { name: string; engName: string; ref: StyleRef }[] = [];
	for (const m of headerXml.matchAll(/<hh:style\s+([^>]*?)\/?>/g)) {
		const attrs = m[1];
		const get = (k: string) => new RegExp(`${k}="([^"]*)"`).exec(attrs)?.[1] ?? "";
		styles.push({
			name: get("name"),
			engName: get("engName"),
			ref: { id: get("id"), paraPr: get("paraPrIDRef"), charPr: get("charPrIDRef") },
		});
	}
	const find = (eng: string, ko: string) => (styles.find((s) => s.engName === eng) ?? styles.find((s) => s.name === ko))?.ref;
	const normal = find("Normal", "바탕글") ?? { id: "0", paraPr: "0", charPr: "0" };
	const footnote = find("Footnote", "각주") ?? normal;
	const endnote = find("Endnote", "미주") ?? footnote;
	const outlines: StyleRef[] = [];
	for (let i = 1; i <= 7; i++) {
		const o = find(`Outline ${i}`, `개요 ${i}`);
		if (o) outlines.push(o);
	}
	return { normal, footnote, endnote, outlines, quotation: find("Quotation", "인용문") ?? find("Body", "본문") };
}

function mapTexts(paras: Paragraph[], f: (s: string) => string): Paragraph[] {
	return paras.map((p) => ({
		...p,
		parts: p.parts.map((x) =>
			x.kind === "text" ? { ...x, text: f(x.text) } : x.kind === "footnote" ? { ...x, content: f(x.content) } : x,
		),
	}));
}

/** 문단 단위로 따옴표를 바꾼다(강조로 나뉜 조각을 이어 문맥을 본다). */
function applyQuotes(paras: Paragraph[], opt: { double: QuoteStyle; single: QuoteStyle }): Paragraph[] {
	if (opt.double === "keep" && opt.single === "keep") return paras;
	return paras.map((p) => {
		const joined = p.parts.map((x) => (x.kind === "text" ? x.text : "")).join("");
		const conv = convertQuotes(joined, opt);
		let pos = 0;
		return {
			...p,
			parts: p.parts.map((x) => {
				if (x.kind === "footnote") return { ...x, content: convertQuotes(x.content, opt) };
				if (x.kind !== "text") return x;
				const t = conv.slice(pos, pos + x.text.length);
				pos += x.text.length;
				return { ...x, text: t };
			}),
		};
	});
}

/** 인용문 묶음 앞뒤에 빈 문단을 넣는다(문서 처음·끝 제외, 맞붙은 묶음 사이는 한 줄). */
function addQuoteBlankLines(paras: Paragraph[]): Paragraph[] {
	const out: Paragraph[] = [];
	paras.forEach((p, i) => {
		const prev = paras[i - 1];
		if (prev !== undefined && prev.quoteBlock !== p.quoteBlock && (prev.quoteBlock !== undefined || p.quoteBlock !== undefined)) {
			out.push({ outlineLevel: 0, quote: false, parts: [] });
		}
		out.push(p);
	});
	return out;
}

function styleFor(p: Paragraph, s: TemplateStyles): StyleRef {
	if (p.quote && s.quotation) return s.quotation;
	if (p.outlineLevel > 0 && s.outlines.length > 0) return s.outlines[Math.min(p.outlineLevel, s.outlines.length) - 1];
	return s.normal;
}

interface CharPrNeed {
	base: string;
	bold: boolean;
	italic: boolean;
}

/** 굵게·기울임이 필요한 글자 모양을 기준 charPr에서 복제해 header.xml에 더한다. */
function addEmphasisCharPrs(headerXml: string, needs: CharPrNeed[]) {
	const made = new Map<string, string>();
	let xml = headerXml;
	let maxId = 0;
	for (const m of xml.matchAll(/<hh:charPr id="(\d+)"/g)) maxId = Math.max(maxId, Number(m[1]));
	let added = 0;
	for (const n of needs) {
		if (!n.bold && !n.italic) continue;
		const key = `${n.base}:${n.bold}:${n.italic}`;
		if (made.has(key)) continue;
		const esc = n.base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const open = new RegExp(`<hh:charPr id="${esc}"[^>]*>`).exec(xml);
		if (!open) {
			made.set(key, n.base);
			continue;
		}
		let src: string;
		if (open[0].endsWith("/>")) src = open[0];
		else {
			const close = xml.indexOf("</hh:charPr>", open.index);
			if (close < 0) {
				made.set(key, n.base);
				continue;
			}
			src = xml.slice(open.index, close + "</hh:charPr>".length);
		}
		const id = String(++maxId);
		let copy = src.replace(/(<hh:charPr id=")[^"]*(")/, `$1${id}$2`);
		let extra = "";
		if (n.italic && !copy.includes("<hh:italic")) extra += "<hh:italic/>";
		if (n.bold && !copy.includes("<hh:bold")) extra += "<hh:bold/>";
		if (extra) {
			if (copy.endsWith("/>")) copy = `${copy.slice(0, -2)}>${extra}</hh:charPr>`;
			else {
				const offset = /<hh:offset[^>]*\/>/.exec(copy);
				copy = offset ? copy.replace(offset[0], `${offset[0]}${extra}`) : copy.replace("</hh:charPr>", `${extra}</hh:charPr>`);
			}
		}
		xml = xml.replace("</hh:charProperties>", `${copy}</hh:charProperties>`);
		made.set(key, id);
		added += 1;
	}
	if (added > 0) {
		xml = xml.replace(/(<hh:charProperties[^>]*itemCnt=")(\d+)(")/, (_a, pre: string, cnt: string, post: string) => `${pre}${Number(cnt) + added}${post}`);
	}
	return {
		headerXml: xml,
		idFor: (base: string, bold: boolean, italic: boolean) => (!bold && !italic ? base : made.get(`${base}:${bold}:${italic}`) ?? base),
	};
}

export function escapeXml(s: string): string {
	let out = "";
	for (const ch of s) {
		const c = ch.charCodeAt(0);
		if (c < 32 && c !== 9 && c !== 10 && c !== 13) continue;
		out += ch;
	}
	return out.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildSection(
	sectionXml: string,
	paras: Paragraph[],
	styles: TemplateStyles,
	noteType: NoteType,
	images: Map<string, ImageItem>,
	idFor: (base: string, bold: boolean, italic: boolean) => string,
): string {
	const secEnd = sectionXml.indexOf("</hp:secPr>");
	if (secEnd < 0) throw new Error("템플릿 section0.xml에서 섹션 설정(secPr)을 찾지 못했습니다");
	const runEnd = sectionXml.indexOf("</hp:run>", secEnd);
	if (runEnd < 0) throw new Error("템플릿 section0.xml의 첫 run 경계를 찾지 못했습니다");
	let head = sectionXml.slice(0, runEnd + "</hp:run>".length);

	const isEnd = noteType === "endnote";
	const tag = isEnd ? "endNote" : "footNote";
	const numType = isEnd ? "ENDNOTE" : "FOOTNOTE";
	const noteStyle = isEnd ? styles.endnote : styles.footnote;
	const notePr = (isEnd ? /<hp:endNotePr>[\s\S]*?<\/hp:endNotePr>/ : /<hp:footNotePr>[\s\S]*?<\/hp:footNotePr>/).exec(sectionXml)?.[0] ?? "";
	const autoNumFormat =
		/<hp:autoNumFormat[^>]*\/>/.exec(notePr)?.[0] ??
		'<hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/>';
	const suffix = /suffixChar="([^"]*)"/.exec(autoNumFormat)?.[1] ?? "";
	const suffixAttr = suffix ? ` suffixChar="${suffix.charCodeAt(0)}"` : "";

	let nextId = 900000001;
	let noteNo = 0;

	const picRun = (im: ImageItem, charPr: string) => {
		const { width: w, height: h } = im;
		return `<hp:run charPrIDRef="${charPr}"><hp:pic id="${nextId++}" zOrder="0" numberingType="PICTURE" textWrap="SQUARE" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="${nextId++}" reverse="0"><hp:offset x="0" y="0"/><hp:orgSz width="${w}" height="${h}"/><hp:curSz width="0" height="0"/><hp:flip horizontal="0" vertical="0"/><hp:rotationInfo angle="0" centerX="${Math.round(w / 2)}" centerY="${Math.round(h / 2)}" rotateimage="1"/><hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo><hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="${w}" y="0"/><hc:pt2 x="${w}" y="${h}"/><hc:pt3 x="0" y="${h}"/></hp:imgRect><hp:imgClip left="0" right="${im.clipWidth}" top="0" bottom="${im.clipHeight}"/><hp:inMargin left="0" right="0" top="0" bottom="0"/><hc:img binaryItemIDRef="${im.id}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/><hp:effects/><hp:sz width="${w}" widthRelTo="ABSOLUTE" height="${h}" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="CENTER" vertOffset="0" horzOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:shapeComment>${escapeXml(im.comment)}</hp:shapeComment></hp:pic></hp:run>`;
	};

	const runs = (p: Paragraph) => {
		const st = styleFor(p, styles);
		return p.parts
			.map((x) => {
				if (x.kind === "text") {
					return `<hp:run charPrIDRef="${idFor(st.charPr, x.bold === true, x.italic === true)}"><hp:t>${escapeXml(x.text)}</hp:t></hp:run>`;
				}
				if (x.kind === "image") {
					const im = images.get(x.src);
					return im ? picRun(im, st.charPr) : `<hp:run charPrIDRef="${st.charPr}"><hp:t>${escapeXml(`[그림 없음: ${x.src}]`)}</hp:t></hp:run>`;
				}
				noteNo += 1;
				const spans = splitEmphasis(x.content);
				const body = spans.some((s) => s.bold || s.italic)
					? "<hp:t> </hp:t></hp:run>" +
						spans.map((s) => `<hp:run charPrIDRef="${idFor(noteStyle.charPr, s.bold, s.italic)}"><hp:t>${escapeXml(s.text)}</hp:t></hp:run>`).join("")
					: `<hp:t> ${escapeXml(x.content)}</hp:t></hp:run>`;
				return `<hp:run charPrIDRef="${st.charPr}"><hp:ctrl><hp:${tag} number="${noteNo}"${suffixAttr} instId="${nextId++}"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0"><hp:p id="${nextId++}" paraPrIDRef="${noteStyle.paraPr}" styleIDRef="${noteStyle.id}" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${noteStyle.charPr}"><hp:ctrl><hp:autoNum num="${noteNo}" numType="${numType}">${autoNumFormat}</hp:autoNum></hp:ctrl>${body}</hp:p></hp:subList></hp:${tag}></hp:ctrl></hp:run>`;
			})
			.join("");
	};

	const first = paras[0];
	if (first) {
		const st = styleFor(first, styles);
		head = head
			.replace(/(<hp:p [^>]*?paraPrIDRef=")[^"]*(")/, `$1${st.paraPr}$2`)
			.replace(/(<hp:p [^>]*?styleIDRef=")[^"]*(")/, `$1${st.id}$2`);
	}
	const emptyRun = `<hp:run charPrIDRef="${styles.normal.charPr}"><hp:t/></hp:run>`;
	const firstRuns = (first && runs(first)) || emptyRun;
	const rest = paras
		.slice(1)
		.map((p) => {
			const st = styleFor(p, styles);
			return `<hp:p id="${nextId++}" paraPrIDRef="${st.paraPr}" styleIDRef="${st.id}" pageBreak="0" columnBreak="0" merged="0">${runs(p) || emptyRun}</hp:p>`;
		})
		.join("");
	return `${head}${firstRuns}</hp:p>${rest}</hs:sec>`;
}

export async function markdownToHwpx(markdown: string, template: Uint8Array | ArrayBuffer, opt: HwpxOptions = {}): Promise<Uint8Array> {
	const zip = await JSZip.loadAsync(template);
	const headerFile = zip.file("Contents/header.xml");
	const sectionFile = zip.file("Contents/section0.xml");
	if (!headerFile || !sectionFile) throw new Error("올바른 hwpx 템플릿이 아닙니다 (Contents/header.xml·section0.xml 필요)");

	const headerXml = await headerFile.async("string");
	const styles = readTemplateStyles(headerXml);
	let paras = applyQuotes(parseParagraphs(markdown), { double: opt.doubleQuotes ?? "curly", single: opt.singleQuotes ?? "curly" });
	if (opt.halfwidthBrackets) paras = mapTexts(paras, toHalfwidthBrackets);
	if (opt.quoteBlankLines) paras = addQuoteBlankLines(paras);
	const noteType = opt.noteType ?? "footnote";
	const noteStyle = noteType === "endnote" ? styles.endnote : styles.footnote;

	const needs: CharPrNeed[] = [];
	for (const p of paras) {
		const st = styleFor(p, styles);
		for (const x of p.parts) {
			if (x.kind === "text" && (x.bold === true || x.italic === true)) needs.push({ base: st.charPr, bold: x.bold === true, italic: x.italic === true });
			else if (x.kind === "footnote") {
				for (const s of splitEmphasis(x.content)) if (s.bold || s.italic) needs.push({ base: noteStyle.charPr, bold: s.bold, italic: s.italic });
			}
		}
	}
	const header = addEmphasisCharPrs(headerXml, needs);

	const images = new Map<string, ImageItem>();
	if (opt.readImage) {
		for (const p of paras) {
			for (const x of p.parts) {
				if (x.kind !== "image" || images.has(x.src)) continue;
				const bytes = await opt.readImage(x.src, x.wiki === true);
				if (!bytes) continue;
				const n = images.size + 1;
				images.set(x.src, makeImage(`image${n}`, `image${n}.${extOf(x.src)}`, bytes, x.src, opt.imageWidthInch));
			}
		}
	}

	const section = buildSection(await sectionFile.async("string"), paras, styles, noteType, images, header.idFor);
	const out = new JSZip();
	const mime = zip.file("mimetype");
	if (mime) out.file("mimetype", await mime.async("uint8array"), { compression: "STORE" });
	const imageList = [...images.values()];
	for (const name of Object.keys(zip.files)) {
		const f = zip.files[name];
		if (f.dir || name === "mimetype") continue;
		if (name === "Contents/section0.xml") out.file(name, section);
		else if (name === "Contents/header.xml") out.file(name, header.headerXml);
		else if (name === "Contents/content.hpf") out.file(name, addImagesToManifest(await f.async("string"), imageList));
		else out.file(name, await f.async("uint8array"));
	}
	for (const im of imageList) out.file(`BinData/${im.fileName}`, im.bytes);
	return out.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
