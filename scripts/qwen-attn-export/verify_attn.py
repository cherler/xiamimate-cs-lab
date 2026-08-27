# 验证：Qwen2.5-0.5B 用 output_attentions 能拿到中文注意力（PyTorch 侧，先不导 ONNX）
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL = "./model"
tok = AutoTokenizer.from_pretrained(MODEL)
# eager 注意力才会返回 attention 权重（sdpa/flash 不返回）
model = AutoModelForCausalLM.from_pretrained(MODEL, torch_dtype=torch.float32, attn_implementation="eager")
model.eval()

text = "猫吃鱼"
enc = tok(text, return_tensors="pt")
ids = enc["input_ids"][0].tolist()
toks = [tok.decode([i]) for i in ids]
print("tokens:", toks)

with torch.no_grad():
    out = model(**enc, output_attentions=True, use_cache=False)

attns = out.attentions  # tuple(层) 每个 [1, heads, seq, seq]
print("层数:", len(attns), "| 每层形状:", tuple(attns[0].shape))
L = len(attns) - 1  # 看最后一层
head0 = attns[L][0, 0]  # [seq, seq]
print(f"\n最后一层 head0 注意力矩阵（行=query token，列=key token，因果下三角）：")
print("        " + "  ".join(f"{t:>4}" for t in toks))
for i, row in enumerate(head0.tolist()):
    print(f"{toks[i]:>4} " + "  ".join(f"{v:4.2f}" for v in row))
# 每行应和为 1（softmax），下三角
print("\n每行和（应≈1）:", [round(float(r.sum()),3) for r in head0])
