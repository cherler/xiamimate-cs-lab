#!/usr/bin/env bash
# 在 AutoDL 上一把跑完「带残差流+MLP+注意力」的 Qwen ONNX 导出。
# 用法：把 scripts/qwen-attn-export/ 整个传到 /root/autodl-tmp/qwen-export/ 后，
#       cd /root/autodl-tmp/qwen-export && bash autodl_run.sh
# 产物：qwen_full_int8.onnx(+可能的 .onnx_data)，再 scp 回本机 web/public/models/qwen-full/
set -e
cd "$(dirname "$0")"

echo "==[1/5] 装依赖（torch 用镜像自带的，别动）=="
# transformers 必须 4.44.2（新版注意力重构会让 onnx 导出撞 functorch/vmap）
pip install "transformers==4.44.2" onnx onnxruntime onnxscript safetensors modelscope accelerate

echo "==[2/5] 从 ModelScope 下 Qwen2.5-0.5B-Instruct（大陆直连，约 1GB）=="
[ -d ./model ] && [ -f ./model/config.json ] && echo "  ./model 已存在，跳过" || python3 download_model.py

echo "==[3/5] PyTorch 侧先验中文注意力（猫吃鱼→吃看猫）=="
python3 verify_attn.py

echo "==[4/5] 导出完整 ONNX（logits+attn_0..23+hs_0..24+mlp_0..23，CPU 几分钟）=="
python3 export_full.py
python3 verify_full.py

echo "==[5/5] 合并外部权重 + int8 量化 =="
python3 pack_full.py

echo
echo "== 完成。产物： =="
ls -la qwen_full_int8.onnx* 2>/dev/null || ls -la qwen_full*.onnx
echo
echo "把 qwen_full_int8.onnx(和同名 .onnx_data 若有) 传回本机："
echo "  本机跑： scp -P <端口> root@<autodl地址>:$(pwd)/qwen_full_int8.onnx* web/public/models/qwen-full/"
