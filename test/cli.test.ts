import { describe, expect, test } from "bun:test";
import { chmodSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "../src/index";

const CLI = join(import.meta.dir, "../src/index.ts");

// Run the source via bun by default. Set MDADF_BIN to a compiled binary to run
// this same suite against a release artifact:
//   MDADF_BIN=./mdadf bun test test/cli.test.ts
const CMD: string[] = process.env.MDADF_BIN ? [process.env.MDADF_BIN] : ["bun", "run", CLI];

async function run(
	args: string[] = [],
	stdin?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	const proc = Bun.spawn([...CMD, ...args], {
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

	test("-h prints usage and exits 0", async () => {
		const { stdout, exitCode } = await run(["-h"]);
		expect(exitCode).toBe(0);
		expect(stdout).toContain("Usage:");
	});

	test("--version prints version and exits 0", async () => {
		const { stdout, exitCode } = await run(["--version"]);
		expect(exitCode).toBe(0);
		expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
	});

	test("-v prints version and exits 0", async () => {
		const { stdout, exitCode } = await run(["-v"]);
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

	test("multiple file arguments shows clean error", async () => {
		const { stderr, exitCode } = await run(["a.md", "b.md"]);
		expect(exitCode).toBe(1);
		expect(stderr).toContain("expected one file argument, got multiple");
	});

	test("permission denied shows clean error", async () => {
		const noRead = join(tmpdir(), `mdadf-noperm-${Date.now()}.md`);
		writeFileSync(noRead, "# secret");
		chmodSync(noRead, 0o000);
		try {
			const { stderr, exitCode } = await run([noRead]);
			expect(exitCode).toBe(1);
			expect(stderr).toContain("permission denied");
		} finally {
			chmodSync(noRead, 0o644);
			unlinkSync(noRead);
		}
	});

	test("output write failure shows clean error", async () => {
		const badPath = join(tmpdir(), `no-such-dir-${Date.now()}`, "out.json");
		const { stderr, exitCode } = await run(["-o", badPath], "# Hello");
		expect(exitCode).toBe(1);
		expect(stderr).toContain("could not write to");
	});
});

// ── CLI combined flags E2E ───────────────────────────────────────

describe("CLI combined flags", () => {
	const tmpMd = join(tmpdir(), `mdadf-combo-${Date.now()}.md`);
	const tmpOut = join(tmpdir(), `mdadf-combo-out-${Date.now()}.json`);

	test("file + --compact", async () => {
		writeFileSync(tmpMd, "# Compact from file");
		const { stdout, exitCode } = await run(["--compact", tmpMd]);
		expect(exitCode).toBe(0);
		expect(stdout.trim()).not.toContain("\n");
		const adf = JSON.parse(stdout);
		expect(adf.content[0].type).toBe("heading");
		unlinkSync(tmpMd);
	});

	test("file + --output", async () => {
		writeFileSync(tmpMd, "# File to output");
		const { stdout, exitCode } = await run([tmpMd, "-o", tmpOut]);
		expect(exitCode).toBe(0);
		expect(stdout).toBe("");
		const content = await Bun.file(tmpOut).text();
		const adf = JSON.parse(content);
		expect(adf.content[0].type).toBe("heading");
		unlinkSync(tmpMd);
		unlinkSync(tmpOut);
	});

	test("file + --compact + --output", async () => {
		writeFileSync(tmpMd, "# All flags");
		const { stdout, exitCode } = await run(["--compact", "-o", tmpOut, tmpMd]);
		expect(exitCode).toBe(0);
		expect(stdout).toBe("");
		const content = await Bun.file(tmpOut).text();
		expect(content.trim()).not.toContain("\n");
		const adf = JSON.parse(content);
		expect(adf.content[0].type).toBe("heading");
		unlinkSync(tmpMd);
		unlinkSync(tmpOut);
	});
});

// ── CLI output formatting ────────────────────────────────────────

describe("CLI output formatting", () => {
	test("default output is pretty-printed with trailing newline", async () => {
		const { stdout, exitCode } = await run([], "# Hello");
		expect(exitCode).toBe(0);
		// Pretty-printed JSON has newlines and indentation
		expect(stdout).toContain("\n  ");
		// POSIX trailing newline
		expect(stdout.endsWith("\n")).toBe(true);
	});

	test("--compact output has trailing newline", async () => {
		const { stdout, exitCode } = await run(["--compact"], "# Hello");
		expect(exitCode).toBe(0);
		// Single line of JSON followed by one newline
		expect(stdout).toMatch(/^\{.*\}\n$/);
	});
});
