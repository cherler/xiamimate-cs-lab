# 重导带「注意力输出」的 Qwen2.5-0.5B（给中文版 transformer-explainer 用）

标准 onnx-community 的 Qwen ONNX 只吐 `logits`，不吐注意力。这套脚本把 Qwen 重导成
额外输出**每层注意力权重**（`attn_0..attn_23`）的 ONNX —— 于是浏览器里能画真实中文注意力热力图。
改编自 poloclub/transformer-explainer 的 export 思路（MIT）。

## ⚠️ 关键坑（省得再踩）
- **必须 `transformers==4.44.x`**：新版 4.57 的注意力重构会让 `torch.onnx.export` 撞 functorch/vmap bug；
  dynamo 导出器又撞 `torch.export` ProxyMode bug。4.44 + 老 tracer(opset 14) 才干净导出。
- **必须 `attn_implementation="eager"`**：sdpa/flash 不返回注意力权重。

## 步骤
```bash
pip install "torch" "transformers==4.44.2" onnx onnxruntime onnxscript safetensors
# 权重从 ModelScope 下（大陆可达）：Qwen/Qwen2.5-0.5B-Instruct 的 safetensors 到 ./model/
python3 verify_attn.py    # 先在 PyTorch 侧确认能拿到中文注意力（猫吃鱼 → 吃→猫0.75…）
python3 export_attn.py    # 导出 qwen_attn.onnx（fp32，权重散成外部文件）
python3 pack.py           # 合并外部权重 + 量化 int8 → qwen_attn_int8.onnx（~649MB）
python3 verify_onnx.py    # onnxruntime 验证输出对得上 PyTorch
```

## 浏览器怎么用
用 **onnxruntime-web** 直接跑 `qwen_attn_int8.onnx`（不走 transformers.js AutoModel —— 它只认标准输出）：
喂 `input_ids`（Qwen tokenizer 分词），读 `logits` + `attn_0..attn_23`，画注意力矩阵热力图 + 连线。
分词器用 transformers.js 的 `AutoTokenizer.from_pretrained('onnx-community/Qwen2.5-0.5B-Instruct')`（走 ModelScope）。
模型文件几百 MB，自托管到 `web/public/models/qwen-attn/` 并 gitignore（同 [[browser-inference-cjk]] 的 fetch 模式）。

## 验证过的事实
- PyTorch(4.44) 提取中文注意力：24 层 ×14 头，因果下三角，每行 softmax 和=1。
- 导出 ONNX(fp32) onnxruntime 跑出的注意力与 PyTorch 分毫不差。
- int8 量化后（649MB）注意力**模式保持**（吃→猫 主导、鱼 分散），但数值有 ~15% 漂移；要精确用 fp16(~1.2GB)。

## export_full.py（phase 2：更深内部量，待 lab 机跑）
`export_attn.py` 只吐 logits + 每层注意力，够画注意力热力图/小图/下一词预测。
要画 transformer-explainer 更深的图（残差流演化、MLP-SwiGLU 激活），跑 `export_full.py`：
额外输出 `hs_0..N`（残差流，`output_hidden_states`）+ `mlp_0..N-1`（SwiGLU 中间激活，forward hook 钩 `down_proj` 输入）。
坑与 export_attn 完全一致：**transformers==4.44.2 + eager + opset14**，只能在有 torch+权重的机器跑。
产物走一样的 `pack.py`（合并外部权重）→ quantize int8 → 放 `web/public/models/qwen-full/`，浏览器侧再加对应面板。
