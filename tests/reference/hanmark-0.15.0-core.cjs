// HanMark(gkman1) 0.15.0 dist/extension.js에서 떼어 낸 순수 함수(prettier로 펼침) — 차등 시험의 기준.
// MIT License, Copyright (c) 2026 hangul-office-keys contributors. 고치지 않는다.
"use strict";
const ma = { default: require("jszip") };
var Uf = /\[\^([^\]\s]+)\]/g,
  qf = "\0";
function Wf(e) {
  let t = [];
  for (let r of e.matchAll(Uf)) {
    let i = r.index ?? 0,
      n =
        i === 0 ||
        e[i - 1] ===
          `
`;
    t.push({
      label: r[1],
      index: i,
      length: r[0].length,
      isDefinition: n && e[i + r[0].length] === ":",
    });
  }
  return t;
}
function Vp(e) {
  let t = [],
    r = [];
  for (let n of e) {
    let a = n.isDefinition ? r : t;
    !t.includes(n.label) && !a.includes(n.label) && a.push(n.label);
  }
  let i = [...t, ...r.filter((n) => !t.includes(n))];
  return new Map(i.map((n, a) => [n, String(a + 1)]));
}
function Jp(e, t) {
  let r = `[^${t}]: `;
  if (e.length === 0)
    return `

${r}`;
  let i = e.replace(/\n+$/, ""),
    n = e.length - i.length,
    a = i.slice(
      i.lastIndexOf(`
`) + 1,
    ),
    o = /^\[\^[^\]\s]+\]:/.test(a) ? 1 : 2;
  return (
    `
`.repeat(Math.max(0, o - n)) + r
  );
}
var eg = /^\[\^([^\]\s]+)\]:/;
function ga(e) {
  let t = [];
  for (let r = 0; r < e.length; r++) {
    let i = eg.exec(e[r]);
    if (!i) continue;
    let n = r,
      a = r + 1;
    for (; a < e.length; ) {
      if (/^\s+\S/.test(e[a])) {
        (n = a), (a += 1);
        continue;
      }
      if (e[a].trim() === "") {
        let o = a;
        for (; o < e.length && e[o].trim() === ""; ) o += 1;
        if (o < e.length && /^\s+\S/.test(e[o])) {
          (n = o), (a = o + 1);
          continue;
        }
      }
      break;
    }
    t.push({ startLine: r, endLine: n, label: i[1] }), (r = n);
  }
  return t;
}
function vi(e) {
  let t = Wf(e),
    r = Vp(t),
    i = [];
  for (let h of t) {
    let b = r.get(h.label);
    b === void 0 ||
      b === h.label ||
      i.push({ start: h.index, end: h.index + h.length, text: `[^${b}]` });
  }
  let n = e.split(`
`),
    a = [],
    o = 0;
  for (let h of n) a.push(o), (o += h.length + 1);
  let s = ga(n),
    u = [],
    l = [];
  for (let h of s) {
    if (l.length > 0) {
      let b = l[l.length - 1],
        w = !0;
      for (let m = b.endLine + 1; m < h.startLine; m++)
        if (n[m].trim() !== "") {
          w = !1;
          break;
        }
      w || (u.push(l), (l = []));
    }
    l.push(h);
  }
  l.length > 0 && u.push(l);
  let f = (h) =>
      h.replace(Uf, (b, w) => {
        let m = r.get(w);
        return m === void 0 ? b : `[^${m}]`;
      }),
    p = (h) => {
      let b = Number(r.get(h.label) ?? h.label);
      return Number.isFinite(b) ? b : Number.MAX_SAFE_INTEGER;
    },
    c = [];
  for (let h of u) {
    if (h.length < 2) continue;
    let b = [...h].sort((_, E) => p(_) - p(E));
    if (b.every((_, E) => _ === h[E])) continue;
    let w = [];
    for (let _ = 0; _ < h.length - 1; _++) {
      let E = [];
      for (let T = h[_].endLine + 1; T < h[_ + 1].startLine; T++) E.push(n[T]);
      w.push(E);
    }
    let m = [];
    b.forEach((_, E) => {
      for (let T = _.startLine; T <= _.endLine; T++) m.push(f(n[T]));
      E < w.length && m.push(...w[E]);
    });
    let S = h[0].startLine,
      g = h[h.length - 1].endLine;
    c.push({
      start: a[S],
      end: a[g] + n[g].length,
      text: m.join(`
`),
    });
  }
  let d = [
      ...i.filter((h) => !c.some((b) => h.start >= b.start && h.end <= b.end)),
      ...c,
    ].sort((h, b) => h.start - b.start),
    x = e;
  for (let h of [...d].reverse())
    x = x.slice(0, h.start) + h.text + x.slice(h.end);
  return { text: x, changed: d.length > 0, count: r.size, edits: d };
}
function $f(e, t) {
  let r = e.slice(0, t) + `[^${qf}]` + e.slice(t),
    i = r + Jp(r, qf),
    n = vi(i),
    a = new Map();
  for (let p of Wf(e))
    !p.isDefinition && !a.has(p.label) && a.set(p.label, p.index);
  let o = 0;
  for (let p of a.values()) p < t && (o += 1);
  let s = o + 1,
    u = 0;
  for (let p of n.edits) p.end <= t && (u += p.text.length - (p.end - p.start));
  let l = t + u,
    f = new RegExp(`^\\[\\^${s}\\]: $`, "m").exec(n.text);
  return {
    newNumber: s,
    text: n.text,
    markerEndOffset: l + `[^${s}]`.length,
    cursorOffset: f ? f.index + f[0].length : n.text.length,
  };
}
function tg(e) {
  if (e.length > 24 && e[0] === 137 && e[1] === 80 && e[2] === 78) {
    let t = new DataView(e.buffer, e.byteOffset, e.byteLength);
    return { width: t.getUint32(16), height: t.getUint32(20) };
  }
  if (e.length > 10 && e[0] === 71 && e[1] === 73 && e[2] === 70) {
    let t = new DataView(e.buffer, e.byteOffset, e.byteLength);
    return { width: t.getUint16(6, !0), height: t.getUint16(8, !0) };
  }
  if (e.length > 4 && e[0] === 255 && e[1] === 216) {
    let t = 2;
    for (; t + 9 < e.length; ) {
      if (e[t] !== 255) {
        t += 1;
        continue;
      }
      let r = e[t + 1],
        i = (e[t + 2] << 8) | e[t + 3];
      if (r >= 192 && r <= 207 && r !== 196 && r !== 200 && r !== 204)
        return {
          height: (e[t + 5] << 8) | e[t + 6],
          width: (e[t + 7] << 8) | e[t + 8],
        };
      if (i <= 0) break;
      t += 2 + i;
    }
  }
}
function rg(e) {
  let t = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(e)?.[1]?.toLowerCase() ?? "png";
  return t === "jpg" || t === "jpeg"
    ? "image/jpg"
    : t === "gif"
      ? "image/gif"
      : t === "bmp"
        ? "image/bmp"
        : "image/png";
}
function Hf(e, t, r, i, n = 6) {
  let a = tg(r) ?? { width: 800, height: 600 },
    o = Math.round(n * 7200),
    s = Math.round((a.width * 7200) / 96),
    u = Math.round((a.height * 7200) / 96),
    l = Math.min(o, s),
    f = Math.max(1, Math.round((l * a.height) / a.width));
  return {
    id: e,
    fileName: t,
    bytes: r,
    mediaType: rg(i),
    width: l,
    height: f,
    clipWidth: s,
    clipHeight: u,
    comment: `\uADF8\uB9BC\uC785\uB2C8\uB2E4.
\uC6D0\uBCF8 \uADF8\uB9BC\uC758 \uC774\uB984: ${t}
\uC6D0\uBCF8 \uADF8\uB9BC\uC758 \uD06C\uAE30: \uAC00\uB85C ${a.width}pixel, \uC138\uB85C ${a.height}pixel`,
  };
}
function jf(e, t) {
  if (t.length === 0) return e;
  let r = t
    .filter((n) => !e.includes(`href="BinData/${n.fileName}"`))
    .map(
      (n) =>
        `<opf:item id="${n.id}" href="BinData/${n.fileName}" media-type="${n.mediaType}" isEmbeded="1"/>`,
    )
    .join("");
  if (!r) return e;
  let i = e.indexOf("<opf:item ");
  return i < 0
    ? e.replace(/(<opf:manifest[^>]*>)/, `$1${r}`)
    : e.slice(0, i) + r + e.slice(i);
}
function gr(e) {
  return e === "keep" || e === "straight" ? e : "curly";
}
var ig = /[\s([{<«‹「『《〈【〔“‘—–]/u,
  ng = /[\s.,;:!?)\]}>»›」』》〉】〕”’…·]/u,
  Zf = /[A-Za-z0-9]/;
