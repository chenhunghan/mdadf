#!/bin/sh
# mdadf installer — https://github.com/chenhunghan/mdadf
# Usage: curl -fsSL https://raw.githubusercontent.com/chenhunghan/mdadf/main/install.sh | sh
set -eu

REPO="chenhunghan/mdadf"
INSTALL_DIR="${MDADF_INSTALL:-/usr/local/bin}"
BINARY="mdadf"

info() { printf '\033[1;34m%s\033[0m\n' "$*"; }
error() { printf '\033[1;31merror: %s\033[0m\n' "$*" >&2; exit 1; }

detect_platform() {
  OS="$(uname -s)"
  ARCH="$(uname -m)"

  case "$OS" in
    Linux)  PLATFORM="linux" ;;
    Darwin) PLATFORM="darwin" ;;
    *)      error "unsupported OS: $OS" ;;
  esac

  case "$ARCH" in
    x86_64|amd64)  ARCH="x64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *)             error "unsupported architecture: $ARCH" ;;
  esac
}

get_latest_version() {
  if command -v curl >/dev/null 2>&1; then
    VERSION="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
      | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"//;s/".*//')"
  elif command -v wget >/dev/null 2>&1; then
    VERSION="$(wget -qO- "https://api.github.com/repos/${REPO}/releases/latest" \
      | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"//;s/".*//')"
  else
    error "curl or wget is required"
  fi

  [ -n "$VERSION" ] || error "failed to fetch latest version"
}

download() {
  ARTIFACT="${BINARY}-${PLATFORM}-${ARCH}"
  ARCHIVE="${ARTIFACT}.tar.gz"
  URL="https://github.com/${REPO}/releases/download/${VERSION}/${ARCHIVE}"
  CHECKSUM_URL="https://github.com/${REPO}/releases/download/${VERSION}/checksums.txt"

  TMPDIR="$(mktemp -d)"
  trap 'rm -rf "$TMPDIR"' EXIT

  info "downloading ${BINARY} ${VERSION} (${PLATFORM}/${ARCH})..."

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$URL" -o "${TMPDIR}/${ARCHIVE}" || error "download failed — is ${PLATFORM}-${ARCH} supported?"
    curl -fsSL "$CHECKSUM_URL" -o "${TMPDIR}/checksums.txt" || error "checksum download failed"
  else
    wget -q "$URL" -O "${TMPDIR}/${ARCHIVE}" || error "download failed — is ${PLATFORM}-${ARCH} supported?"
    wget -q "$CHECKSUM_URL" -O "${TMPDIR}/checksums.txt" || error "checksum download failed"
  fi

  verify_checksum "${TMPDIR}"
  extract "${TMPDIR}"
}

verify_checksum() {
  dir="$1"
  info "verifying checksum..."

  expected="$(grep "${ARCHIVE}" "${dir}/checksums.txt" | awk '{print $1}')"
  [ -n "$expected" ] || error "checksum not found for ${ARCHIVE}"

  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "${dir}/${ARCHIVE}" | awk '{print $1}')"
  elif command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "${dir}/${ARCHIVE}" | awk '{print $1}')"
  else
    info "warning: sha256sum/shasum not found, skipping checksum verification"
    return
  fi

  [ "$expected" = "$actual" ] || error "checksum mismatch!\n  expected: ${expected}\n  actual:   ${actual}"
}

extract() {
  dir="$1"
  info "extracting..."
  tar -xzf "${dir}/${ARCHIVE}" -C "${dir}"

  info "installing to ${INSTALL_DIR}..."
  if [ ! -d "$INSTALL_DIR" ]; then
    mkdir -p "$INSTALL_DIR" 2>/dev/null || sudo mkdir -p "$INSTALL_DIR"
  fi
  if [ -w "$INSTALL_DIR" ]; then
    mv "${dir}/${BINARY}" "${INSTALL_DIR}/${BINARY}"
    chmod +x "${INSTALL_DIR}/${BINARY}"
  else
    sudo mv "${dir}/${BINARY}" "${INSTALL_DIR}/${BINARY}"
    sudo chmod +x "${INSTALL_DIR}/${BINARY}"
  fi
}

main() {
  detect_platform
  get_latest_version
  download
  info "installed ${BINARY} ${VERSION} to ${INSTALL_DIR}/${BINARY}"
  info "run 'mdadf --help' to get started"
}

main
