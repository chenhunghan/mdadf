# mdadf Commands

Use these commands exactly as written unless the user asks for a different install location. Reach for the install/update commands only when `mdadf` is missing or the user explicitly wants an install or update.

## Check whether mdadf is available

### macOS / Linux

```sh
command -v mdadf >/dev/null 2>&1 && mdadf --version
```

### Windows PowerShell

```powershell
Get-Command mdadf -ErrorAction SilentlyContinue
mdadf --version
```

## Install or update from GitHub releases

### macOS / Linux

System-wide default:

```sh
curl -fsSL https://raw.githubusercontent.com/chenhunghan/mdadf/main/install.sh | sh
```

User-local install:

```sh
export MDADF_INSTALL="$HOME/.local/bin"
curl -fsSL https://raw.githubusercontent.com/chenhunghan/mdadf/main/install.sh | sh
export PATH="$MDADF_INSTALL:$PATH"
mdadf --version
```

### Windows PowerShell

Default user install:

```powershell
irm https://raw.githubusercontent.com/chenhunghan/mdadf/main/install.ps1 | iex
mdadf --version
```

Explicit user-local destination:

```powershell
$env:MDADF_INSTALL = "$env:USERPROFILE\.mdadf\bin"
irm https://raw.githubusercontent.com/chenhunghan/mdadf/main/install.ps1 | iex
& "$env:MDADF_INSTALL\mdadf.exe" --version
```

## Specific version note

The installer scripts fetch the latest release. If the user needs a pinned version, use the matching GitHub release tag and asset URL instead of the latest installer.

## If PATH has not refreshed after install

### macOS / Linux

```sh
/usr/local/bin/mdadf README.md --compact
```

Or if you used a user-local install:

```sh
"${MDADF_INSTALL:-$HOME/.local/bin}/mdadf" README.md --compact
```

### Windows PowerShell

```powershell
& "$env:USERPROFILE\.mdadf\bin\mdadf.exe" README.md --compact
```
