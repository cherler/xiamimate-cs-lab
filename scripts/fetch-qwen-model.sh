#!/usr/bin/env bash
# 一次性把 Qwen 小模型从 ModelScope（大陆可达 + 带 CORS）下到本地静态目录，
# 之后由我们自己的服务器/静态托管来发，浏览器再缓存 —— 不再每次向 huggingface 下载。
# 用法：bash scripts/fetch-qwen-model.sh [q4f16|int8|q4]   （默认 q4f16，WebGPU 用；WASM 兜底用 int8）
set -euo pipefail

REPO="onnx-community/Qwen2.5-0.5B-Instruct"
VARIANT="${1:-q4f16}"
BASE="https://modelscope.cn/models/${REPO}/resolve/master"
DEST="web/public/models/${REPO}/resolve/main"     # transformers.js 按 {model}/resolve/main/ 找

mkdir -p "${DEST}/onnx"
echo "→ 从 ModelScope 下载 ${REPO}（${VARIANT}）到 ${DEST}"

for f in config.json generation_config.json tokenizer.json tokenizer_config.json; do
  echo "  · ${f}"
  curl -fSL --retry 3 -o "${DEST}/${f}" "${BASE}/${f}"
done

echo "  · onnx/model_${VARIANT}.onnx（几百 MB，一次就好）"
curl -fSL --retry 3 -o "${DEST}/onnx/model_${VARIANT}.onnx" "${BASE}/onnx/model_${VARIANT}.onnx"

echo "✓ 完成。页面「模型来源 host」保持默认（同源 /models）即可，之后不再联网抓权重。"
echo "  想要 WASM 兜底再跑一次：bash scripts/fetch-qwen-model.sh int8"
