import { describe, expect, test } from "bun:test";
import Ajv2020 from "ajv/dist/2020";
import Ajv04 from "ajv-draft-04";
import { readFileSync } from "node:fs";
import { convert } from "../src/index";

// Load ADF JSON schema (draft-04)
const schemaJson = JSON.parse(readFileSync(new URL("./adf-schema.json", import.meta.url), "utf-8"));

const ajv = new Ajv04({ allErrors: true, strict: false });
const validate = ajv.compile(schemaJson);

function assertValidAdf(adf: object) {
	const valid = validate(adf);
	if (!valid) {
		const errors = validate.errors?.map((e) => `${e.instancePath} ${e.message}`).join("\n");
		throw new Error(`ADF schema validation failed:\n${errors}`);
	}
}

function convertAndValidate(md: string): object {
	const adf = convert(md);
	assertValidAdf(adf);
	return adf;
}

// ── Core block nodes ──────────────────────────────────────────────

describe("headings", () => {
	test("h1 through h6", () => {
		const md = "# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6";
		const adf = convertAndValidate(md) as any;
		expect(adf.content).toHaveLength(6);
		for (let i = 0; i < 6; i++) {
			expect(adf.content[i].type).toBe("heading");
			expect(adf.content[i].attrs.level).toBe(i + 1);
		}
	});
});

describe("paragraphs", () => {
	test("simple paragraph", () => {
		const adf = convertAndValidate("Hello world") as any;
		expect(adf.content[0].type).toBe("paragraph");
		expect(adf.content[0].content[0].text).toBe("Hello world");
	});

	test("multiple paragraphs", () => {
		const adf = convertAndValidate("First\n\nSecond") as any;
		expect(adf.content).toHaveLength(2);
		expect(adf.content[0].content[0].text).toBe("First");
		expect(adf.content[1].content[0].text).toBe("Second");
	});
});

describe("code blocks", () => {
	test("fenced code block with language", () => {
		const adf = convertAndValidate("```js\nconsole.log('hi');\n```") as any;
		expect(adf.content[0].type).toBe("codeBlock");
		expect(adf.content[0].attrs.language).toBe("js");
		expect(adf.content[0].content[0].text).toBe("console.log('hi');");
	});

	test("fenced code block without language", () => {
		const adf = convertAndValidate("```\nplain code\n```") as any;
		expect(adf.content[0].type).toBe("codeBlock");
	});
});

describe("blockquotes", () => {
	test("simple blockquote", () => {
		const adf = convertAndValidate("> Quote text") as any;
		expect(adf.content[0].type).toBe("blockquote");
		expect(adf.content[0].content[0].type).toBe("paragraph");
	});
});

describe("horizontal rule", () => {
	test("--- becomes rule", () => {
		const adf = convertAndValidate("---") as any;
		expect(adf.content[0].type).toBe("rule");
	});
});

// ── Lists ──────────────────────────────────────────────────────────

describe("bullet lists", () => {
	test("simple bullet list", () => {
		const adf = convertAndValidate("- Item 1\n- Item 2") as any;
		expect(adf.content[0].type).toBe("bulletList");
		expect(adf.content[0].content).toHaveLength(2);
	});

	test("nested bullet list", () => {
		const adf = convertAndValidate("- Parent\n  - Child") as any;
		const parent = adf.content[0].content[0];
		expect(parent.content).toHaveLength(2);
		expect(parent.content[1].type).toBe("bulletList");
	});
});

describe("ordered lists", () => {
	test("simple ordered list", () => {
		const adf = convertAndValidate("1. First\n2. Second") as any;
		expect(adf.content[0].type).toBe("orderedList");
		expect(adf.content[0].content).toHaveLength(2);
	});

	test("preserves start number", () => {
		const adf = convertAndValidate("5. Fifth\n6. Sixth") as any;
		expect(adf.content[0].attrs.order).toBe(5);
	});
});

// ── Inline marks ───────────────────────────────────────────────────

describe("inline marks", () => {
	test("bold text", () => {
		const adf = convertAndValidate("**bold**") as any;
		const text = adf.content[0].content[0];
		expect(text.marks[0].type).toBe("strong");
	});

	test("italic text", () => {
		const adf = convertAndValidate("*italic*") as any;
		const text = adf.content[0].content[0];
		expect(text.marks[0].type).toBe("em");
	});

	test("strikethrough", () => {
		const adf = convertAndValidate("~~strike~~") as any;
		const text = adf.content[0].content[0];
		expect(text.marks[0].type).toBe("strike");
	});

	test("inline code", () => {
		const adf = convertAndValidate("`code`") as any;
		const text = adf.content[0].content[0];
		expect(text.marks[0].type).toBe("code");
	});

	test("link", () => {
		const adf = convertAndValidate("[text](https://example.com)") as any;
		const text = adf.content[0].content[0];
		expect(text.marks[0].type).toBe("link");
		expect(text.marks[0].attrs.href).toBe("https://example.com");
	});

	test("combined bold and italic", () => {
		const adf = convertAndValidate("***bold italic***") as any;
		const text = adf.content[0].content[0];
		const markTypes = text.marks.map((m: any) => m.type).sort();
		expect(markTypes).toEqual(["em", "strong"]);
	});
});

