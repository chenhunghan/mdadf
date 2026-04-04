# mdadf

Convert Markdown to [Atlassian Document Format (ADF)](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/). Uses Atlassian's official [@atlaskit/editor-markdown-transformer](https://atlaskit.atlassian.com/packages/editor/editor-markdown-transformer) under the hood.

Developed for [Jira Skill](https://github.com/chenhunghan/jira-skill) but can be used alone.

## Install

**macOS / Linux:**

```sh
curl -fsSL https://raw.githubusercontent.com/chenhunghan/mdadf/main/install.sh | sh
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/chenhunghan/mdadf/main/install.ps1 | iex
```

**From source:**

```sh
bun install && bun run build
```

## Install the Agent Skill

Install the `mdadf-cli` skill with [`npx skills`](https://github.com/vercel-labs/skills):

```sh
npx skills add chenhunghan/mdadf
```

## Usage

```sh
# Pipe from stdin
echo '# Hello **world**' | mdadf

# File input
mdadf README.md

# Compact JSON
cat doc.md | mdadf --compact

# Write to file
mdadf doc.md -o output.json
```

## Options

```
-c, --compact     Output compact (minified) JSON
-o, --output FILE Write ADF JSON to FILE instead of stdout
-h, --help        Show help
-v, --version     Show version
```

## Supported Markdown

Headings, paragraphs, bold, italic, strikethrough, inline code, code blocks (with language), links, images, bullet lists, ordered lists, nested lists, task lists, blockquotes, tables, and horizontal rules.

## License

MIT
