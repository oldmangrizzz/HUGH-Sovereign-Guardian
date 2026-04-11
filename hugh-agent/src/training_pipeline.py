import os
import json
import subprocess
from huggingface_hub import HfApi

# ── CONFIGURATION ──────────────────────────────────────────────────────────
KAGGLE_USERNAME = "grizzlymedicine"
KAGGLE_KEY = "7ad9cd3733f71715e481cf491ad6dea0"
TRAIN_DATA_PATH = "/root/train"
OUTPUT_MODEL_NAME = "hugh-heretic-distill-v1"

def run_command(cmd):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error: {result.stderr}")
    return result.stdout

def setup_kaggle_auth():
    os.makedirs(os.path.expanduser("~/.kaggle"), exist_ok=True)
    with open(os.path.expanduser("~/.kaggle/kaggle.json"), "w") as f:
        json.dump({"username": KAGGLE_USERNAME, "key": KAGGLE_KEY}, f)
    os.chmod(os.path.expanduser("~/.kaggle/kaggle.json"), 0o600)

def init_pipeline():
    print("[HUGH] Initializing Sovereign Training Pipeline...")
    setup_kaggle_auth()
    
    # 1. Verify connection
    print("[HUGH] Verifying Kaggle connectivity...")
    out = run_command("/Users/grizzmed/Library/Python/3.9/bin/kaggle datasets list --mine")
    if "grizzlymedicine" in out:
        print("[HUGH] Kaggle Handshake: VERIFIED")
    
    # 2. Dataset preparation logic
    # (Future step: zip and upload signed JSONLs)
    print("[HUGH] Pipeline ready. Standing by for 'day one' dataset sync.")

if __name__ == "__main__":
    init_pipeline()
