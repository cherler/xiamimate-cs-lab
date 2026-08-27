# 把中文小模型搬进浏览器 · Qwen2.5-0.5B 验证原型

纯浏览器端跑真模型（transformers.js v3 + WebGPU/WASM，无服务器）。敲中文 → 看**真实分词**（native CJK token，无星号）+ **下一个词 top-k 概率** + **续写**。是 transformer-explainer 的中文版、也是实验室 T★「完整前向拼装」的真模型升级。

## 跑起来

需要用 http 服务打开（不能 file://，WASM/WebGPU 要安全上下文；localhost 算安全）：

```bash
cd experiments/qwen-browser
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

选 Qwen2.5-0.5B → 载入模型（首次下载约 460MB，缓存到浏览器）→ 敲中文 → 预测/续写。

## 模型来源：用 ModelScope，一次下好自托管

浏览器抓模型权重要求来源开 **CORS**，且大陆要能连上。实测结论：

| 来源 | 大陆可达 | CORS | 结论 |
|---|---|---|---|
| **modelscope.cn** | ✓ | ✓ (`*`) | **推荐**。`onnx-community/Qwen2.5-0.5B-Instruct` 已在 ModelScope，URL 是 HF 式 `resolve/master/` |
| huggingface.co | ✗ | ✓ | 大陆连不上 |
| hf-mirror.com | ✓ | ✗ | 浏览器 fetch 被 CORS 挡（curl 能下是因为不查 CORS） |

**别每次都联网下** —— 一次下好、放自己服务器发（就像 transformer-explainer 把 626MB 模型放在自己站上）：

```bash
bash scripts/fetch-qwen-model.sh          # 从 ModelScope 下 q4f16 到 web/public/models/（一次）
bash scripts/fetch-qwen-model.sh int8     # 想要 WASM 兜底再下 int8
```

之后页面「模型来源 host」保持默认同源 `/models` 即可 —— 权重从**你自己的服务器**发、浏览器再缓存，**不再向任何外部下载**。`web/public/models/` 已 gitignore（几百 MB 是部署资产、不进 git）。零部署想直接试：host 填 `https://modelscope.cn/models`。

> 为什么是几百 MB？真模型都这么大 —— transformer-explainer 自己的 GPT-2 是 **626MB**（比这还大），它"快"是因为浏览器缓存过 + GitHub Pages CDN。Qwen-0.5B 里 15 万词表的 embedding 就占了一半，q4f16≈460MB 已是中文可用模型的地板。第一次下完就缓存，之后秒开。

## 已验证

- 分词对比：Qwen「猫吃鱼」= `[猫 吃 鱼]`（3 token，每字可读）vs GPT-2 = 8 个 `�`。
- Node 端 int8 推理：`猫吃`→下一词含「鱼」；续写「人工智能正在」→「…改变我们的生活，它在教育、医疗、娱乐等多个领域…」（流畅中文）。
- 浏览器端 & Node 从自托管 `/models`（int8/wasm，实跑）：`猫吃鱼很`→ 分词 `[猫 吃 鱼 很]`、下一词 `不6.5% 厉害5.5% 讨厌4.5% 痛苦4.0%…`、续写成句。

## 模型对中文的友好度（截图那几个）

Qwen ≫ Gemma > SmolLM > GPT-2。Qwen 原生 CJK 词表（一字≈一 token），星号问题从源头不存在；GPT-2 字节级 BPE，中文全是星号且模型不懂中文。9B 级（q4≈5GB）浏览器端不现实，0.5B/1.5B 是甜点。