function ag(e, t) {
  for (let r = t + 1; r < e.length; r++) if (e[r] !== "*") return e[r];
  return "";
}
function og(e) {
  for (let t = e.length - 1; t >= 0; t--) if (e[t] !== "*") return e[t];
  return "";
}
function va(e, t) {
  if (t.double === "keep" && t.single === "keep") return e;
  let r = [...e],
    i = [],
    n = !1,
    a = !1;
  for (let o = 0; o < r.length; o++) {
    let s = r[o],
      u = og(i),
      l = ag(r, o),
      f = u === "" || ig.test(u),
      p = l === "" || ng.test(l);
    if (s === '"' || s === "\u201C" || s === "\u201D") {
      if (t.double === "straight") i.push('"');
      else if (t.double === "curly" && s === '"') {
        let c = f ? !0 : p ? !1 : !n;
        i.push(c ? "\u201C" : "\u201D"), (n = c);
      } else i.push(s), s === "\u201C" ? (n = !0) : s === "\u201D" && (n = !1);
      continue;
    }
    if (s === "'" || s === "\u2018" || s === "\u2019") {
      let c = Zf.test(u) && Zf.test(l);
      if (t.single === "straight") i.push("'");
      else if (t.single === "curly" && s === "'")
        if (c) i.push("\u2019");
        else {
          let d = f ? !0 : p ? !1 : !a;
          i.push(d ? "\u2018" : "\u2019"), (a = d);
        }
      else
        i.push(s), s === "\u2018" ? (a = !0) : s === "\u2019" && !c && (a = !1);
      continue;
    }
    i.push(s);
  }
  return i.join("");
}
var sg = "\u3000";
function Kf(e, t) {
  let r = 0,
    i = "";
  for (let n of e) {
    let a = n.codePointAt(0);
    if (t === "toHalf") {
      if (a >= 65281 && a <= 65374) {
        (i += String.fromCharCode(a - 65248)), r++;
        continue;
      }
      if (n === sg) {
        (i += " "), r++;
        continue;
      }
    } else if (a >= 33 && a <= 126) {
      (i += String.fromCharCode(a + 65248)), r++;
      continue;
    }
    i += n;
  }
  return { text: i, converted: r };
}
var lg = {
  "\u300C": "\uFF62",
  "\u300D": "\uFF63",
  "\u300E": "\u{F0854}",
  "\u300F": "\u{F0855}",
};
function Qf(e) {
  let t = "";
  for (let r of e) t += lg[r] ?? r;
  return t;
}
var fg = /\[\^([^\]\s]+)\]/g,
  ug =
    /\*\*\*(\S(?:[^*]*\S)?)\*\*\*|\*\*(\S(?:[^*]*\S)?)\*\*|\*(\S(?:[^*]*\S)?)\*/g;
