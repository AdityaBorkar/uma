#!/usr/bin/env bash
# uma-machine install.sh — curl-pipe installer (test + staging).
# Usage: curl -fsSL <server>/install.sh | bash -s -- --server http://127.0.0.1:3000
set -euo pipefail

SERVER="${UMA_SERVER_URL:-http://127.0.0.1:3000}"
MSB_VERSION="${MSB_VERSION:-latest}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server) SERVER="$2"; shift 2 ;;
    --dir) INSTALL_DIR="$2"; shift 2 ;;
    *) shift ;;
  esac
done

echo "[uma-machine] server: $SERVER"
echo "[uma-machine] install dir: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

# 1. Version check (pinned binary URL from server latestVersion).
echo "[uma-machine] checking latest version..."
LATEST_JSON="$(curl -fsSL "$SERVER/api/version" || echo '{"latest":"0.1.0","min":"0.1.0"}')"
echo "[uma-machine] version: $LATEST_JSON"

# 2. System msb runtime (never bundled): install.microsandbox.dev / brew.
if command -v msb >/dev/null 2>&1; then
  echo "[uma-machine] msb runtime present: $(msb --version 2>&1 | head -1)"
  msb doctor 2>&1 | head -5 || true
else
  echo "[uma-machine] installing msb system runtime..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    if command -v brew >/dev/null 2>&1; then
      brew install microsandbox/tap/microsandbox || brew install microsandbox || true
    else
      echo "[uma-machine] ERROR: brew required on macOS for msb runtime" >&2
      exit 1
    fi
  else
    if command -v curl >/dev/null 2>&1; then
      curl -fsSL https://install.microsandbox.dev | sh || echo "[uma-machine] WARN: msb install failed (MSB_MOCK=1 for dev)" >&2
    else
      echo "[uma-machine] ERROR: curl required for msb install" >&2
      exit 1
    fi
  fi
fi

# 3. bun check.
if ! command -v bun >/dev/null 2>&1; then
  echo "[uma-machine] ERROR: bun required (https://bun.sh)" >&2
  exit 1
fi

# 4. uma-machine binary: version-pinned download first, local build fallback.
# Download URL shape: $SERVER/releases/uma-machine-<os>-<arch> (pinned to
# latestVersion.latest below). Falls back to `bun build --compile` from source.
LATEST="$(echo "$LATEST_JSON" | grep -oE '"latest"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "0.1.0")"
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
esac
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALLED=""
if curl -fsSL "$SERVER/releases/uma-machine-$OS-$ARCH" -o "$INSTALL_DIR/uma-machine" 2>/dev/null; then
  chmod 0755 "$INSTALL_DIR/uma-machine"
  echo "[uma-machine] downloaded prebuilt binary (v$LATEST)"
  INSTALLED=1
elif [[ -f "$SCRIPT_DIR/src/index.ts" ]]; then
  echo "[uma-machine] no prebuilt binary (or download failed); building from source..."
  (cd "$SCRIPT_DIR" && bun install && bun build --compile src/index.ts --outfile dist/uma-machine)
  install -m 0755 "$SCRIPT_DIR/dist/uma-machine" "$INSTALL_DIR/uma-machine" || cp "$SCRIPT_DIR/dist/uma-machine" "$INSTALL_DIR/uma-machine"
  INSTALLED=1
fi
if [[ -z "$INSTALLED" ]]; then
  echo "[uma-machine] ERROR: no prebuilt binary and no source to build" >&2
  exit 1
fi

# 5. RAM probe -> quota defaults preview (limits.json written at enroll).
if [[ -f /proc/meminfo ]]; then
  MEMKB="$(awk '/MemTotal/ {print $2}' /proc/meminfo)"
  RAMGB="$(( (MEMKB + 1024*1024 - 1) / (1024*1024) ))"
else
  RAMGB="${UMA_RAM_GB:-4}"
fi
if [[ "$RAMGB" -lt 1 ]]; then RAMGB=1; fi
echo "[uma-machine] host RAM ~${RAMGB}GB -> maxRunning=$((2*RAMGB)) maxTotal=$((5*RAMGB)) (stored in XDG limits.json at enroll)"

# 6. Pre-pull pinned Ubuntu image (best-effort).
echo "[uma-machine] pre-pulling Ubuntu image (best-effort)..."
msb pull docker.io/library/ubuntu:24.04 2>&1 | tail -2 || echo "[uma-machine] WARN: image pre-pull skipped (runtime may be mock)" >&2

echo "[uma-machine] installed: $INSTALL_DIR/uma-machine"
echo "[uma-machine] next: uma-machine enroll --server $SERVER --systemd"
