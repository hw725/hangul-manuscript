// JSZip(lib)은 전역 Promise가 없을 때만 lie를 쓴다. Obsidian은 늘 Promise가 있으므로 전역 것을 그대로 넘긴다.
// 원래 lie가 끌어오는 immediate 패키지가 script 요소를 만들어 커뮤니티 디렉터리 검토에 걸린다.
"use strict";
module.exports = Promise;
