#!/bin/bash
# H.U.G.H. Model Swap — single-model GPU policy (RX 580 8GB)
set -e

MODEL_TYPE=${1:-base}
SERVICE_FILE='/etc/systemd/system/llama-gemma3n.service'
# Updated binary for Project Infamous (HIP/ROCm build)
LLAMA_BIN='/root/llama.cpp/build/bin/llama-server'

case $MODEL_TYPE in
  cortex|gemma4)
    # Project Infamous: Gemma 4 26B A4B MoE
    MODEL_PATH='/opt/hugh/models/google_gemma-4-26B-A4B-it-Q3_K_L.gguf'
    CTX=8192
    NGL=33
    MODEL_TYPE=cortex
    ;;
  thinking)
    MODEL_PATH='/root/llama.cpp/models/lfm-2.5-thinking/lfm-2.5-thinking-q8.gguf'
    CTX=2048
    NGL=25
    ;;
  vision)
    MODEL_PATH='/opt/hugh/models/Qwen2.5-Omni-3B-Q4_K_M.gguf'
    CTX=4096
    NGL=25
    ;;
  base|*)
    MODEL_PATH='/opt/hugh/models/gemma-3n-E2B-it-Q8_0.gguf'
    CTX=4096
    NGL=25
    MODEL_TYPE=base
    ;;
esac

if [ ! -f "$MODEL_PATH" ]; then
  echo "ERROR: Model not found: $MODEL_PATH"
  exit 1
fi

echo "[model-swap] Stopping current model..."
systemctl stop llama-gemma3n 2>/dev/null || true
systemctl stop llama-audio 2>/dev/null || true
sleep 2

echo "[model-swap] Loading $MODEL_TYPE: $(basename $MODEL_PATH)"
sed -i "s|ExecStart=.*|ExecStart=${LLAMA_BIN} -m ${MODEL_PATH} --host 0.0.0.0 --port 8081 --ctx-size ${CTX} -t 4 -cb -np 1 --mlock -ngl ${NGL}|" $SERVICE_FILE
systemctl daemon-reload
systemctl start llama-gemma3n

echo "[model-swap] Waiting for model load (MoE targets take longer)..."
for i in $(seq 1 120); do
  if curl -s --max-time 2 http://localhost:8081/models >/dev/null 2>&1; then
    echo "[model-swap] $MODEL_TYPE online on :8081 (${i}s)"
    exit 0
  fi
  sleep 1
done

echo "[model-swap] WARNING: Model did not respond within 120s. Check: systemctl status llama-gemma3n"
exit 1
