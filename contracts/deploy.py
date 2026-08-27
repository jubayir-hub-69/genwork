#!/usr/bin/env python3
"""Deploy GenWork to the GenLayer Studio chain (studionet) via the GenLayer CLI.

Matches the frontend:
  - genlayer-js `studionet` in app/page.tsx
  - wagmi chain id 61999 "GenLayer Studio" in app/providers.tsx

Docs:
  https://docs.genlayer.com/developers/intelligent-contracts/deploying/cli-deployment
  https://docs.genlayer.com/developers/intelligent-contracts/deploying/network-configuration

Install once:
  npm install -g genlayer

Usage:
  python contracts/deploy.py
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

CONTRACTS_DIR = Path(__file__).resolve().parent
ROOT = CONTRACTS_DIR.parent
CONTRACT_FILE = CONTRACTS_DIR / "Genwork.py"

ENV_FILES = (
    CONTRACTS_DIR / ".env",
    ROOT / ".env",
)

# GenLayer Studio / studionet — same chain the dapp uses.
STUDIO_NETWORK = "studionet"
STUDIO_CHAIN_ID = 61999
STUDIO_RPC = "https://studio.genlayer.com/api"
STUDIO_EXPLORER = "https://explorer-studio.genlayer.com"


def load_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        values[key] = value
    return values


def load_config() -> dict[str, str]:
    merged: dict[str, str] = {}
    for path in ENV_FILES:
        merged.update(load_dotenv(path))
    return merged


def private_key_from(config: dict[str, str]) -> str:
    key = (
        os.environ.get("PRIVATE_KEY")
        or os.environ.get("private_key")
        or config.get("private_key")
        or config.get("PRIVATE_KEY")
        or ""
    ).strip()
    if not key:
        raise SystemExit(
            "Missing private_key. Copy contracts/.env.example to contracts/.env "
            "and set private_key=0x..."
        )
    if key.startswith("0xYOUR_") or key.endswith("YOUR_PRIVATE_KEY_HERE"):
        raise SystemExit("Replace the placeholder private_key in contracts/.env with a real key.")
    hex_part = key[2:] if key.startswith(("0x", "0X")) else key
    if len(hex_part) != 64 or any(c not in "0123456789abcdefABCDEF" for c in hex_part):
        raise SystemExit("private_key must be a 32-byte hex key (0x + 64 hex chars).")
    return "0x" + hex_part.lower()


def find_genlayer() -> list[str]:
    for name in ("genlayer", "genlayer.cmd", "genlayer.exe"):
        found = shutil.which(name)
        if found:
            return [found]
    npx = shutil.which("npx") or shutil.which("npx.cmd")
    if npx:
        return [npx, "--yes", "genlayer"]
    raise SystemExit(
        "GenLayer CLI not found. Install it with:\n  npm install -g genlayer"
    )


def run_cli(argv: list[str]) -> subprocess.CompletedProcess[str]:
    print(">", " ".join(_redact(argv)))
    return subprocess.run(
        argv,
        cwd=str(ROOT),
        check=False,
        text=True,
    )


def _redact(argv: list[str]) -> list[str]:
    out = list(argv)
    for i, token in enumerate(out):
        if token in ("--private-key", "--private_key") and i + 1 < len(out):
            out[i + 1] = "0x***"
    return out


def import_account(genlayer: list[str], key: str) -> None:
    attempts = [
        genlayer + ["account", "import", "--private-key", key, "--overwrite"],
        genlayer + ["account", "import", "--private-key", key],
    ]
    last_error = ""
    for argv in attempts:
        result = run_cli(argv)
        if result.returncode == 0:
            print("Imported deployer account from contracts/.env.")
            return
        last_error = (result.stderr or result.stdout or "").strip()
    print(
        "Warning: could not import the .env key into the GenLayer CLI account store.",
        file=sys.stderr,
    )
    if last_error:
        print(last_error, file=sys.stderr)
    print("Continuing with the CLI's currently active account.", file=sys.stderr)


def select_studio_network(genlayer: list[str]) -> None:
    # Official CLI name for GenLayer Studio is `studionet`.
    for argv in (
        genlayer + ["network", STUDIO_NETWORK],
        genlayer + ["network", "set", STUDIO_NETWORK],
        genlayer + ["network", "set", "studio"],
    ):
        result = run_cli(argv)
        if result.returncode == 0:
            return
    print(
        "Warning: could not set CLI default network; deploy will still pass --rpc for Studio.",
        file=sys.stderr,
    )


def deploy(genlayer: list[str]) -> int:
    if not CONTRACT_FILE.is_file():
        raise SystemExit(f"Contract not found: {CONTRACT_FILE}")

    rel = CONTRACT_FILE.relative_to(ROOT).as_posix()
    select_studio_network(genlayer)

    argv = genlayer + [
        "deploy",
        "--contract",
        rel,
        "--rpc",
        STUDIO_RPC,
    ]

    print("Deploying to GenLayer Studio chain")
    print(f"  network:  {STUDIO_NETWORK}")
    print(f"  chain id: {STUDIO_CHAIN_ID}")
    print(f"  rpc:      {STUDIO_RPC}")
    print(f"  explorer: {STUDIO_EXPLORER}")
    print(f"  contract: {rel}")

    result = run_cli(argv)
    if result.returncode == 0:
        print(f"After deploy, paste the contract address into app/constants.ts")
        print(f"Explorer: {STUDIO_EXPLORER}")
    return result.returncode


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Deploy GenWork to GenLayer Studio (studionet, chain id 61999)."
    )
    parser.add_argument(
        "--skip-import",
        action="store_true",
        help="Do not run genlayer account import; use the CLI's current account.",
    )
    args = parser.parse_args(argv)

    genlayer = find_genlayer()
    key = private_key_from(load_config())

    if not args.skip_import:
        import_account(genlayer, key)

    return deploy(genlayer)


if __name__ == "__main__":
    raise SystemExit(main())
