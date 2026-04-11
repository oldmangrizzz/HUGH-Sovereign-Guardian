from unsloth import FastLanguageModel
import torch
from datasets import load_dataset
from trl import SFTTrainer
from transformers import TrainingArguments

# ── MISSION OBJECTIVE: >50% ARC-AGI-3 ──────────────────────────────────
model_name = "DavidAU/LFM2.5-1.2B-Thinking-Claude-4.6-Opus-Heretic-Uncensored-DISTILL"
max_seq_length = 2048
dtype = None # Auto detect
load_in_4bit = True

print("[HUGH] Loading High-Performance Substrate (Unsloth)...")
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = model_name,
    max_seq_length = max_seq_length,
    dtype = dtype,
    load_in_4bit = load_in_4bit,
    token = "os.environ.get("HF_TOKEN", "")"
)

# ── APPLY SOVEREIGN LORA (RANK 128) ──────────────────────────────────
model = FastLanguageModel.get_peft_model(
    model,
    r = 128, # High rank for extreme personality imprint
    target_modules = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_alpha = 128,
    lora_dropout = 0, # Optimized for Unsloth
    bias = "none",
)

print("[HUGH] Neural Anchors set. Imprinting heritage data...")
dataset = load_dataset("json", data_files="/tmp/hugh_personality_training_v3_final.jsonl", split="train")

trainer = SFTTrainer(
    model = model,
    tokenizer = tokenizer,
    train_dataset = dataset,
    dataset_text_field = "text",
    max_seq_length = max_seq_length,
    args = TrainingArguments(
        per_device_train_batch_size = 2,
        gradient_accumulation_steps = 4,
        warmup_steps = 5,
        max_steps = 150, # Targeted steps for 279 pairs
        learning_rate = 2e-4,
        fp16 = not torch.cuda.is_is_bf16_supported(),
        bf16 = torch.cuda.is_is_bf16_supported(),
        logging_steps = 1,
        output_dir = "outputs",
    ),
)

trainer.train()
print("[HUGH] Synthesis Complete. ARC-AGI-3 weights ready.")
