# 「完整版」导出：在 export_attn.py 基础上，额外吐出 **残差流**（每层 hidden_states）
# 和 **MLP 中间激活**（SwiGLU 的 gate*up），给中文 transformer-explainer 的更深图用。
#   - logits          [1,seq,vocab]
#   - attn_0..N-1      [1,heads,seq,seq]   （因果注意力，行和=1）
#   - hs_0..N          [1,seq,hidden]      （残差流：hs_0=词嵌入后，hs_i=第 i 个 block 之后；共 N+1 个）
#   - mlp_0..N-1       [1,seq,inter]       （每层 SwiGLU 的中间激活 act(gate)*up，进 down_proj 之前）
# ⚠️ 只能在有 torch + transformers==4.44.2 + Qwen 权重的机器上跑（lab 机）。
#    关键坑同 export_attn：新版 transformers(4.57) 注意力重构会撞 functorch/vmap；必须 4.44.2 + eager + opset14。
import torch
from transformers import AutoModelForCausalLM

MODEL = "./model"
OUT = "./qwen_full.onnx"

model = AutoModelForCausalLM.from_pretrained(MODEL, torch_dtype=torch.float32, attn_implementation="eager")
model.eval()
n_layers = model.config.num_hidden_layers
print(f"层数 {n_layers}, heads {model.config.num_attention_heads}, hidden {model.config.hidden_size}, inter {model.config.intermediate_size}")

# 用 forward hook 抓每层 MLP 的 SwiGLU 中间激活（down_proj 的输入）。
# Qwen2MLP.forward: down_proj(act_fn(gate_proj(x)) * up_proj(x)) —— 我们钩 down_proj 的输入。
mlp_cache = []
def make_hook():
    def hook(module, inp, out):
        mlp_cache.append(inp[0])   # down_proj 的输入 = act(gate)*up
    return hook
for layer in model.model.layers:
    layer.mlp.down_proj.register_forward_hook(make_hook())

class Wrap(torch.nn.Module):
    def __init__(self, m): super().__init__(); self.m = m
    def forward(self, input_ids):
        mlp_cache.clear()
        out = self.m(input_ids=input_ids, output_attentions=True,
                     output_hidden_states=True, use_cache=False)
        # out.hidden_states: 长度 n_layers+1 的 tuple；out.attentions: 长度 n_layers
        return (out.logits,) + tuple(out.attentions) + tuple(out.hidden_states) + tuple(mlp_cache)

wrapped = Wrap(model)
dummy = torch.tensor([[104, 100, 102, 103]])

out_names = (["logits"]
             + [f"attn_{i}" for i in range(n_layers)]
             + [f"hs_{i}" for i in range(n_layers + 1)]
             + [f"mlp_{i}" for i in range(n_layers)])
dyn = {"input_ids": {0: "batch", 1: "seq"}, "logits": {1: "seq"}}
for i in range(n_layers): dyn[f"attn_{i}"] = {2: "seq", 3: "seq"}
for i in range(n_layers + 1): dyn[f"hs_{i}"] = {1: "seq"}
for i in range(n_layers): dyn[f"mlp_{i}"] = {1: "seq"}

print(f"导出中(CPU,可能几分钟)… 共 {len(out_names)} 个输出")
torch.onnx.export(
    wrapped, (dummy,), OUT,
    export_params=True, opset_version=14, do_constant_folding=True,
    input_names=["input_ids"], output_names=out_names, dynamic_axes=dyn,
)
import os
print(f"✓ 导出完成 {OUT}  ({os.path.getsize(OUT)//1024//1024} MB)")
print("接着跑 pack.py（合并外部权重）+ verify_onnx.py 抽查，再 quantize 成 int8 放 web/public/models/qwen-full/")
