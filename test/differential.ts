#!/usr/bin/env bun
/**
 * Differential test: run the same markdown corpus through two mdadf builds and
 * assert they agree, then assert the reference build's output is still valid ADF.
 *
 * Usage:
 *   bun run test/differential.ts <cmdA> <cmdB>
 *
 * Each argument is a shell-free command: either a path to a compiled binary, or
 * a space-separated command such as "bun run src/index.ts".
 *
 *   bun run test/differential.ts "bun run src/index.ts" ./mdadf
 *   bun run test/differential.ts ./mdadf ./mdadf-native
 *
 * Exits non-zero on any divergence, unexpected exit code, or schema violation.
 */

import Ajv04 from "ajv-draft-04";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CORPUS_DIR = join(import.meta.dir, "corpus");

const schemaJson = JSON.parse(readFileSync(new URL("./adf-schema.json", import.meta.url), "utf-8"));
const ajv = new Ajv04({ allErrors: true, strict: false });
const validateAdf = ajv.compile(schemaJson);

interface RunResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

async function runCmd(cmd: string[], args: string[], stdin?: string): Promise<RunResult> {
	const proc = Bun.spawn([...cmd, ...args], {
		stdin: stdin != null ? new Blob([stdin]) : "ignore",
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	return { stdout, stderr, exitCode: await proc.exited };
}

const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/**
 * Replace UUIDs with sequential placeholders in first-seen order.
 *
 * `postprocessAdf` mints a fresh randomUUID() per taskList/taskItem localId, so
 * raw output is never byte-identical across runs. Mapping each distinct UUID to
 * a positional placeholder (rather than blanking them all) keeps the comparison
 * sensitive to a build that reuses one id where the other mints two — a real
 * risk given `uuid.generate` appears in scriptc's deferred-site list.
 */
function normalizeUuids(json: string): string {
	const seen = new Map<string, string>();
	return json.replace(UUID_RE, (u) => {
		const key = u.toLowerCase();
		let placeholder = seen.get(key);
		if (!placeholder) {
			placeholder = `<uuid-${seen.size}>`;
			seen.set(key, placeholder);
		}
		return placeholder;
	});
}

/** Every localId must be a well-formed v4 UUID, and all must be distinct. */
function checkLocalIds(adf: unknown, failures: string[]): void {
	const ids: string[] = [];
	const walk = (node: unknown): void => {
		if (Array.isArray(node)) {
			node.forEach(walk);
			return;
		}
		if (node === null || typeof node !== "object") return;
		const obj = node as Record<string, unknown>;
		const attrs = obj.attrs as Record<string, unknown> | undefined;
		if (attrs && typeof attrs.localId === "string") ids.push(attrs.localId);
		Object.values(obj).forEach(walk);
	};
	walk(adf);

	const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	for (const id of ids) {
		if (!V4.test(id)) failures.push(`malformed v4 localId: ${JSON.stringify(id)}`);
	}
	if (new Set(ids).size !== ids.length) {
		failures.push(`duplicate localIds among ${ids.length} (${new Set(ids).size} distinct)`);
	}
}

/**
 * Locate the first differing line and show a window around the first differing
 * column. Compact output is one enormous line, so an untrimmed dump is useless.
 */
function firstDiff(a: string, b: string): string {
	const aLines = a.split("\n");
	const bLines = b.split("\n");
	const WINDOW = 60;

	for (let i = 0; i < Math.max(aLines.length, bLines.length); i++) {
		const al = aLines[i] ?? "<missing line>";
		const bl = bLines[i] ?? "<missing line>";
		if (al === bl) continue;

		let col = 0;
		while (col < al.length && col < bl.length && al[col] === bl[col]) col++;
		const from = Math.max(0, col - WINDOW / 2);
		const window = (s: string) => {
			const slice = s.slice(from, from + WINDOW);
			return `${from > 0 ? "…" : ""}${slice}${from + WINDOW < s.length ? "…" : ""}`;
		};

		return [
			`line ${i + 1}, col ${col + 1}:`,
			`      A: ${window(al)}`,
			`      B: ${window(bl)}`,
		].join("\n    ");
	}
	return "(no line differs — trailing bytes only)";
}

async function main() {
	const [rawA, rawB] = process.argv.slice(2);
	if (!rawA || !rawB) {
		process.stderr.write("Usage: bun run test/differential.ts <cmdA> <cmdB>\n");
		process.exit(2);
	}
	const cmdA = rawA.split(" ").filter(Boolean);
	const cmdB = rawB.split(" ").filter(Boolean);

	const corpus = readdirSync(CORPUS_DIR)
		.filter((f) => f.endsWith(".md"))
		.sort();
	if (corpus.length === 0) {
		process.stderr.write(`Error: no corpus files in ${CORPUS_DIR}\n`);
		process.exit(2);
	}

	process.stdout.write(`A: ${cmdA.join(" ")}\nB: ${cmdB.join(" ")}\n`);
	process.stdout.write(`corpus: ${corpus.length} files × 2 input modes (file, stdin)\n\n`);

	const failures: string[] = [];
	let compared = 0;

	for (const name of corpus) {
		const path = join(CORPUS_DIR, name);
		const source = readFileSync(path, "utf-8");

		// Two input modes: file argument and piped stdin. They take different code
		// paths (statSync/readFileSync vs the stdin read), and scriptc reimplements
		// both, so each is worth covering.
		const modes: Array<{ label: string; args: string[]; stdin?: string }> = [
			{ label: "file", args: [path] },
			// An empty stdin is a deliberate error ("no input"), not a conversion —
			// exercised by cli.test.ts instead, so skip it here.
			...(source.length > 0 ? [{ label: "stdin", args: [] as string[], stdin: source }] : []),
		];

		for (const mode of modes) {
			for (const compact of [false, true]) {
				const args = compact ? ["--compact", ...mode.args] : mode.args;
				const label = `${name} [${mode.label}${compact ? ", compact" : ""}]`;

				const [a, b] = await Promise.all([
					runCmd(cmdA, args, mode.stdin),
					runCmd(cmdB, args, mode.stdin),
				]);
				compared++;

				if (a.exitCode !== b.exitCode) {
					failures.push(`${label}: exit code A=${a.exitCode} B=${b.exitCode}`);
					continue;
				}
				if (a.stderr !== b.stderr) {
					failures.push(
						`${label}: stderr differs\n    A: ${JSON.stringify(a.stderr)}\n    B: ${JSON.stringify(b.stderr)}`,
					);
				}

				// A fence throw in a scriptc build surfaces as a nonzero exit on input
				// the reference build handles fine. Never tolerate it silently.
				if (a.exitCode !== 0) {
					failures.push(
						`${label}: both builds exited ${a.exitCode}\n    stderr: ${a.stderr.trim()}`,
					);
					continue;
				}

				const normA = normalizeUuids(a.stdout);
				const normB = normalizeUuids(b.stdout);
				if (normA !== normB) {
					failures.push(
						`${label}: stdout differs after UUID normalization\n    ${firstDiff(normA, normB)}`,
					);
					continue;
				}

				// Agreement alone does not prove correctness — both builds could be
				// wrong together, and normalization hides UUID shape. Validate B (the
				// build under test) structurally.
				let parsed: unknown;
				try {
					parsed = JSON.parse(b.stdout);
				} catch (err) {
					failures.push(`${label}: B emitted invalid JSON: ${(err as Error).message}`);
					continue;
				}
				if (!validateAdf(parsed)) {
					const errs = validateAdf.errors
						?.slice(0, 5)
						.map((e) => `${e.instancePath} ${e.message}`)
						.join("; ");
					failures.push(`${label}: B failed ADF schema validation: ${errs}`);
				}
				const idFailures: string[] = [];
				checkLocalIds(parsed, idFailures);
				for (const f of idFailures) failures.push(`${label}: ${f}`);
			}
		}
		process.stdout.write(`  ${failures.length === 0 ? "ok" : "!!"}  ${name}\n`);
	}

	process.stdout.write(`\n${compared} comparisons across ${corpus.length} corpus files\n`);

	if (failures.length > 0) {
		process.stdout.write(`\n${failures.length} failure(s):\n\n`);
		for (const f of failures) process.stdout.write(`  ✗ ${f}\n`);
		process.exit(1);
	}
	process.stdout.write("no divergence\n");
}

main();
