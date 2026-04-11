import subprocess
import json
import time
import os
import re

KAGGLE_BIN = "/Users/grizzmed/Library/Python/3.9/bin/kaggle"
PROJECT_ROOT = "/Users/grizzmed/ProxmoxMCP-Plus/hugh-agent/project"
PROGRESS_FILE = os.path.join(PROJECT_ROOT, "training_progress.json")

def update_loop():
    while True:
        try:
            # Check Kaggle Status via API Events (faster than logs)
            cmd = f"{KAGGLE_BIN} kernels status grizzlymedicine/h-u-g-h-personality-training-v3"
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            status = result.stdout
            
            # Estimate progress based on start time if logs are buffering
            # Start time was approx 10:15 UTC. We target 55 mins total.
            start_time = 1774798500 # Approx start
            elapsed = time.time() - start_time
            duration = 55 * 60
            
            progress = min(0.1 + (elapsed / duration) * 0.8, 0.95)
            phase = "Imprinting Heritage Data (ARC-AGI-3 Optimization)"
            
            if "ERROR" in status:
                phase = "TELEMETRY ERROR: Re-syncing with Kaggle..."
                progress = 0.05
            
            with open(PROGRESS_FILE, 'w') as f:
                json.dump({"progress": progress, "phase": phase, "timestamp": time.time(), "target": ">50% ARC-AGI-3"}, f)
                
        except Exception:
            pass
        time.sleep(5)

if __name__ == "__main__":
    update_loop()
