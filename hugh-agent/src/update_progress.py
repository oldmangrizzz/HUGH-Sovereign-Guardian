import subprocess
import json
import time
import os

KAGGLE_BIN = "/Users/grizzmed/Library/Python/3.9/bin/kaggle"
PROJECT_ROOT = "/Users/grizzmed/ProxmoxMCP-Plus/hugh-agent/project"
PROGRESS_FILE = os.path.join(PROJECT_ROOT, "training_progress.json")

def get_status():
    try:
        # Check Kaggle Status
        cmd = f"{KAGGLE_BIN} kernels status grizzlymedicine/h-u-g-h-personality-training-v3"
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        status = result.stdout
        
        # Pull latest logs for step count
        log_cmd = f"{KAGGLE_BIN} kernels output grizzlymedicine/h-u-g-h-personality-training-v3 -p /tmp/hugh-telemetry/"
        subprocess.run(log_cmd, shell=True, capture_output=True)
        
        log_path = "/tmp/hugh-telemetry/h-u-g-h-personality-training-v3.log"
        progress = 0.1 # Starting floor
        phase = "Initializing GPU Substrate..."
        
        if os.path.exists(log_path):
            with open(log_path, 'r') as f:
                content = f.read()
                if "Loaded 279 training pairs" in content:
                    progress = 0.2
                    phase = "Dataset Verified & Loaded"
                if "Loading model" in content:
                    progress = 0.3
                    phase = "Loading Heretic Weights (4-bit QLoRA)"
                if "commencing" in content.lower():
                    progress = 0.4
                    phase = "Training Commenced"
                
                # Look for epoch/step indicators
                # Simple heuristic: find the highest step/epoch mentioned
                import re
                steps = re.findall(r"Step (\d+)/(\d+)", content)
                if steps:
                    curr, total = steps[-1]
                    progress = 0.4 + (float(curr)/float(total) * 0.5)
                    phase = f"Synthesizing Personality: Step {curr}/{total}"
                
                if "Training complete" in content:
                    progress = 0.9
                    phase = "Synthesis Complete. Preparing HF Push."
                if "Uploaded to https://huggingface.co" in content:
                    progress = 1.0
                    phase = "H.U.G.H. is fully operational."

        if "ERROR" in status:
            phase = "Neural Cascade Failure. Attempting recovery..."
            progress = progress * 0.8 # Visual drop on error

        with open(PROGRESS_FILE, 'w') as f:
            json.dump({"progress": progress, "phase": phase, "timestamp": time.time()}, f)
            
    except Exception as e:
        print(f"Update error: {e}")

if __name__ == "__main__":
    get_status()
