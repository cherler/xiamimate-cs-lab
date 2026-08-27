import onnx, os
from onnxruntime.quantization import quantize_dynamic, QuantType
# 1) 合并散落的外部权重到单个 .onnx_data
print("合并外部权重…")
m = onnx.load("qwen_attn.onnx")  # 自动加载外部数据
onnx.save_model(m, "qwen_attn_merged.onnx", save_as_external_data=True,
                all_tensors_to_one_file=True, location="qwen_attn_merged.onnx_data", size_threshold=0)
print("  merged:", os.path.getsize("qwen_attn_merged.onnx_data")//1024//1024, "MB data")
# 2) 动态量化到 int8（浏览器体积）
print("量化 int8…")
quantize_dynamic("qwen_attn_merged.onnx", "qwen_attn_int8.onnx", weight_type=QuantType.QInt8)
sz = os.path.getsize("qwen_attn_int8.onnx")
extra = "qwen_attn_int8.onnx_data"
if os.path.exists(extra): sz += os.path.getsize(extra)
print("  int8 总大小:", sz//1024//1024, "MB")
