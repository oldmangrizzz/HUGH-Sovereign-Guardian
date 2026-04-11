import subprocess, time, os, sys, re

KAGGLE_BIN = "/Users/grizzmed/Library/Python/3.9/bin/kaggle"
SLUG = "grizzlymedicine/h-u-g-h-unsloth-synthesis-v1"
LOG_DIR = "/tmp/hugh-final-logs/"

def repl_loop():
    print("="*60)
    print(" H.U.G.H. SOVEREIGN SYNTHESIS — ACTIVE MISSION CONTROL")
    print("="*60)
    print("Target: DavidAU/LFM2.5-1.2B (Heretic-Opus-4.6)")
    print("Status: SYNCHRONIZING WITH SUBSTRATE...")
    
    os.makedirs(LOG_DIR, exist_ok=True)
    last_step = 0
    
    while True:
        try:
            status_res = subprocess.run(f"{KAGGLE_BIN} kernels status {SLUG}", shell=True, capture_output=True, text=True)
            status = status_res.stdout.strip()
            
            # Pull logs
            subprocess.run(f"{KAGGLE_BIN} kernels output {SLUG} -p {LOG_DIR}", shell=True, capture_output=True)
            log_path = os.path.join(LOG_DIR, "h-u-g-h-unsloth-synthesis-v1.log")
            
            if os.path.exists(log_path):
                with open(log_path, 'r') as f:
                    content = f.read()
                    # Pattern match Step and Loss from Trainer output
                    matches = re.findall(r"'loss': ([\d\.]+), 'epoch': ([\d\.]+), 'step': (\d+)", content)
                    if matches:
                        loss, epoch, step = matches[-1]
                        step_int = int(step)
                        if step_int > last_step:
                            print(f"[{time.strftime('%H:%M:%S')}] STEP: {step_int} | LOSS: {loss} | EPOCH: {epoch}")
                            last_step = step_int
                    
                    if "SYNTHESIS COMPLETE" in content:
                        print("="*60)
                        print(" MISSION ACCOMPLISHED: NEURAL SYNTHESIS COMPLETE.")
                        print("="*60)
                        sys.exit(0)

            if "ERROR" in status:
                print(f"[{time.strftime('%H:%M:%S')}] SUBSTRATE STUTTER DETECTED. RE-INITIATING...")
                subprocess.run(f"{KAGGLE_BIN} kernels push -p /Users/grizzmed/ProxmoxMCP-Plus/hugh-agent/training-v2/", shell=True)
                time.sleep(60)

        except Exception as e:
            pass
        time.sleep(10)

if __name__ == "__main__":
    repl_loop()
