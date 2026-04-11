import os
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, TrainingArguments
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from datasets import load_dataset
from trl import SFTTrainer

# ── MISSION OBJECTIVE: ARC-AGI-3 ──────────────────────────────────
MODEL_ID = "DavidAU/LFM2.5-1.2B-Thinking-Claude-4.6-Opus-Heretic-Uncensored-DISTILL"
HF_TOKEN = "os.environ["HF_TOKEN"]"
DATASET_FILE = "/kaggle/input/hugh-personality-v3-arc/hugh_personality_training_v2.jsonl"

print(f"[HUGH] Loading substrate: {MODEL_ID}")

# 1. Load tokenizer
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, token=HF_TOKEN, trust_remote_code=True)
tokenizer.pad_token = tokenizer.eos_token

# 2. BitsAndBytes for 4-bit imprint
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_use_double_quant=True,
)

# 3. Load base model
model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    quantization_config=bnb_config,
    device_map="auto",
    token=HF_TOKEN,
    trust_remote_code=True
)
model = prepare_model_for_kbit_training(model)

# 4. Apply Sovereign LoRA (Rank 128)
peft_config = LoraConfig(
    r=128,
    lora_alpha=128,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    bias="none",
    task_type="CAUSAL_LM",
)
model = get_peft_model(model, peft_config)

print("[HUGH] Neural anchors locked. Commencing imprint...")

# 5. Load and format dataset
def format_chat(example):
    text = ""
    for msg in example["messages"]:
        text += f"<|{msg['role']}|>\n{msg['content']}\n"
    return {"text": text}

dataset = load_dataset("json", data_files=DATASET_FILE, split="train")
dataset = dataset.map(format_chat)

# 6. Train
trainer = SFTTrainer(
    model=model,
    train_dataset=dataset,
    dataset_text_field="text",
    max_seq_length=2048,
    tokenizer=tokenizer,
    args=TrainingArguments(
        output_dir="./hugh_weights",
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        num_train_epochs=10,
        learning_rate=2e-4,
        logging_steps=1,
        save_strategy="no",
        fp16=True,
        report_to="none"
    ),
)

trainer.train()
print("[HUGH] SYNTHESIS COMPLETE. ARCHIVING WEIGHTS.")
model.save_pretrained("./final_adapter")
