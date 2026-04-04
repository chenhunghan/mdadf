#!/usr/bin/env bun

import { readFileSync, statSync, writeFileSync } from "node:fs";
import { defaultSchema } from "@atlaskit/adf-schema/schema-default";
import { JSONTransformer } from "@atlaskit/editor-json-transformer";
import { MarkdownTransformer } from "@atlaskit/editor-markdown-transformer";
import pkg from "../package.json";
import { postprocessAdf } from "./postprocess";
import { preprocessMarkdown } from "./preprocess";

const VERSION: string = pkg.version;
const MAX_INPUT_SIZE = 50 * 1024 * 1024; // 50 MB

const HELP = `mdadf v${VERSION} — Convert Markdown to Atlassian Document Format (ADF)

Usage:
  mdadf [options] [file]
  cat README.md | mdadf
  echo "# Hello" | mdadf --compact

Arguments:
  file              Markdown file to convert (reads stdin if omitted)

Options:
  -o, --output FILE Write ADF JSON to FILE instead of stdout
  -c, --compact     Output compact (minified) JSON
  -h, --help        Show this help
  -v, --version     Show version
`;

export function parseArgs(args: string[]): {
	file?: string;
	output?: string;
	compact: boolean;
} {
	let file: string | undefined;
	let output: string | undefined;
	let compact = false;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		switch (arg) {
			case "-h":
			case "--help":
				process.stdout.write(HELP);
				process.exit(0);
				break;
			case "-v":
			case "--version":
				process.stdout.write(`${VERSION}\n`);
				process.exit(0);
				break;
			case "-c":
			case "--compact":
				compact = true;
				break;
			case "-o":
			case "--output":
				output = args[++i];
				if (!output) {
					process.stderr.write("Error: --output requires a file path\n");
					process.exit(1);
				}
				break;
			default:
				if (arg?.startsWith("-")) {
					process.stderr.write(`Error: unknown option '${arg}'\n`);
					process.exit(1);
				}
				file = arg;
		}
	}

	return { file, output, compact };
}

async function readInput(file?: string): Promise<string> {
	if (file) {
		try {
			const stat = statSync(file);
			if (stat.isDirectory()) {
				process.stderr.write(`Error: is a directory: ${file}\n`);
				process.exit(1);
			}
			if (stat.size > MAX_INPUT_SIZE) {
				process.stderr.write(
					`Error: input too large (${(stat.size / 1024 / 1024).toFixed(1)}MB, max ${MAX_INPUT_SIZE / 1024 / 1024}MB): ${file}\n`,
				);
				process.exit(1);
			}
			return readFileSync(file, "utf-8");
		} catch (err: unknown) {
			const e = err as NodeJS.ErrnoException;
			if (e.code === "ENOENT") {
				process.stderr.write(`Error: file not found: ${file}\n`);
			} else if (e.code === "EACCES") {
				process.stderr.write(`Error: permission denied: ${file}\n`);
			} else {
				process.stderr.write(`Error: ${e.message}\n`);
			}
			process.exit(1);
		}
	}

	// Read from stdin — cross-platform via Bun API
	const text = await Bun.stdin.text();
	if (!text) {
		process.stderr.write("Error: no input (pipe markdown via stdin or pass a file argument)\n");
		process.exit(1);
	}
	if (text.length > MAX_INPUT_SIZE) {
		process.stderr.write(
			`Error: stdin input too large (${(text.length / 1024 / 1024).toFixed(1)}MB, max ${MAX_INPUT_SIZE / 1024 / 1024}MB)\n`,
		);
		process.exit(1);
	}
	return text;
}

export function convert(markdown: string): object {
	const { processed, linkedImages } = preprocessMarkdown(markdown);

	try {
		const markdownTransformer = new MarkdownTransformer(defaultSchema);
		const jsonTransformer = new JSONTransformer();
		const pmNode = markdownTransformer.parse(processed);
		const adf = jsonTransformer.encode(pmNode);

		return postprocessAdf(adf as any, linkedImages);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		process.stderr.write(`Error: failed to convert markdown: ${message}\n`);
		process.exit(1);
	}
}

async function main() {
	const { file, output, compact } = parseArgs(Bun.argv.slice(2));

	const markdown = await readInput(file);
	const adf = convert(markdown);
	const json = compact ? JSON.stringify(adf) : JSON.stringify(adf, null, 2);
	const result = `${json}\n`;

	if (output) {
		try {
			writeFileSync(output, result);
		} catch (err: unknown) {
			const e = err as NodeJS.ErrnoException;
			process.stderr.write(`Error: could not write to ${output}: ${e.message}\n`);
			process.exit(1);
		}
	} else {
		process.stdout.write(result);
	}
}

// Only run CLI when executed directly, not when imported
if (import.meta.main) {
	main();
}
