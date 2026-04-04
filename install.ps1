# mdadf installer for Windows — https://github.com/chenhunghan/mdadf
# Usage: irm https://raw.githubusercontent.com/chenhunghan/mdadf/main/install.ps1 | iex
$ErrorActionPreference = "Stop"

$Repo = "chenhunghan/mdadf"
$Binary = "mdadf"
$InstallDir = if ($env:MDADF_INSTALL) { $env:MDADF_INSTALL } else { "$env:USERPROFILE\.mdadf\bin" }

function Info($msg) { Write-Host $msg -ForegroundColor Cyan }
function Error($msg) { Write-Host "error: $msg" -ForegroundColor Red; exit 1 }

# Detect architecture
$Arch = switch ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture) {
    "X64"   { "x64" }
    "Arm64" { "arm64" }
    default { Error "unsupported architecture: $_" }
}

# Get latest version
Info "fetching latest version..."
$Release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
$Version = $Release.tag_name
if (-not $Version) { Error "failed to fetch latest version" }

$Artifact = "$Binary-windows-$Arch"
$Archive = "$Artifact.zip"
$Url = "https://github.com/$Repo/releases/download/$Version/$Archive"
$ChecksumUrl = "https://github.com/$Repo/releases/download/$Version/checksums.txt"

# Create temp directory
$TmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Path $TmpDir -Force | Out-Null

try {
    # Download
    Info "downloading $Binary $Version (windows/$Arch)..."
    Invoke-WebRequest -Uri $Url -OutFile "$TmpDir\$Archive" -UseBasicParsing
    Invoke-WebRequest -Uri $ChecksumUrl -OutFile "$TmpDir\checksums.txt" -UseBasicParsing

    # Verify checksum
    Info "verifying checksum..."
    $Expected = (Get-Content "$TmpDir\checksums.txt" | Where-Object { $_ -match $Archive }) -replace '\s+.*', ''
    if (-not $Expected) { Error "checksum not found for $Archive" }

    $Actual = (Get-FileHash "$TmpDir\$Archive" -Algorithm SHA256).Hash.ToLower()
    if ($Expected -ne $Actual) {
        Error "checksum mismatch!`n  expected: $Expected`n  actual:   $Actual"
    }

    # Extract
    Info "extracting..."
    Expand-Archive -Path "$TmpDir\$Archive" -DestinationPath $TmpDir -Force

    # Install
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }
    Move-Item -Path "$TmpDir\$Binary.exe" -Destination "$InstallDir\$Binary.exe" -Force
    Info "installed to $InstallDir\$Binary.exe"

    # Add to PATH if not already there
    $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($UserPath -notlike "*$InstallDir*") {
        [Environment]::SetEnvironmentVariable("Path", "$InstallDir;$UserPath", "User")
        $env:Path = "$InstallDir;$env:Path"
        Info "added $InstallDir to PATH"
    }

    Info "run 'mdadf --help' to get started"
}
finally {
    Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue
}
