// 겹낫표 '자동' 모드용 Windows IME 한/영 상태 조회.
// 원본 HanMark(gkman1, MIT)의 media/ime-helper.ps1과 같은 방식이다: 상주 PowerShell 프로세스가
// 전경 창의 기본 IME 창에 WM_IME_CONTROL을 보내 상태를 읽고, 한 줄 요청마다 한 줄로 답한다.
// 브라우저 키 이벤트로는 한/영 상태를 알 수 없어서(Electron 창은 조합 중이 아니면 [ 키가 그대로 온다)
// 키를 누르는 순간 입력기에 직접 묻는다. Windows 데스크톱에서만 쓰고, 나머지 환경에서는 쓰지 않는다.

import { Platform } from "obsidian";

/** child_process에서 쓰는 부분만(모듈을 들이지 않으려고 직접 적는다). */
interface ChildProcessWithoutNullStreams {
	stdin: { write(s: string): unknown };
	stdout: { setEncoding(e: string): unknown; on(ev: "data", f: (d: string) => void): unknown };
	on(ev: "error" | "exit", f: () => void): unknown;
	kill(): unknown;
}

// 원본 스크립트와 같은 내용(주석은 줄였다). 파일을 따로 배포하지 않으려고 -EncodedCommand로 넘긴다.
const HELPER_SCRIPT = String.raw`
$src = @"
using System;
using System.Runtime.InteropServices;
public static class ImeQuery
{
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("imm32.dll")] public static extern IntPtr ImmGetDefaultIMEWnd(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern IntPtr SendMessageTimeout(
        IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam, uint flags, uint timeout, out IntPtr result);
    public static long Query(int cmd)
    {
        IntPtr fg = GetForegroundWindow();
        if (fg == IntPtr.Zero) return -3;
        IntPtr ime = ImmGetDefaultIMEWnd(fg);
        if (ime == IntPtr.Zero) return -2;
        IntPtr result;
        IntPtr ok = SendMessageTimeout(ime, 0x283, (IntPtr)cmd, IntPtr.Zero, 0x0002, 100, out result);
        if (ok == IntPtr.Zero) return -1;
        return result.ToInt64();
    }
    // IMC_GETOPENSTATUS alone is unreliable for Electron windows on some Windows 11 IME versions;
    // the hangul/english toggle shows in IME_CMODE_NATIVE (0x1) of IMC_GETCONVERSIONMODE.
    public static int IsKoreanMode()
    {
        long open = Query(0x005);
        if (open <= 0) return 0;
        long conv = Query(0x001);
        if (conv < 0) return 1;
        return (conv & 0x1) != 0 ? 1 : 0;
    }
    public static string Debug() { return "open=" + Query(0x005) + " conv=" + Query(0x001); }
}
"@
Add-Type -TypeDefinition $src -Language CSharp
while ($true) {
    $line = [Console]::In.ReadLine()
    if ($null -eq $line -or $line -eq 'exit') { break }
    if ($line -eq 'q') { [Console]::Out.WriteLine([ImeQuery]::IsKoreanMode()); [Console]::Out.Flush() }
    elseif ($line -eq 'd') { [Console]::Out.WriteLine([ImeQuery]::Debug()); [Console]::Out.Flush() }
}
`;

/** PowerShell -EncodedCommand 인자(UTF-16LE base64). */
export function encodeHelperCommand(script = HELPER_SCRIPT): string {
	let bin = "";
	for (let i = 0; i < script.length; i++) {
		const c = script.charCodeAt(i);
		bin += String.fromCharCode(c & 0xff, c >> 8);
	}
	return btoa(bin);
}

interface Pending {
	settled: boolean;
	resolve: (v: string | null) => void;
	timer: number;
}

type Spawn = (cmd: string, args: string[], opts: object) => ChildProcessWithoutNullStreams;

export class ImeProbe {
	private proc: ChildProcessWithoutNullStreams | null = null;
	private pending: Pending[] = [];
	private buffer = "";

	constructor(private readonly spawnFn: () => Spawn | null = defaultSpawn) {}

	get available(): boolean {
		return Platform.isDesktopApp && Platform.isWin;
	}

	/** 첫 질의는 C# 컴파일 때문에 1초 남짓 걸리므로 미리 띄워 둔다. */
	warmUp(): void {
		if (this.available) void this.request("q", 5000);
	}

	/** true = 한글, false = 영어, null = 알 수 없음(시간 초과·실패). */
	async isKoreanMode(timeoutMs = 250): Promise<boolean | null> {
		const r = await this.request("q", timeoutMs);
		return r === null ? null : r === "1";
	}

	debugInfo(timeoutMs = 3000): Promise<string | null> {
		return this.request("d", timeoutMs);
	}

	request(cmd: string, timeoutMs: number): Promise<string | null> {
		if (!this.available) return Promise.resolve(null);
		this.ensureProcess();
		const p = this.proc;
		if (!p) return Promise.resolve(null);
		return new Promise((resolve) => {
			const entry: Pending = {
				settled: false,
				resolve,
				timer: window.setTimeout(() => {
					if (!entry.settled) {
						entry.settled = true;
						resolve(null);
					}
					// 응답 순서가 어긋날 수 있으니 프로세스를 새로 띄운다(원본과 같음).
					this.teardown();
				}, timeoutMs),
			};
			this.pending.push(entry);
			try {
				p.stdin.write(`${cmd}\n`);
			} catch {
				this.teardown();
			}
		});
	}

	dispose(): void {
		try {
			this.proc?.stdin.write("exit\n");
		} catch {
			// 이미 끝난 프로세스
		}
		this.teardown();
	}

	private ensureProcess() {
		if (this.proc) return;
		const spawn = this.spawnFn();
		if (!spawn) return;
		try {
			const p = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encodeHelperCommand()], {
				windowsHide: true,
				stdio: ["pipe", "pipe", "ignore"],
			});
			p.stdout.setEncoding("utf8");
			p.stdout.on("data", (d: string) => this.onData(d));
			p.on("error", () => this.teardown());
			p.on("exit", () => this.teardown());
			this.proc = p;
		} catch {
			this.proc = null;
		}
	}

	private onData(chunk: string) {
		this.buffer += chunk;
		let nl: number;
		while ((nl = this.buffer.indexOf("\n")) >= 0) {
			const line = this.buffer.slice(0, nl).trim();
			this.buffer = this.buffer.slice(nl + 1);
			const head = this.pending.shift();
			if (head && !head.settled) {
				head.settled = true;
				window.clearTimeout(head.timer);
				head.resolve(line);
			}
		}
	}

	private teardown() {
		const p = this.proc;
		this.proc = null;
		this.buffer = "";
		for (const e of this.pending.splice(0)) {
			window.clearTimeout(e.timer);
			if (!e.settled) {
				e.settled = true;
				e.resolve(null);
			}
		}
		p?.kill();
	}
}

/** 데스크톱에서만 child_process를 불러온다(모바일에서는 모듈이 없다). */
function defaultSpawn(): Spawn | null {
	if (!Platform.isDesktop) return null;
	try {
		// Electron 렌더러의 Node require. 모바일에는 없다.
		const req = (window as unknown as { require?: (m: string) => unknown }).require;
		const cp = req?.("child_process") as { spawn?: Spawn } | undefined;
		return cp?.spawn ?? null;
	} catch {
		return null;
	}
}
