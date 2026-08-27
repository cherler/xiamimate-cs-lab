# 把 Qwen2.5-0.5B 重导成带「注意力权重」输出的 ONNX（logits + 每层 attention）
# 改编自 poloclub/transformer-explainer 的 export 思路(MIT)，但用 HF 的 output_attentions。
import torch
from transformers import AutoModelForCausalLM

MODEL = "./model"
OUT = "./qwen_attn.onnx"

model = AutoModelForCausalLM.from_pretrained(MODEL, torch_dtype=torch.float32, attn_implementation="eager")
model.eval()
n_layers = model.config.num_hidden_layers
print(f"层数 {n_layers}, heads {model.config.num_attention_heads}")

class Wrap(torch.nn.Module):
    def __init__(self, m): super().__init__(); self.m = m
    def forward(self, input_ids):
        out = self.m(input_ids=input_ids, output_attentions=True, use_cache=False)
        return (out.logits,) + tuple(out.attentions)   # logits + 每层 [1,heads,seq,seq]

wrapped = Wrap(model)
dummy = torch.tensor([[104, 100, 102, 103]])  # 4 个 token 的假输入

out_names = ["logits"] + [f"attn_{i}" for i in range(n_layers)]
dyn = {"input_ids": {0: "batch", 1: "seq"}, "logits": {1: "seq"}}
for i in range(n_layers): dyn[f"attn_{i}"] = {2: "seq", 3: "seq"}

print("导出中(CPU,可能几分钟)…")
torch.onnx.export(
    wrapped, (dummy,), OUT,
    export_params=True, opset_version=14, do_constant_folding=True,
    input_names=["input_ids"], output_names=out_names, dynamic_axes=dyn,
)
import os
print(f"✓ 导出完成 {OUT}  ({os.path.getsize(OUT)//1024//1024} MB)")