function cg(e) {
  let t = [];
  for (let s of e.matchAll(/<hh:style\s+([^>]*?)\/?>/g)) {
    let u = s[1],
      l = (f) => new RegExp(`${f}="([^"]*)"`).exec(u)?.[1] ?? "";
    t.push({
      name: l("name"),
      engName: l("engName"),
      info: { id: l("id"), paraPr: l("paraPrIDRef"), charPr: l("charPrIDRef") },
    });
  }
  let r = (s, u) =>
      (t.find((l) => l.engName === s) ?? t.find((l) => l.name === u))?.info,
    i = r("Normal", "\uBC14\uD0D5\uAE00") ?? {
      id: "0",
      paraPr: "0",
      charPr: "0",
    },
    n = r("Footnote", "\uAC01\uC8FC") ?? i,
    a = r("Endnote", "\uBBF8\uC8FC") ?? n,
    o = [];
  for (let s = 1; s <= 7; s++) {
    let u = r(`Outline ${s}`, `\uAC1C\uC694 ${s}`);
    u && o.push(u);
  }
  return {
    normal: i,
    footnote: n,
    endnote: a,
    outlines: o,
    quotation:
      r("Quotation", "\uC778\uC6A9\uBB38") ?? r("Body", "\uBCF8\uBB38"),
  };
}
function _a(e) {
  let t = [],
    r = 0;
  for (let i of e.matchAll(ug)) {
    let n = i.index ?? 0;
    n > r && t.push({ text: e.slice(r, n), bold: !1, italic: !1 }),
      i[1] !== void 0
        ? t.push({ text: i[1], bold: !0, italic: !0 })
        : i[2] !== void 0
          ? t.push({ text: i[2], bold: !0, italic: !1 })
          : t.push({ text: i[3], bold: !1, italic: !0 }),
      (r = n + i[0].length);
  }
  return r < e.length && t.push({ text: e.slice(r), bold: !1, italic: !1 }), t;
}
function dg(e) {
  let t = e.split(`
`),
    r = ga(t),
    i = new Set(),
    n = new Map();
  for (let a of r) {
    for (let s = a.startLine; s <= a.endLine; s++) i.add(s);
    let o = [t[a.startLine].replace(/^\[\^[^\]\s]+\]:\s?/, "")];
    for (let s = a.startLine + 1; s <= a.endLine; s++) {
      let u = t[s].trim();
      u && o.push(u);
    }
    n.has(a.label) || n.set(a.label, o.join(" ").trim());
  }
  return { bodyLines: t.filter((a, o) => !i.has(o)), definitions: n };
}
function wa(e) {
  let { bodyLines: t, definitions: r } = dg(
      e.replace(
        /\r\n/g,
        `
`,
      ),
    ),
    i = [],
    n = [],
    a = 0,
    o = (u, l) => {
      let f = l !== void 0,
        p = f ? { quoteBlock: l } : {},
        c = u.join(" ").trim();
      if (!c) return;
      let d = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/.exec(c);
      if (d) {
        i.push({
          outlineLevel: 0,
          quote: !1,
          ...p,
          parts: [{ kind: "image", src: d[2], alt: d[1] }],
        });
        return;
      }
      let x = 0;
      if (!f) {
        let b = /^(#{1,6})\s+(.*)$/.exec(c);
        b && ((x = b[1].length), (c = b[2]));
      }
      let h = [];
      for (let b of _a(c)) {
        let w = {
            ...(b.bold ? { bold: !0 } : {}),
            ...(b.italic ? { italic: !0 } : {}),
          },
          m = 0;
        for (let S of b.text.matchAll(fg)) {
          let g = S.index ?? 0;
          g > m && h.push({ kind: "text", text: b.text.slice(m, g), ...w }),
            h.push({ kind: "footnote", content: r.get(S[1]) ?? "" }),
            (m = g + S[0].length);
        }
        m < b.text.length &&
          h.push({ kind: "text", text: b.text.slice(m), ...w });
      }
      h.length === 0 && h.push({ kind: "text", text: c }),
        i.push({ outlineLevel: x, quote: f, ...p, parts: h });
    },
    s = () => {
      if (n.length === 0) return;
      let u = n;
      if (((n = []), !u.every((f) => /^\s*>/.test(f)))) {
        o(u);
        return;
      }
      a += 1;
      let l = [];
      for (let f of u) {
        let p = f.replace(/^\s*>\s?/, "");
        p.trim() === "" ? (o(l, a), (l = [])) : l.push(p);
      }
      o(l, a);
    };
  for (let u of t) u.trim() === "" ? s() : n.push(u);
  return s(), i;
}
function hg(e, t) {
  return e.map((r) => ({
    ...r,
    parts: r.parts.map((i) =>
      i.kind === "text"
        ? { ...i, text: t(i.text) }
        : i.kind === "footnote"
          ? { ...i, content: t(i.content) }
          : i,
    ),
  }));
}
function pg(e, t) {
  return t.double === "keep" && t.single === "keep"
    ? e
    : e.map((r) => {
        let i = r.parts.map((o) => (o.kind === "text" ? o.text : "")).join(""),
          n = va(i, t),
          a = 0;
        return {
          ...r,
          parts: r.parts.map((o) => {
            if (o.kind === "footnote")
              return { ...o, content: va(o.content, t) };
            if (o.kind !== "text") return o;
            let s = n.slice(a, a + o.text.length);
            return (a += o.text.length), { ...o, text: s };
          }),
        };
      });
}
function gg(e) {
  let t = [];
  return (
    e.forEach((r, i) => {
      let n = e[i - 1];
      n !== void 0 &&
        n.quoteBlock !== r.quoteBlock &&
        (n.quoteBlock !== void 0 || r.quoteBlock !== void 0) &&
        t.push({ outlineLevel: 0, quote: !1, parts: [] }),
        t.push(r);
    }),
    t
  );
}
function Xf(e, t) {
  return e.quote && t.quotation
    ? t.quotation
    : e.outlineLevel > 0 && t.outlines.length > 0
      ? t.outlines[Math.min(e.outlineLevel, t.outlines.length) - 1]
      : t.normal;
}
function vg(e, t) {
  let r = new Map(),
    i = e,
    n = 0;
  for (let o of i.matchAll(/<hh:charPr id="(\d+)"/g))
    n = Math.max(n, Number(o[1]));
  let a = 0;
  for (let o of t) {
    if (!o.bold && !o.italic) continue;
    let s = `${o.base}:${o.bold}:${o.italic}`;
    if (r.has(s)) continue;
    let u = o.base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      l = new RegExp(`<hh:charPr id="${u}"[^>]*>`).exec(i);
    if (!l) {
      r.set(s, o.base);
      continue;
    }
    let f;
    if (l[0].endsWith("/>")) f = l[0];
    else {
      let x = i.indexOf("</hh:charPr>", l.index);
      if (x < 0) {
        r.set(s, o.base);
        continue;
      }
      f = i.slice(l.index, x + 12);
    }
    let p = String(++n),
      c = f.replace(/(<hh:charPr id=")[^"]*(")/, `$1${p}$2`),
      d = "";
    if (
      (o.italic && !c.includes("<hh:italic") && (d += "<hh:italic/>"),
      o.bold && !c.includes("<hh:bold") && (d += "<hh:bold/>"),
      d)
    )
      if (c.endsWith("/>")) c = `${c.slice(0, -2)}>${d}</hh:charPr>`;
      else {
        let x = /<hh:offset[^>]*\/>/.exec(c);
        c = x
          ? c.replace(x[0], `${x[0]}${d}`)
          : c.replace("</hh:charPr>", `${d}</hh:charPr>`);
      }
    (i = i.replace("</hh:charProperties>", `${c}</hh:charProperties>`)),
      r.set(s, p),
      (a += 1);
  }
  return (
    a > 0 &&
      (i = i.replace(
        /(<hh:charProperties[^>]*itemCnt=")(\d+)(")/,
        (o, s, u, l) => `${s}${Number(u) + a}${l}`,
      )),
    {
      headerXml: i,
      idFor: (o, s, u) => (!s && !u ? o : (r.get(`${o}:${s}:${u}`) ?? o)),
    }
  );
}
function vr(e) {
  let t = "";
  for (let r of e) {
    let i = r.charCodeAt(0);
    (i < 32 && i !== 9 && i !== 10 && i !== 13) || (t += r);
  }
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function mg(e, t, r, i = "footnote", n = new Map(), a = (o) => o) {
  let o = e.indexOf("</hp:secPr>");
  if (o < 0)
    throw new Error(
      "\uD15C\uD50C\uB9BF section0.xml\uC5D0\uC11C \uC139\uC158 \uC124\uC815(secPr)\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4",
    );
  let s = e.indexOf("</hp:run>", o);
  if (s < 0)
    throw new Error(
      "\uD15C\uD50C\uB9BF section0.xml\uC758 \uCCAB run \uACBD\uACC4\uB97C \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4",
    );
  let u = e.slice(0, s + 9),
    l = i === "endnote",
    f = l ? "endNote" : "footNote",
    p = l ? "ENDNOTE" : "FOOTNOTE",
    c = l ? r.endnote : r.footnote,
    x =
      (l
        ? /<hp:endNotePr>[\s\S]*?<\/hp:endNotePr>/
        : /<hp:footNotePr>[\s\S]*?<\/hp:footNotePr>/
      ).exec(e)?.[0] ?? "",
    h =
      /<hp:autoNumFormat[^>]*\/>/.exec(x)?.[0] ??
      '<hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/>',
    b = /suffixChar="([^"]*)"/.exec(h)?.[1] ?? "",
    w = b ? ` suffixChar="${b.charCodeAt(0)}"` : "",
    m = 900000001,
    S = 0,
    g = (y) => Xf(y, r),
    _ = (y, M) => {
      let { width: F, height: J } = y;
      return `<hp:run charPrIDRef="${M}"><hp:pic id="${m++}" zOrder="0" numberingType="PICTURE" textWrap="SQUARE" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="${m++}" reverse="0"><hp:offset x="0" y="0"/><hp:orgSz width="${F}" height="${J}"/><hp:curSz width="0" height="0"/><hp:flip horizontal="0" vertical="0"/><hp:rotationInfo angle="0" centerX="${Math.round(F / 2)}" centerY="${Math.round(J / 2)}" rotateimage="1"/><hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo><hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="${F}" y="0"/><hc:pt2 x="${F}" y="${J}"/><hc:pt3 x="0" y="${J}"/></hp:imgRect><hp:imgClip left="0" right="${y.clipWidth}" top="0" bottom="${y.clipHeight}"/><hp:inMargin left="0" right="0" top="0" bottom="0"/><hc:img binaryItemIDRef="${y.id}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/><hp:effects/><hp:sz width="${F}" widthRelTo="ABSOLUTE" height="${J}" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="CENTER" vertOffset="0" horzOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:shapeComment>${vr(y.comment)}</hp:shapeComment></hp:pic></hp:run>`;
    },
    E = (y) => {
      let M = g(y);
      return y.parts
        .map((F) => {
          if (F.kind === "text")
            return `<hp:run charPrIDRef="${a(M.charPr, F.bold === !0, F.italic === !0)}"><hp:t>${vr(F.text)}</hp:t></hp:run>`;
          if (F.kind === "image") {
            let Q = n.get(F.src);
            return Q
              ? _(Q, M.charPr)
              : `<hp:run charPrIDRef="${M.charPr}"><hp:t>${vr(`[\uADF8\uB9BC \uC5C6\uC74C: ${F.src}]`)}</hp:t></hp:run>`;
          }
          S += 1;
          let J = _a(F.content),
            xr = J.some((Q) => Q.bold || Q.italic)
              ? "<hp:t> </hp:t></hp:run>" +
                J.map(
                  (Q) =>
                    `<hp:run charPrIDRef="${a(c.charPr, Q.bold, Q.italic)}"><hp:t>${vr(Q.text)}</hp:t></hp:run>`,
                ).join("")
              : `<hp:t> ${vr(F.content)}</hp:t></hp:run>`;
          return `<hp:run charPrIDRef="${M.charPr}"><hp:ctrl><hp:${f} number="${S}"${w} instId="${m++}"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0"><hp:p id="${m++}" paraPrIDRef="${c.paraPr}" styleIDRef="${c.id}" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${c.charPr}"><hp:ctrl><hp:autoNum num="${S}" numType="${p}">${h}</hp:autoNum></hp:ctrl>${xr}</hp:p></hp:subList></hp:${f}></hp:ctrl></hp:run>`;
        })
        .join("");
    },
    T = t[0];
  if (T) {
    let y = g(T);
    u = u
      .replace(/(<hp:p [^>]*?paraPrIDRef=")[^"]*(")/, `$1${y.paraPr}$2`)
      .replace(/(<hp:p [^>]*?styleIDRef=")[^"]*(")/, `$1${y.id}$2`);
  }
  let C = `<hp:run charPrIDRef="${r.normal.charPr}"><hp:t/></hp:run>`,
    I = (T && E(T)) || C,
    B = t
      .slice(1)
      .map((y) => {
        let M = g(y);
        return `<hp:p id="${m++}" paraPrIDRef="${M.paraPr}" styleIDRef="${M.id}" pageBreak="0" columnBreak="0" merged="0">${E(y) || C}</hp:p>`;
      })
      .join("");
  return `${u}${I}</hp:p>${B}</hs:sec>`;
}
async function Gf(e, t, r = {}) {
  let i = await ma.default.loadAsync(t),
    n = i.file("Contents/header.xml"),
    a = i.file("Contents/section0.xml");
  if (!n || !a)
    throw new Error(
      "\uC62C\uBC14\uB978 hwpx \uD15C\uD50C\uB9BF\uC774 \uC544\uB2D9\uB2C8\uB2E4 (Contents/header.xml\xB7section0.xml \uD544\uC694)",
    );
  let o = await n.async("string"),
    s = cg(o),
    u = pg(wa(e), {
      double: r.doubleQuotes ?? "curly",
      single: r.singleQuotes ?? "curly",
    }),
    l = r.halfwidthBrackets ? hg(u, Qf) : u,
    f = r.quoteBlankLines ? gg(l) : l,
    p = r.noteType ?? "footnote",
    c = p === "endnote" ? s.endnote : s.footnote,
    d = [];
  for (let g of f) {
    let _ = Xf(g, s);
    for (let E of g.parts)
      if (E.kind === "text" && (E.bold === !0 || E.italic === !0))
        d.push({
          base: _.charPr,
          bold: E.bold === !0,
          italic: E.italic === !0,
        });
      else if (E.kind === "footnote")
        for (let T of _a(E.content))
          (T.bold || T.italic) &&
            d.push({ base: c.charPr, bold: T.bold, italic: T.italic });
  }
  let x = vg(o, d),
    h = new Map();
  if (r.readImage)
    for (let g of f)
      for (let _ of g.parts) {
        if (_.kind !== "image" || h.has(_.src)) continue;
        let E = r.readImage(_.src);
        if (!E) continue;
        let T =
            /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(_.src)?.[1]?.toLowerCase() ??
            "png",
          C = h.size + 1;
        h.set(
          _.src,
          Hf(`image${C}`, `image${C}.${T}`, E, _.src, r.imageWidthInch),
        );
      }
  let b = mg(await a.async("string"), f, s, p, h, x.idFor),
    w = new ma.default(),
    m = i.file("mimetype");
  m &&
    w.file("mimetype", await m.async("uint8array"), { compression: "STORE" });
  let S = [...h.values()];
  for (let g of Object.keys(i.files)) {
    let _ = i.files[g];
    _.dir ||
      g === "mimetype" ||
      (g === "Contents/section0.xml"
        ? w.file(g, b)
        : g === "Contents/header.xml"
          ? w.file(g, x.headerXml)
          : g === "Contents/content.hpf"
            ? w.file(g, jf(await _.async("string"), S))
            : w.file(g, await _.async("uint8array")));
  }
  for (let g of S) w.file(`BinData/${g.fileName}`, g.bytes);
  return w.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
var _g = 200,
  wg = 20;
function ba(e) {
  let t = wa(e),
    r = [];
  for (let u of t) {
    let l = "";
    for (let f of u.parts) f.kind === "text" && (l += f.text);
    l.trim() && r.push(l);
    for (let f of u.parts)
      f.kind === "footnote" && f.content.trim() && r.push(" " + f.content);
  }
  let i = 0,
    n = 0,
    a = 0,
    o = 0;
  for (let u of r) {
    let l = [...u];
    (i += l.length),
      (n += l.filter((f) => !/\s/.test(f)).length),
      (a += l.filter((f) => /[A-Za-z]/.test(f)).length),
      (o += u.split(/\s+/).filter(Boolean).length);
  }
  let s = i - a * 0.5;
  return {
    chars: i,
    charsNoSpace: n,
    latinChars: a,
    words: o,
    rows: Math.ceil(s / wg),
    sheets: s / _g,
  };
}
function Jf(e, t) {
  let r = e.replace(/^\s*(?:>\s*)?(?:#{1,6}\s+)?/, "");
  switch (t.kind) {
    case "body":
      return r;
    case "quote":
      return r ? `> ${r}` : e;
    case "heading": {
      let i = Math.min(Math.max(t.level, 1), 6);
      return r ? `${"#".repeat(i)} ${r}` : e;
    }
  }
}

module.exports = { renumber: vi, insert: $f, quotes: va, width: Kf, halfBrackets: Qf, parse: wa, toHwpx: Gf, count: ba, paraStyle: Jf };
