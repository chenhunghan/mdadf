import { describe, expect, test } from "bun:test";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "../src/index";

const CLI = join(import.meta.dir, "../src/index.ts");

async function run(
	args: string[] = [],
	stdin?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	const proc = Bun.spawn(["bun", "run", CLI, ...args], {
		stdin: stdin != null ? new Blob([stdin]) : undefined,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	const exitCode = await proc.exited;
	return { stdout, stderr, exitCode };
}

// ── parseArgs unit tests ──────────────────────────────────────────

describe("parseArgs", () => {
	test("no args returns defaults", () => {
		const result = parseArgs([]);
		expect(result).toEqual({ file: undefined, output: undefined, compact: false });
	});

	test("file argument", () => {
		const result = parseArgs(["test.md"]);
		expect(result.file).toBe("test.md");
	});

	test("--compact flag", () => {
		expect(parseArgs(["-c"]).compact).toBe(true);
		expect(parseArgs(["--compact"]).compact).toBe(true);
	});

	test("--output flag", () => {
		expect(parseArgs(["-o", "out.json"]).output).toBe("out.json");
		expect(parseArgs(["--output", "out.json"]).output).toBe("out.json");
	});

	test("combined flags", () => {
		const result = parseArgs(["-c", "-o", "out.json", "input.md"]);
		expect(result.compact).toBe(true);
		expect(result.output).toBe("out.json");
		expect(result.file).toBe("input.md");
	});
});

// ── CLI integration tests ─────────────────────────────────────────

describe("CLI stdin", () => {
	test("converts piped markdown to ADF JSON", async () => {
		const { stdout, exitCode } = await run([], "# Hello");
		expect(exitCode).toBe(0);
		const adf = JSON.parse(stdout);
		expect(adf.version).toBe(1);
		expect(adf.type).toBe("doc");
		expect(adf.content[0].type).toBe("heading");
	});

	test("--compact outputs minified JSON", async () => {
		const { stdout, exitCode } = await run(["--compact"], "# Hello");
		expect(exitCode).toBe(0);
		expect(stdout.trim()).not.toContain("\n");
		const adf = JSON.parse(stdout);
		expect(adf.content[0].type).toBe("heading");
	});
});

describe("CLI file input", () => {
	const tmpFile = join(tmpdir(), `mdadf-test-${Date.now()}.md`);

	test("reads from file argument", async () => {
		writeFileSync(tmpFile, "**bold**");
		const { stdout, exitCode } = await run([tmpFile]);
		expect(exitCode).toBe(0);
		const adf = JSON.parse(stdout);
		expect(adf.content[0].content[0].marks[0].type).toBe("strong");
		unlinkSync(tmpFile);
	});
});

describe("CLI --output flag", () => {
	const outFile = join(tmpdir(), `mdadf-out-${Date.now()}.json`);

	test("writes to output file", async () => {
		const { stdout, exitCode } = await run(["-o", outFile], "# Out");
		expect(exitCode).toBe(0);
		expect(stdout).toBe(""); // nothing on stdout
		const content = await Bun.file(outFile).text();
		const adf = JSON.parse(content);
		expect(adf.content[0].type).toBe("heading");
		unlinkSync(outFile);
	});
});

describe("CLI --help and --version", () => {
	test("--help prints usage and exits 0", async () => {
		const { stdout, exitCode } = await run(["--help"]);
		expect(exitCode).toBe(0);
		expect(stdout).toContain("Usage:");
		expect(stdout).toContain("mdadf");
	});

	test("--version prints version and exits 0", async () => {
		const { stdout, exitCode } = await run(["--version"]);
		expect(exitCode).toBe(0);
		expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
	});
});

// ── CLI error handling ────────────────────────────────────────────

describe("CLI error handling", () => {
	test("missing file shows clean error", async () => {
		const { stderr, exitCode } = await run(["nonexistent.md"]);
		expect(exitCode).toBe(1);
		expect(stderr).toContain("file not found");
		expect(stderr).toContain("nonexistent.md");
	});

	test("directory as input shows clean error", async () => {
		const { stderr, exitCode } = await run([tmpdir()]);
		expect(exitCode).toBe(1);
		expect(stderr).toContain("is a directory");
	});

	test("unknown flag shows clean error", async () => {
		const { stderr, exitCode } = await run(["--badopt"]);
		expect(exitCode).toBe(1);
		expect(stderr).toContain("unknown option");
		expect(stderr).toContain("--badopt");
	});

	test("--output without path shows clean error", async () => {
		const { stderr, exitCode } = await run(["--output"]);
		expect(exitCode).toBe(1);
		expect(stderr).toContain("--output requires a file path");
	});
});
