import numpy as np, onnxruntime as ort
sess = ort.InferenceSession("qwen_attn.onnx", providers=["CPUExecutionProvider"])
print("inputs:", [i.name for i in sess.get_inputs()])
outs = [o.name for o in sess.get_outputs()]
print("outputs:", len(outs), "→", outs[:3], "...", outs[-1])
ids = np.array([[100472, 99405, 100655]], dtype=np.int64)  # 猫吃鱼
res = sess.run(None, {"input_ids": ids})
# 找 logits + attn_23（最后一层）
d = dict(zip(outs, res))
print("logits shape:", d["logits"].shape)
a = d["attn_23"][0, 0]  # 最后一层 head0 [seq,seq]
print("最后一层 head0 注意力（应 ≈ 吃→猫0.75, 鱼→猫0.43/吃0.39）:")
for row in a: print("  ", " ".join(f"{v:.2f}" for v in row))
