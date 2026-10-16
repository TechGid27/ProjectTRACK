"""
Setup Local AI Fallback (qwen2.5:0.5b)
=====================================
Installs and configures Ollama with the lightweight qwen2.5:0.5b model (~398 MB)
as a high-speed, zero-cost, offline fallback for ProjectTRACK.

Features:
- Permission-gated: Prompts for explicit user confirmation before any installation.
- 1-command execution: python main.py --setup-local-ai
- Checks for existing Ollama installation.
- Pulls and verifies qwen2.5:0.5b model.
"""

import os
import sys
import shutil
import subprocess
import time
import urllib.request
import json
from typing import Tuple, List

# Ensure UTF-8 output on Windows consoles
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)

FALLBACK_MODEL = "qwen2.5:0.5b"
FALLBACK_MODEL_SIZE = "~398 MB"
FALLBACK_RAM_REQ = "<600 MB RAM (CPU-only friendly)"
OLLAMA_TAGS_URL = "http://localhost:11434/api/tags"


def check_ollama_server() -> Tuple[bool, List[str]]:
    """Check if Ollama server is running and return list of installed models."""
    try:
        req = urllib.request.Request(OLLAMA_TAGS_URL, headers={"User-Agent": "ProjectTRACK"})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                models = [m.get("name", "") for m in data.get("models", [])]
                return True, models
    except Exception:
        pass
    return False, []


def start_ollama_daemon() -> bool:
    """Attempt to start Ollama server in background if installed."""
    if not shutil.which("ollama"):
        return False

    print("🔄 Starting local Ollama service in background...")
    try:
        flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        subprocess.Popen(
            ["ollama", "serve"],
            creationflags=flags,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            shell=False
        )
        for _ in range(12):
            time.sleep(0.5)
            running, _ = check_ollama_server()
            if running:
                print("✅ Ollama service is active.")
                return True
    except Exception as e:
        print(f"⚠️ Could not start Ollama daemon: {e}")
    return False


def setup_local_ai(auto_confirm: bool = False) -> bool:
    """
    Sets up local Ollama and qwen2.5:0.5b with user consent.
    Returns True if successfully installed and verified.
    """
    print("\n" + "=" * 68)
    print("🤖 ProjectTRACK Local AI Setup (Offline Resilience)")
    print("=" * 68)
    print(f"Target Model:       {FALLBACK_MODEL} ({FALLBACK_MODEL_SIZE})")
    print(f"System Footprint:   {FALLBACK_RAM_REQ}")
    print("Purpose:            Zero-cost, offline fallback when Groq hits rate limits (429)")
    print("                    or during internet disruptions.")
    print("=" * 68)

    # 1. Permission check
    if not auto_confirm:
        try:
            prompt = (
                f"\nWould you like to proceed with configuring Ollama & downloading "
                f"{FALLBACK_MODEL} ({FALLBACK_MODEL_SIZE})? [y/N]: "
            )
            choice = input(prompt).strip().lower()
            if choice not in ("y", "yes"):
                print("\n❌ Setup cancelled. No changes were made.")
                print("💡 Note: You can still run all queries and instant project searches")
                print("   purely through Neo4j without any local model installed.")
                print("=" * 68 + "\n")
                return False
        except (KeyboardInterrupt, EOFError):
            print("\n\n❌ Setup cancelled.")
            return False

    # 2. Check if Ollama CLI is installed
    ollama_path = shutil.which("ollama")
    if not ollama_path:
        print("\n📦 Ollama CLI not detected on system PATH.")
        if sys.platform == "win32":
            winget_path = shutil.which("winget")
            if winget_path:
                print("⚡ Attempting automatic installation via Windows Package Manager (winget)...")
                try:
                    cmd = ["winget", "install", "Ollama.Ollama", "--accept-source-agreements", "--accept-package-agreements"]
                    ret = subprocess.run(cmd)
                    if ret.returncode == 0:
                        print("✅ Ollama installed successfully via winget.")
                        # Check path again or standard install path
                        ollama_path = shutil.which("ollama")
                        if not ollama_path:
                            # Typically installs to %LOCALAPPDATA%\Programs\Ollama\ollama.exe
                            local_app = os.environ.get("LOCALAPPDATA", "")
                            candidate = os.path.join(local_app, "Programs", "Ollama", "ollama.exe")
                            if os.path.exists(candidate):
                                os.environ["PATH"] = f"{os.path.dirname(candidate)};{os.environ['PATH']}"
                                ollama_path = candidate
                    else:
                        print("⚠️ winget installation did not complete.")
                except Exception as e:
                    print(f"⚠️ winget installation failed: {e}")

        if not ollama_path:
            print("\n👉 Manual installation required:")
            print("   1. Download Ollama from: https://ollama.com/download")
            print("   2. Run the installer and restart your terminal.")
            print("   3. Re-run: python main.py --setup-local-ai")
            print("=" * 68 + "\n")
            return False

    # 3. Ensure server is active
    server_running, installed_models = check_ollama_server()
    if not server_running:
        if not start_ollama_daemon():
            print("⚠️ Ollama is installed but could not be started automatically.")
            print("👉 Please start Ollama from your desktop or run 'ollama serve' in another terminal.")
            return False
        _, installed_models = check_ollama_server()

    # 4. Check if target model is already pulled
    is_installed = any(FALLBACK_MODEL in m for m in installed_models)
    if is_installed:
        print(f"\n✅ {FALLBACK_MODEL} is already installed and ready to use!")
    else:
        print(f"\n📥 Pulling {FALLBACK_MODEL} ({FALLBACK_MODEL_SIZE})...")
        try:
            ret = subprocess.run(["ollama", "pull", FALLBACK_MODEL])
            if ret.returncode != 0:
                print(f"⚠️ Failed to pull model {FALLBACK_MODEL}.")
                return False
        except Exception as e:
            print(f"❌ Error pulling model: {e}")
            return False

    # 5. Final health check
    running, current_models = check_ollama_server()
    has_model = any(FALLBACK_MODEL in m for m in current_models)
    if running and has_model:
        print("\n" + "=" * 68)
        print("🎉 SUCCESS: Local AI Fallback is fully configured and operational!")
        print(f"Model:    {FALLBACK_MODEL} (~398 MB)")
        print("Status:   Online (http://localhost:11434)")
        print("\n💡 How it works:")
        print("  • Primary Engine: Groq LPU (Ultra-fast cloud generation)")
        print("  • Automatic Fallback: If Groq hits rate limit (429) or is offline,")
        print(f"    ProjectTRACK automatically routes to your local {FALLBACK_MODEL}.")
        print("  • Zero Downtime: If neither is reachable, Instant Graph Synthesizer")
        print("    generates factual summaries in <5ms directly from Neo4j.")
        print("=" * 68 + "\n")
        return True

    print("⚠️ Model pulled but server connectivity could not be verified.")
    return False


if __name__ == "__main__":
    auto = "--yes" in sys.argv or "-y" in sys.argv
    setup_local_ai(auto_confirm=auto)
