import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
	...obsidianmd.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				projectService: { allowDefaultProject: ["eslint.config.mjs"] },
			},
		},
		rules: {
			"obsidianmd/ui/sentence-case": ["warn", { acronyms: ["HWPX", "HWP"] }],
		},
	},
	{ ignores: ["main.js", "test-vault/**", "node_modules/**", "tests/**", "scripts/**", "shims/**", ".harness/**", "esbuild.config.mjs", "vitest.config.ts"] },
]);
