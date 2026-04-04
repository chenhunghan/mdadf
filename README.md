# mdadf

Convert Markdown to [Atlassian Document Format (ADF)](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/). Uses Atlassian's official `@atlaskit/editor-markdown-transformer` under the hood.

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

This repo also ships an `mdadf-cli` skill for agent runtimes such as Codex and Claude Code, using the [`npx skills`](https://github.com/vercel-labs/skills) installer.

List the skills available in this repo:

```sh
npx skills add chenhunghan/mdadf --list
```

Install `mdadf-cli` globally for Codex and Claude Code:

```sh
npx skills add chenhunghan/mdadf --skill mdadf-cli -g -a codex -a claude-code -y
```

Install directly from the skill path instead of the whole repo:

```sh
npx skills add https://github.com/chenhunghan/mdadf/tree/main/skills/mdadf-cli -g -a codex -a claude-code -y
```

Notes:

- Omit `-g` to install into the current project instead of your user-wide agent config.
- Add or replace `-a` flags for other supported agents.
- Run `npx skills check` and `npx skills update` later to check for skill updates.

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
