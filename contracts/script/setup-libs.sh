#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB="$(cd "$HERE/.." && pwd)/lib"
mkdir -p "$LIB"

clone_pinned() {
  local name="$1" url="$2" hash="$3" dir="$LIB/$1"
  if [ -d "$dir/.git" ] && [ "$(git -C "$dir" rev-parse HEAD 2>/dev/null || true)" = "$hash" ]; then
    echo "ok (already pinned)  $name @ ${hash:0:7}"; return
  fi
  rm -rf "$dir"
  echo "cloning              $name @ ${hash:0:7}"
  git clone --quiet --no-checkout "$url" "$dir"
  git -C "$dir" -c advice.detachedHead=false checkout --quiet "$hash"
  local got; got="$(git -C "$dir" rev-parse HEAD)"
  [ "$got" = "$hash" ] || { echo "ERROR: $name is at $got, expected $hash" >&2; exit 1; }
}

clone_pinned forge-std              https://github.com/foundry-rs/forge-std            15b2df92a05d4d2f76a06653872fefb287e0e01c
clone_pinned openzeppelin-contracts https://github.com/OpenZeppelin/openzeppelin-contracts 69c8def5f222ff96f2b5beff05dfba996368aa79
clone_pinned v3-core                https://github.com/Uniswap/v3-core                 6562c52e8f75f0c10f9deaf44861847585fc8129

echo
echo "Done. Next (from contracts/):"
echo "  export PATH=\$PATH:\$HOME/.foundry/bin"
echo "  FORK_URL=https://ethereum-sepolia-rpc.publicnode.com forge test"
