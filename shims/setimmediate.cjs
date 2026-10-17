// JSZip(lib)이 불러오는 setimmediate 패키지 대신 쓴다(esbuild.config.mjs의 alias).
// 원래 패키지는 script 요소 생성·new Function으로 setImmediate를 흉내 내서 커뮤니티 디렉터리 검토에 걸린다.
// Electron에는 setImmediate가 있고, 없는 곳(모바일 WebView)에서는 setTimeout으로 충분하다.
"use strict";
if (typeof globalThis.setImmediate !== "function") {
	globalThis.setImmediate = function (fn) {
		var args = Array.prototype.slice.call(arguments, 1);
		return globalThis.setTimeout(function () {
			fn.apply(null, args);
		}, 0);
	};
}
