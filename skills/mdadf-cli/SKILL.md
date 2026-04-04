---
name: mdadf-cli
description: Use this skill whenever the user wants to transform Markdown into Atlassian Document Format (ADF), Jira issue body JSON, Confluence body JSON, Jira ADF JSON, or another Atlassian document payload, even if they do not mention mdadf by name. Trigger on requests like "convert this markdown to ADF", "make Jira JSON from this markdown", or "turn this markdown into a Confluence body."
compatibility: Requires a terminal-capable agent (Claude Code, Codex, or similar). Supported on macOS, Linux, and Windows (x64 and arm64). Needs network access for install.
---

# mdadf CLI

A CLI that converts Markdown into Atlassian Document Format (ADF). If shell or network access is unavailable, give the user the exact commands for their OS and say clearly that you did not run them.

## Core Workflow

### 1. Check availability, then install only if needed

Run `mdadf --version`. If it works, skip installation entirely — do not include install commands even as a fallback. When the user states the tool is installed, trust them.

If the binary is missing, install it and then convert. See [references/commands.md](references/commands.md) for exact commands by OS and install method.

### 2. Convert with the CLI instead of hand-writing ADF

Prefer `mdadf` over manually constructing ADF JSON.

- Default to `--compact` unless the user explicitly wants pretty-printed JSON
- For short snippets, pipe Markdown through stdin
- For larger inputs or reusable workflows, pass a file path
- Use `-o` when the result would be too large to paste comfortably

### 3. Keep the output lean

- If the JSON is long, save it to a file (`-o`) and report the path
- Avoid pretty-printing by default because it wastes tokens

### 4. Verify briefly

After install: confirm with `mdadf --version`.
After conversion: sanity-check that the output looks like ADF (e.g. `"type":"doc"`).

## Agent Guidance

- Actually run commands when the environment allows it
- Do not claim install or conversion succeeded unless you verified it
- Do not silently switch platforms or shells; use the user's actual environment
- Do not handcraft ADF when the CLI can generate it
- If the user is working with Jira or Atlassian APIs, generating the payload with `mdadf` first is usually the right move

## Troubleshooting

- If `mdadf` is not found right after install, use the full installed path for the current session
- If quoting multiline Markdown becomes messy, write the Markdown to a temp file and convert the file
- If the result is too large for chat, prefer `-o`
- If install would require elevated permissions and the user did not ask for that, switch to a user-local install directory instead
- `mdadf` reports failures on stderr with `Error:` and exits non-zero — treat these as hard failures

## Examples

**Example 1: convert a short snippet inline**
Input: "Turn this Markdown into Jira ADF and keep it compact: `# Ship it`"
Approach: pipe the snippet to `mdadf --compact` and return the JSON.

**Example 2: install first, then convert**
Input: "Install mdadf on this Mac and convert `/tmp/release-notes.md` to ADF"
Approach: run the macOS installer, verify `mdadf --version`, then run `mdadf /tmp/release-notes.md --compact`.

**Example 3: large output**
Input: "Convert `spec.md` to ADF but don't flood the chat"
Approach: run `mdadf spec.md --compact -o spec.adf.json` and report the file path.

**Example 4: Windows PowerShell inline conversion**
Input: "Turn this Markdown into Jira issue body JSON on Windows: `# Ship it`"
Approach: pass a PowerShell here-string to `mdadf --compact` and return the compact JSON.
