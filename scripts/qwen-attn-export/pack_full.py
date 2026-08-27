import onnx, os
from onnxruntime.quantization import quantize_dynamic, QuantType
print("合并外部权重…")
m = onnx.load("qwen_full.onnx")
onnx.save_model(m, "qwen_full_merged.onnx", save_as_external_data=True,
                all_tensors_to_one_file=True, location="qwen_full_merged.onnx_data", size_threshold=0)
print("  merged:", os.path.getsize("qwen_full_merged.onnx_data")//1024//1024, "MB data")
print("量化 int8…")
quantize_dynamic("qwen_full_merged.onnx", "qwen_full_int8.onnx", weight_type=QuantType.QInt8)
sz = os.path.getsize("qwen_full_int8.onnx")
extra = "qwen_full_int8.onnx_data"
if os.path.exists(extra): sz += os.path.getsize(extra)
print("  int8 总大小:", sz//1024//1024, "MB")
