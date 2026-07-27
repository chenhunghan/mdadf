#!/usr/bin/env bun
/**
 * Build a native mdadf binary with scriptc (https://github.com/vercel-labs/scriptc).
 *
 * EXPERIMENTAL / EVALUATION ONLY — not part of the release pipeline.
 *
 * scriptc compiles TypeScript to a native executable with no JS engine, except
 * for `--dynamic` "island" sites which run on an embedded QuickJS-ng. The
 * @atlaskit/prosemirror stack cannot compile statically, so --dynamic is required.
 *
 * src/index.ts is Bun-specific in three spots. Rather than fork the CLI (which
 * would make any differential test compare two different implementations), this
 * generates an entry that reuses src/index.ts verbatim apart from those three
 * substitutions, so src/preprocess.ts, src/postprocess.ts, and all the CLI logic
 * under test are the real ones.
 *
 * Usage:
 *   bun run scripts/build-scriptc.ts [--out <path>] [--coverage]
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const BUILD_DIR = join(ROOT, ".scriptc-build");
const ENTRY = join(BUILD_DIR, "entry.ts");

/** Each substitution must apply, or the generated entry is silently wrong. */
const SUBSTITUTIONS: Array<{ from: string; to: string; why: string }> = [
	{
		from: "await Bun.stdin.text()",
		to: 'readFileSync(0, "utf-8")',
		why: "Bun.stdin is not available outside Bun; fd 0 is portable",
	},
	{
		from: "Bun.argv.slice(2)",
		to: "process.argv.slice(2)",
		why: "Bun.argv is not available outside Bun",
	},
	{
		from: "import.meta.main",
		to: "true",
		why: "SC2020: ImportMeta.main has no scriptc lowering; this entry is always main",
	},
	{
		from: 'from "./postprocess"',
		to: 'from "../src/postprocess"',
		why: "entry lives in .scriptc-build/, not src/",
	},
	{
		from: 'from "./preprocess"',
		to: 'from "../src/preprocess"',
		why: "entry lives in .scriptc-build/, not src/",
	},
];

function generateEntry(): string {
	let source = readFileSync(join(ROOT, "src/index.ts"), "utf-8");

	for (const { from, to, why } of SUBSTITUTIONS) {
		if (!source.includes(from)) {
			throw new Error(
				`build-scriptc: expected to find ${JSON.stringify(from)} in src/index.ts (${why}).\n` +
					"src/index.ts changed shape — update SUBSTITUTIONS in this script.",
			);
		}
		source = source.replaceAll(from, to);
	}

	// "../package.json" resolves correctly from .scriptc-build/ (same depth as src/).
	return source;
}

async function main() {
	const args = process.argv.slice(2);
	const outIdx = args.indexOf("--out");
	const out = outIdx >= 0 ? args[outIdx + 1] : join(ROOT, "mdadf-native");
	const coverageOnly = args.includes("--coverage");

	if (!out) {
		process.stderr.write("Error: --out requires a path\n");
		process.exit(1);
	}

	mkdirSync(BUILD_DIR, { recursive: true });
	writeFileSync(ENTRY, generateEntry());
	process.stdout.write(`generated ${ENTRY}\n`);

	const scriptcArgs = coverageOnly
		? ["coverage", ENTRY, "--dynamic"]
		: ["build", ENTRY, "--dynamic", "-o", out];

	const proc = Bun.spawn(["scriptc", ...scriptcArgs], { stdout: "inherit", stderr: "inherit" });
	const code = await proc.exited;
	if (code !== 0) {
		process.stderr.write(`\nscriptc exited ${code}\n`);
		process.exit(code);
	}
	if (!coverageOnly) process.stdout.write(`\nbuilt ${out}\n`);
}

main();
