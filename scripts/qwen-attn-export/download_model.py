# 从 ModelScope 下 Qwen2.5-0.5B-Instruct 的 PyTorch 权重到 ./model（大陆可达，不需科学上网）
import os
from modelscope import snapshot_download
d = snapshot_download('Qwen/Qwen2.5-0.5B-Instruct', local_dir='./model')
print('✓ 模型已下到', d)
print('  文件:', sorted(os.listdir('./model'))[:12])