// ── Tables ─────────────────────────────────────────────────────────

describe("tables", () => {
	test("simple table with header", () => {
		const md = "| H1 | H2 |\n|---|---|\n| C1 | C2 |";
		const adf = convertAndValidate(md) as any;
		expect(adf.content[0].type).toBe("table");
		const rows = adf.content[0].content;
		expect(rows).toHaveLength(2);
		expect(rows[0].content[0].type).toBe("tableHeader");
		expect(rows[1].content[0].type).toBe("tableCell");
	});
});

// ── Images ─────────────────────────────────────────────────────────

describe("images", () => {
	test("external image", () => {
		const adf = convertAndValidate("![alt](https://example.com/img.png)") as any;
		expect(adf.content[0].type).toBe("mediaSingle");
		const media = adf.content[0].content[0];
		expect(media.type).toBe("media");
		expect(media.attrs.type).toBe("external");
		expect(media.attrs.url).toBe("https://example.com/img.png");
	});
});

// ── Patched features ──────────────────────────────────────────────

describe("task lists (patched)", () => {
	test("todo and done items", () => {
		const md = "- [x] Done\n- [ ] Todo";
		const adf = convertAndValidate(md) as any;
		expect(adf.content[0].type).toBe("taskList");
		expect(adf.content[0].attrs.localId).toBeDefined();
		const items = adf.content[0].content;
		expect(items[0].type).toBe("taskItem");
		expect(items[0].attrs.state).toBe("DONE");
		expect(items[0].content[0].text).toBe("Done");
		expect(items[1].attrs.state).toBe("TODO");
		expect(items[1].content[0].text).toBe("Todo");
	});

	test("mixed list stays as bulletList", () => {
		const md = "- [x] Task\n- Regular item";
		const adf = convertAndValidate(md) as any;
		expect(adf.content[0].type).toBe("bulletList");
	});

	test("all done tasks", () => {
		const md = "- [x] First\n- [x] Second";
		const adf = convertAndValidate(md) as any;
		expect(adf.content[0].type).toBe("taskList");
		expect(adf.content[0].content[0].attrs.state).toBe("DONE");
		expect(adf.content[0].content[1].attrs.state).toBe("DONE");
	});

	test("all todo tasks", () => {
		const md = "- [ ] First\n- [ ] Second";
		const adf = convertAndValidate(md) as any;
		expect(adf.content[0].type).toBe("taskList");
		expect(adf.content[0].content[0].attrs.state).toBe("TODO");
	});

	test("task with inline formatting", () => {
		const md = "- [x] **Bold** task";
		const adf = convertAndValidate(md) as any;
		expect(adf.content[0].type).toBe("taskList");
	});
});

describe("linked images (patched)", () => {
	test("image wrapped in link", () => {
		const md = "[![alt](https://img.example.com/a.png)](https://example.com)";
		const adf = convertAndValidate(md) as any;
		const node = adf.content[0];
		expect(node.type).toBe("mediaSingle");
		expect(node.marks).toBeDefined();
		expect(node.marks[0].type).toBe("link");
		expect(node.marks[0].attrs.href).toBe("https://example.com");
		expect(node.content[0].attrs.url).toBe("https://img.example.com/a.png");
	});
});

describe("nested blockquotes (patched)", () => {
	test("double nested flattened", () => {
		const md = "> outer\n>> inner";
		const adf = convertAndValidate(md) as any;
		expect(adf.content[0].type).toBe("blockquote");
		// Should have content, not be empty
		expect(adf.content[0].content.length).toBeGreaterThan(0);
	});

	test("triple nested flattened", () => {
		const md = ">>> deeply nested";
		const adf = convertAndValidate(md) as any;
		expect(adf.content[0].type).toBe("blockquote");
		expect(adf.content[0].content.length).toBeGreaterThan(0);
	});
});

// ── Edge cases ────────────────────────────────────────────────────

describe("edge cases", () => {
	test("empty input produces valid doc", () => {
		const adf = convertAndValidate("") as any;
		expect(adf.version).toBe(1);
		expect(adf.type).toBe("doc");
	});

	test("complex document with all features", () => {
		const md = `# Title

A paragraph with **bold**, *italic*, ~~strike~~, \`code\`, and [link](https://x.com).

- Bullet 1
- Bullet 2
  - Nested

1. Ordered 1
2. Ordered 2

- [x] Done
- [ ] Todo

> Blockquote

\`\`\`ts
const x = 1;
\`\`\`

---

| H1 | H2 |
|---|---|
| C1 | C2 |

![img](https://example.com/img.png)`;

		const adf = convertAndValidate(md);
		expect(adf).toBeDefined();
	});
});
