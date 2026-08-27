import numpy as np, onnxruntime as ort
sess = ort.InferenceSession("qwen_full.onnx", providers=["CPUExecutionProvider"])
outs = [o.name for o in sess.get_outputs()]
print("输出个数:", len(outs))
print("  含 logits:", "logits" in outs, "| attn_23:", "attn_23" in outs,
      "| hs_24:", "hs_24" in outs, "| mlp_23:", "mlp_23" in outs)
ids = np.array([[100472, 99405, 100655]], dtype=np.int64)  # 猫吃鱼
res = dict(zip(outs, sess.run(None, {"input_ids": ids})))
print("logits:", res["logits"].shape, "| hs_0(词嵌入后):", res["hs_0"].shape,
      "| hs_24(末层):", res["hs_24"].shape, "| mlp_0:", res["mlp_0"].shape)
a = res["attn_23"][0,0]
print("末层 head0 注意力(应≈吃→猫0.75):")
for row in a: print("  ", " ".join(f"{v:.2f}" for v in row))
# 残差流范数逐层增长的粗查（末位 token）
import numpy as np
norms = [float(np.linalg.norm(res[f"hs_{i}"][0,-1])) for i in range(25)]
print("残差流范数(末位token,hs_0..24):", " ".join(f"{n:.1f}" for n in norms))
