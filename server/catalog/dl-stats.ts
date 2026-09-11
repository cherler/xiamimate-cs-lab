//
// 出题目录分片：深度学习算法 + 概率统计原理（13 个实验）。
//
// 每个 fact 的 compute 都从引擎真实 trace 里读字段、算答案，绝不硬编码；
// doc 与 web/src/registry.ts 里对应实验的 defaultDoc 一致（除 norm 带 params，其余都是最简 doc）。
// 由 catalog.ts 汇总进 CATALOG。改这个文件不影响其它分片。
//
import { backpropKernel } from '../../src/kernels/backprop.ts'
import { diffusionKernel } from '../../src/kernels/diffusion.ts'
import { ganKernel } from '../../src/kernels/gan.ts'
import { gcnKernel, GCN_GRAPHS, GCN_AGGS } from '../../src/kernels/gcn.ts'
import { lstmKernel } from '../../src/kernels/lstm.ts'
import { normKernel } from '../../src/kernels/norm.ts'
import { rnnKernel } from '../../src/kernels/rnn.ts'
import { bayesKernel } from '../../src/kernels/bayes.ts'
import { cltKernel } from '../../src/kernels/clt.ts'
import { jlKernel } from '../../src/kernels/jl.ts'
import { llnKernel } from '../../src/kernels/lln.ts'
import { maxentKernel } from '../../src/kernels/maxent.ts'
import { xentKernel } from '../../src/kernels/xent.ts'
import { numDistractors, trivialDoc, last, type CatalogEntry, type Kernel } from '../catalog-shared.ts'

// 选择题干扰项：从固定概念列表里剔掉正确答案，取前 3 个。
const pick3 = (answer: string, opts: string[]) => opts.filter(o => o !== answer).slice(0, 3)

export const DL_STATS_ENTRIES: CatalogEntry[] = [
  // ── 反向传播 ──
  {
    id: 'backprop', title: '反向传播', kernel: backpropKernel as Kernel<unknown>,
    doc: trivialDoc('backprop'),
    facts: [
      {
        id: 'loss', label: '前向算出的损失 L', kind: 'number',
        ask: '这个神经元 x=1、w=0.8、b=0.2、t=1，前向传播算出的损失 L=(a−t)² 是多少?',
        compute: t => { const f = last(t); return { answer: String(f.loss), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'dLdw', label: '反向传播回传到权重 w 的梯度 dL/dw', kind: 'number',
        ask: '一次反向传播后，损失对权重的梯度 dL/dw 等于多少?',
        compute: t => { const f = last(t); return { answer: String(f.gLdw), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'steps', label: '前向+反向逐步演示的总帧数', kind: 'number',
        ask: '这个反向传播实验（前向一趟 + 反向逐站回传）逐步演示一共有多少帧(步)?',
        compute: t => ({ answer: String(t.length), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
      {
        id: 'dw_sign', label: 'dL/dw 的符号决定梯度下降怎样调 w', kind: 'choice',
        ask: '算出的 dL/dw 是负数，那么梯度下降(w ← w − η·dL/dw)会把 w 往哪个方向调?',
        compute: t => {
          const f = last(t); const g = Number(f.gLdw)
          const answer = g < 0 ? '增大 w（因为梯度是负的）' : g > 0 ? '减小 w（因为梯度是正的）' : 'w 不变（梯度为零、已收敛）'
          return { answer, step: t.length - 1, evidence: String(f.log ?? '') }
        },
        distractors: a => pick3(a, ['增大 w（因为梯度是负的）', '减小 w（因为梯度是正的）', 'w 不变（梯度为零、已收敛）', '把 w 直接设成 0 重新来过']),
      },
    ],
  },

  // ── 循环神经网络 RNN ──
  {
    id: 'rnn', title: '循环神经网络 RNN', kernel: rnnKernel as Kernel<unknown>,
    doc: trivialDoc('rnn'),
    facts: [
      {
        id: 'h1', label: '第 1 步的隐藏状态 h₁', kind: 'number',
        ask: '序列 [2,−1,3,−2]、wx=0.5 wh=0.8 b=0，读入第一个输入后隐藏状态 h₁=tanh(wx·x) 是多少?',
        compute: t => { const f = t.find(x => x.t === 1) ?? t[0]!; return { answer: String(f.ht), step: t.indexOf(f), evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'hlast', label: '读完整段序列后的末态隐藏状态', kind: 'number',
        ask: '把整段序列 [2,−1,3,−2] 读完，末态隐藏状态 h 是多少?',
        compute: t => { const f = last(t); return { answer: String(f.ht), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'seqlen', label: '输入序列长度', kind: 'number',
        ask: '这个 RNN 实验里，一共要逐步读入几个时间步的输入?',
        compute: t => { const f = last(t); return { answer: String((f.xs as number[]).length), step: t.length - 1, evidence: `序列 xs=${JSON.stringify(f.xs)}` } },
        distractors: numDistractors,
      },
      {
        id: 'shared', label: '各时间步的权重是否共享', kind: 'choice',
        ask: 'RNN 在各个时间步用来更新记忆的权重 wx、wh 是怎么用的?',
        compute: t => {
          const run = t.filter(f => f.phase === 'run')
          const shared = run.every(f => f.wx === run[0].wx && f.wh === run[0].wh)
          const answer = shared ? '所有时刻共享同一套 wx、wh' : '每个时间步各学一套权重'
          return { answer, step: 0, evidence: `各步 wx=${run.map(f => f.wx).join(',')}；wh=${run.map(f => f.wh).join(',')}` }
        },
        distractors: a => pick3(a, ['所有时刻共享同一套 wx、wh', '每个时间步各学一套自己的权重', '只共享 wh，wx 每一步都不同', '权重随着时间步线性增长上去']),
      },
    ],
  },

  // ── LSTM 门控 ──
  {
    id: 'lstm', title: 'LSTM 门控', kernel: lstmKernel as Kernel<unknown>,
    doc: trivialDoc('lstm'),
    facts: [
      {
        id: 'cell', label: '传送带 cell 状态 c 全程稳定值', kind: 'number',
        ask: '这个「存→守→守→取」的标量 LSTM，细胞状态 c（传送带）被守住时全程稳在多少?',
        compute: t => { const f = last(t); return { answer: String(f.c), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'hout', label: '末步取出的隐藏状态 h', kind: 'number',
        ask: '最后一步开输出门取出记忆，h = o·tanh(c) 等于多少?',
        compute: t => { const f = last(t); return { answer: String(f.h), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'keep', label: '中间「守」两步 cell 状态如何变化', kind: 'choice',
        ask: '中间两步「守」时（遗忘门 f=1、输入门 i=0），细胞状态 c 会怎样变化?',
        compute: t => {
          const keep = t.filter(f => f.role === '守')
          const same = keep.length > 0 && keep.every(f => f.c === keep[0].c)
          const answer = same ? `不变——遗忘门 f=1 守住，c 恒为 ${keep[0].c}` : 'c 每步都被改写'
          return { answer, step: t.indexOf(keep[0] ?? last(t)), evidence: `「守」各步 c=${keep.map(f => f.c).join(',')}` }
        },
        distractors: a => pick3(a, [a, '每步过 tanh 被挤压、逐渐衰减到 0 为止', '每步都往上累加，值越来越大', '直接清零、记忆整个都丢失掉']),
      },
    ],
  },

  // ── 归一化 BatchNorm / LayerNorm ──
  {
    id: 'norm', title: '归一化 BatchNorm / LayerNorm', kernel: normKernel as Kernel<unknown>,
    doc: { kind: 'norm', params: { kind: '批归一化' }, entities: [], streams: [] },
    facts: [
      {
        id: 'sigma1', label: '批归一化第 1 个特征(列)的标准差 σ', kind: 'number',
        ask: '批归一化时，第 1 个特征（第 1 列，跨 4 个样本）算出的标准差 σ 是多少?',
        compute: t => { const f = t.find(x => x.slice === 0)!; return { answer: String(f.sigma), step: t.indexOf(f), evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'mu1', label: '批归一化第 1 个特征(列)的均值 μ', kind: 'number',
        ask: '批归一化时，第 1 个特征（第 1 列，值为 [2,2,6,6]）的均值 μ 是多少?',
        compute: t => { const f = t.find(x => x.slice === 0)!; return { answer: String(f.mu), step: t.indexOf(f), evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'axis', label: '批归一化沿哪条轴统计 μ、σ', kind: 'choice',
        ask: 'BatchNorm（批归一化）是沿哪条轴统计均值和标准差的?',
        compute: t => {
          const f = t[0]!
          const answer = f.axis === 'col' ? '样本轴：每个特征(列)跨全部样本统计' : '特征轴：每个样本(行)跨全部特征统计'
          return { answer, step: 0, evidence: String(f.log ?? '') }
        },
        distractors: a => pick3(a, ['样本轴：每个特征(列)跨全部样本统计', '特征轴：每个样本(行)跨全部特征统计', '沿对角线方向统计', '对整张表所有元素一起统计']),
      },
    ],
  },

  // ── 图卷积 GCN：看得越远，也糊得越平 ──
  {
    id: 'gcn', title: '图卷积 GCN', kernel: gcnKernel as Kernel<unknown>,
    /*  2026-09-09 补厚：老那三条 fact 全建立在"只跑一层"上（"一层聚合后节点 4 的新特征"）。
        现在层数是旋钮、默认 3 层，那些问法都不成立了。 */
    doc: { kind: 'gcn', params: { graph: GCN_GRAPHS[0], agg: GCN_AGGS[0], layers: 3 }, entities: [], streams: [] },
    facts: [
      {
        id: 'layer1_node2', label: '第一层之后节点 2 的特征', kind: 'number', genre: 'count',
        ask: '5 节点小图（边：0-1、0-2、1-2、2-3、3-4），初始特征 [1,0,0,0,1]。均值聚合（自己+所有邻居取平均），'
          + '**第一层之后**度最大的节点 2 的新特征是多少？（节点 2 的邻居是 0、1、3，加上自己一共 4 个）',
        compute: t => {
          const rows = last(t).rows as { layer: number; feat: number[] }[]
          return { answer: String(rows[0].feat[2]), step: t.length - 1,
            evidence: `第一层 [${rows[0].feat.join(', ')}]（节点 2 = (1+0+0+0)/4）` }
        },
        distractors: numDistractors,
      },
      {
        /*  ⚠️ 计数题要自带数据 */
        id: 'spread_10', label: '叠到 10 层时的离散度', kind: 'number', genre: 'count',
        ask: '实测的离散度（节点特征 max−min）随层数是：初始 1、1 层 0.25、2 层 0.112、3 层 0.082、5 层 0.051、'
          + '10 层 ?、20 层 0.004、50 层 0.004。**10 层那一档是多少？**',
        compute: t => {
          const ds = last(t).depthSweep as { layers: number; spread: number }[]
          return { answer: String(ds.find(d => d.layers === 10)!.spread), step: t.length - 1,
            evidence: `离散度 ${ds.map(d => `${d.layers}层 ${d.spread}`).join('、')}` }
        },
        distractors: numDistractors,
      },
      {
        /*  ⭐ 补厚的落点①：过平滑 */
        id: 'oversmoothing', label: '为什么 GCN 大多只有两三层', kind: 'choice', genre: 'concept',
        ask: 'CNN 动辄几十上百层，而实践中的 GCN 大多只叠两三层。为什么?',
        compute: t => {
          const ds = last(t).depthSweep as { layers: number; spread: number }[]
          return {
            answer: '层层取平均等于把整张图抹平，节点表示会糊成一样',
            step: t.length - 1,
            evidence: `实测离散度：初始 ${last(t).spread0} → ${ds.map(d => `${d.layers}层 ${d.spread}`).join('、')}`,
          }
        },
        distractors: a => [a,
          '图的节点数太多，再深就算不动了，是显存和时间的限制',
          '图的边太稀疏，深层拿不到足够的梯度，会梯度消失',
          '节点没有顺序，深层网络需要位置信息才能继续叠下去',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        /*  ⭐ 补厚的落点②：别拿"离散度没到 0"当"没有过平滑" */
        id: 'sym_still_smooth', label: '对称归一化的离散度没塌到 0', kind: 'choice', genre: 'concept',
        ask: '换成对称归一化之后，叠到 50 层离散度还剩 0.12、没有塌到 0。这说明它躲过了过平滑吗?',
        compute: t => ({
          answer: '没有 —— 它塌向正比于 √(度数+1) 的形状',
          step: t.length - 1,
          evidence: '换一组完全不同的初始特征跑深了还是这个形状 —— 节点原本携带的信息一样丢光了，只是丢的方式不同',
        }),
        distractors: a => [a,
          '躲过了 —— 离散度还剩 0.12，说明节点间仍有差别',
          '躲过了 —— 度归一化 D^(-1/2) 本来就是为了防抹平',
          '看图而定 —— 稀疏图上躲得过，稠密图上躲不过',
        ].filter(o => o !== a).slice(0, 3),
      },
      {
        /*  ⭐ 「L 跳」是验出来的 */
        id: 'receptive_field', label: '感受野这件事怎么验', kind: 'choice', genre: 'concept',
        ask: '「第 L 层的节点表示概括了它 L 跳内的子图」——这一屏是怎么验证这句话的?',
        compute: t => {
          const f = last(t)
          return {
            answer: '扰动一个节点的初始特征，看第 L 层有哪些节点跟着变',
            step: t.length - 1,
            evidence: `实测：扰动节点 ${f.probeSrc} 之后跟着变的节点，跟另拿 BFS 算的 ${f.layers} 跳内${f.hopsMatch ? '完全一致' : '对不上'}`,
          }
        },
        distractors: a => [a,
          '把每层的特征值打印出来，看数字有没有一层层往外扩散开',
          '数一数每个节点聚合时用到了几个邻居，加起来就是感受野',
          '看最终特征里还剩多少初始值的比例，比例越高说明传得越远',
        ].filter(o => o !== a).slice(0, 3),
      },
    ],
  },

  // ── 扩散模型 Diffusion ──
  {
    id: 'diffusion', title: '扩散模型 Diffusion', kernel: diffusionKernel as Kernel<unknown>,
    doc: trivialDoc('diffusion'),
    facts: [
      {
        id: 'sqrtA', label: '前向加噪到最噪时的信号系数 √ᾱ', kind: 'number',
        ask: '前向加噪进行到最后一步（信号最弱）时，信号系数 √ᾱ 约为多少?',
        compute: t => {
          const fwd = t.filter(f => f.dir === 'forward')
          const f = fwd.reduce((a, b) => (Number(b.t) > Number(a.t) ? b : a))
          return { answer: String(f.sqrtA), step: t.indexOf(f), evidence: String(f.log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'sqrtN', label: '前向加噪到最噪时的噪声系数 √(1−ᾱ)', kind: 'number',
        ask: '前向加噪到最后一步时，噪声系数 √(1−ᾱ) 约为多少?',
        compute: t => {
          const fwd = t.filter(f => f.dir === 'forward')
          const f = fwd.reduce((a, b) => (Number(b.t) > Number(a.t) ? b : a))
          return { answer: String(f.sqrtN), step: t.indexOf(f), evidence: String(f.log ?? '') }
        },
        distractors: numDistractors,
      },
      {
        id: 'trend', label: '前向加噪时 √ᾱ 如何变化', kind: 'choice',
        ask: '随着前向加噪一步步进行，信号系数 √ᾱ 是怎么变化的?',
        compute: t => {
          const fwd = t.filter(f => f.dir === 'forward').sort((a, b) => Number(a.t) - Number(b.t))
          const first = fwd[0], lastf = fwd[fwd.length - 1]
          const answer = Number(lastf.sqrtA) < Number(first.sqrtA)
            ? `递减：√ᾱ 从 ${first.sqrtA} 降到约 ${lastf.sqrtA}`
            : `递增：√ᾱ 从约 ${lastf.sqrtA} 升到 ${first.sqrtA}`
          return { answer, step: t.indexOf(lastf), evidence: String(lastf.log ?? '') }
        },
        distractors: a => pick3(a, [a, '不变：√ᾱ 恒为 1，只是叠加上噪声了', '先降后升：√ᾱ 中途会回到 0.5', '递增：√ᾱ 从 0.071 一路升到 1']),
      },
    ],
  },

  // ── 生成对抗网络 GAN ──
  {
    id: 'gan', title: '生成对抗网络 GAN', kernel: ganKernel as Kernel<unknown>,
    doc: trivialDoc('gan'),
    facts: [
      {
        id: 'acc_eq', label: '对抗达到均衡时判别器 D 的准确率', kind: 'number',
        ask: 'GAN 训练到对抗均衡时，判别器 D 的准确率(%)掉到了多少?',
        compute: t => { const f = last(t); return { answer: String(f.acc), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'acc_first', label: '第 0 轮(G 乱撒时)判别器 D 的准确率', kind: 'number',
        ask: '第 0 轮 G 造的假数据还在乱撒时，判别器 D 的准确率(%)是多少?',
        compute: t => { const f = t.find(x => x.round === 0)!; return { answer: String(f.acc), step: t.indexOf(f), evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'inside_eq', label: '均衡时钻过 D 边界、骗过 D 的假数据个数', kind: 'number',
        ask: '对抗均衡时，6 个假数据里有几个钻过了 D 的判别边界、骗过了 D?',
        compute: t => { const f = last(t); return { answer: String((f.fooled as boolean[]).filter(Boolean).length), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'meaning', label: 'D 准确率掉到 50% 意味着什么', kind: 'choice',
        ask: '训练到最后判别器 D 的准确率掉到约 50%，这说明了什么?',
        compute: t => {
          const acc = Number(last(t).acc)
          const answer = acc <= 60
            ? 'D 只能瞎猜——假分布≈真分布'
            : 'D 还能轻松分辨真假'
          return { answer, step: t.length - 1, evidence: String(last(t).log ?? '') }
        },
        distractors: a => pick3(a, [a, 'D 完美识破了所有的假数据', 'G 训练失败、假数据全部露馅了', '真假数据的标签被互换掉了']),
      },
    ],
  },

  // ── 贝叶斯定理 ──
  {
    id: 'bayes', title: '贝叶斯定理', kernel: bayesKernel as Kernel<unknown>,
    doc: trivialDoc('bayes'),
    facts: [
      {
        id: 'single', label: '单次阳性后的患病概率(百分比,约)', kind: 'number',
        ask: '患病率 1%、灵敏度 90%、误报率 9%，单次检测阳性后真患病的概率约是百分之多少(取整)?',
        compute: t => { const f = t.find(x => x.nTests === 1)!; return { answer: String(Math.round(Number(f.posterior) * 100)), step: t.indexOf(f), evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'final', label: '连续 4 次阳性后的患病概率(百分比,约)', kind: 'number',
        ask: '把上次后验当这次先验，连续 4 次阳性后患病概率约升到百分之多少(取整)?',
        compute: t => { const f = last(t); return { answer: String(Math.round(Number(f.posterior) * 100)), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'why', label: '为什么单次阳性只有约 9%', kind: 'choice',
        ask: '为什么单次检测阳性时，真患病概率也只有约 9%?',
        compute: t => {
          const f = t.find(x => x.nTests === 1)!
          const answer = Number(f.posterior) < 0.5
            ? '没病的人基数太大，误报淹没真阳性'
            : '单次阳性基本就能确诊'
          return { answer, step: t.indexOf(f), evidence: String(f.log ?? '') }
        },
        distractors: a => pick3(a, [a, '因为这个检测的灵敏度只有 9%', '因为先验概率本身就正好是 9%', '因为它的误报率高达 90% 之多']),
      },
    ],
  },

  // ── 交叉熵 · 困惑度 ──
  {
    id: 'xent', title: '交叉熵·困惑度', kernel: xentKernel as Kernel<unknown>,
    doc: trivialDoc('xent'),
    facts: [
      {
        id: 'ppUniform', label: '瞎猜(均匀分布)时的困惑度=词表大小 V', kind: 'number',
        ask: '词表大小 V=8，如果模型完全瞎猜(均匀分布)，困惑度会是多少?',
        compute: t => { const f = last(t); return { answer: String(f.ppUniform), step: t.length - 1, evidence: `瞎猜困惑度=词表大小 V=${f.ppUniform}` } },
        distractors: numDistractors,
      },
      {
        id: 'ce', label: '整句预测完的平均交叉熵(训练损失)', kind: 'number',
        ask: '逐词预测 "the cat sat on the mat" 完，整句的平均交叉熵(bit/词)是多少?',
        compute: t => { const f = last(t); return { answer: String(f.ce), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'perplexity', label: '整句的困惑度 2^交叉熵', kind: 'number',
        ask: '这句话预测完后的困惑度(=2^平均交叉熵)约是多少?',
        compute: t => { const f = last(t); return { answer: String(f.perplexity), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'hardest', label: '模型最没把握(惊讶度最高)的词', kind: 'choice',
        ask: '整句里模型最没把握、惊讶度最高的是哪个词?',
        compute: t => {
          const words = t.filter(f => Number(f.trueIdx) >= 0)
          const f = words.reduce((a, b) => (Number(b.surprise) > Number(a.surprise) ? b : a))
          return { answer: String(f.trueWord), step: t.indexOf(f), evidence: `该词模型只给 ${(Number(f.pTrue) * 100).toFixed(0)}%，惊讶度 ${f.surprise} bit` }
        },
        distractors: (a, t) => {
          const uniq = [...new Set(t.filter(f => Number(f.trueIdx) >= 0).map(f => String(f.trueWord)))]
          return uniq.filter(x => x !== a).slice(0, 3)
        },
      },
    ],
  },

  // ── 中心极限定理 ──
  {
    id: 'clt', title: '中心极限定理', kernel: cltKernel as Kernel<unknown>,
    doc: trivialDoc('clt'),
    facts: [
      {
        id: 'trials', label: '每个 m 跑多少次独立试验 T', kind: 'number',
        ask: '这个中心极限定理实验里，每个「平均样本数 m」都跑多少次独立试验?',
        compute: t => { const f = last(t); return { answer: String(f.trials), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'maxm', label: '平均样本数 m 最大取到多少', kind: 'number',
        ask: '实验中把「每次平均多少个样本」m 逐步增大，最大取到了多少?',
        compute: t => { const f = last(t); return { answer: String(f.m), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'shape', label: '随 m 增大均值分布形状怎么变', kind: 'choice',
        ask: '原始是最不像高斯的均匀分布，随平均样本数 m 增大，样本均值的分布形状怎么变?',
        compute: t => {
          const runs = t.filter(f => f.phase === 'run').sort((a, b) => Number(a.m) - Number(b.m))
          const first = runs[0], lastf = runs[runs.length - 1]
          const answer = Number(lastf.exKurt) > Number(first.exKurt)
            ? `从平顶（峰度≈${first.exKurt}）趋向钟形`
            : `峰度基本不变`
          return { answer, step: t.indexOf(lastf), evidence: `m=${first.m} 超额峰度 ${first.exKurt} → m=${lastf.m} 超额峰度 ${lastf.exKurt}` }
        },
        distractors: a => pick3(a, [a, '从钟形（峰度≈0）摊平成平顶', '峰度恒为 -1.205，形状一直不变', '峰度冲向 +∞，分布越来越尖']),
      },
    ],
  },

  // ── 大数定理 ──
  {
    id: 'lln', title: '大数定理', kernel: llnKernel as Kernel<unknown>,
    doc: trivialDoc('lln'),
    facts: [
      {
        id: 'maxn', label: '撒点数 n 最大取到多少', kind: 'number',
        ask: '用蒙特卡洛估 π，把撒点数 n 逐步增大，最大撒到了多少个点?',
        compute: t => { const f = last(t); return { answer: String(f.n), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'trials', label: '每个 n 的独立试验次数 T', kind: 'number',
        ask: '为了体现 1/√n，每个撒点数 n 都跑多少次独立试验?',
        compute: t => { const f = last(t); return { answer: String(f.trials), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'errsqrtn', label: '末步的 RMS误差×√n(体现∝1/√n)', kind: 'number',
        ask: '把「误差 ∝ 1/√n」钉死的量——最大 n 时的 RMS误差×√n 约是多少?',
        compute: t => { const f = last(t); return { answer: String(f.rmsErrSqrtN), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'errtrend', label: '随 n 增大估计误差怎么变', kind: 'choice',
        ask: '随撒点数 n 增大，蒙特卡洛估 π 的 RMS 误差怎么变化?',
        compute: t => {
          const runs = t.filter(f => f.phase === 'run').sort((a, b) => Number(a.n) - Number(b.n))
          const first = runs[0], lastf = runs[runs.length - 1]
          const answer = Number(lastf.rmsError) < Number(first.rmsError)
            ? '越来越小，按 1/√n 缩'
            : '误差没有下降'
          return { answer, step: t.indexOf(lastf), evidence: `n=${first.n} 误差 ${first.rmsError} → n=${lastf.n} 误差 ${lastf.rmsError}` }
        },
        distractors: a => pick3(a, [a, '越来越大，样本越多越不准', '保持不变，与 n 无关', '按 1/n 缩得比 1/√n 快得多']),
      },
    ],
  },

  // ── JL 引理 · 随机投影 ──
  {
    id: 'jl', title: 'JL 引理·随机投影', kernel: jlKernel as Kernel<unknown>,
    doc: trivialDoc('jl'),
    facts: [
      {
        id: 'dim', label: '点的原始维度 D', kind: 'number',
        ask: '这些随机点在被随机投影降维之前，原始维度 D 是多少?',
        compute: t => { const f = last(t); return { answer: String(f.d), step: t.length - 1, evidence: `原始维度 D=${f.d}，点数 N=${f.n}` } },
        distractors: numDistractors,
      },
      {
        id: 'pairs', label: '被检验距离的点对数', kind: 'number',
        ask: '6 个点两两配对，一共要检验多少对点的距离保持情况?',
        compute: t => { const f = last(t); return { answer: String((f.ratios as number[]).length), step: t.length - 1, evidence: `N=${f.n} 个点、C(N,2) 对` } },
        distractors: numDistractors,
      },
      {
        id: 'dev128', label: '投到 128 维时的最大距离偏差(%)', kind: 'number',
        ask: '把点投到最高的 K=128 维时，距离比相对 1 的最大偏差约是百分之几(取整)?',
        compute: t => { const f = last(t); return { answer: String(Math.round(Number(f.maxDev) * 100)), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'devtrend', label: '随投影维度 K 增大最大偏差怎么变', kind: 'choice',
        ask: '随着投影维度 K 从 16 增大到 128，距离的最大偏差怎么变化?',
        compute: t => {
          const runs = t.filter(f => f.phase === 'run').sort((a, b) => Number(a.k) - Number(b.k))
          const first = runs[0], lastf = runs[runs.length - 1]
          const answer = Number(lastf.maxDev) < Number(first.maxDev)
            ? '越来越小：K 越大距离保得越准'
            : '偏差没有随 K 下降'
          return { answer, step: t.indexOf(lastf), evidence: `K=${first.k} 偏差 ${(Number(first.maxDev) * 100).toFixed(0)}% → K=${lastf.k} 偏差 ${(Number(lastf.maxDev) * 100).toFixed(0)}%` }
        },
        distractors: a => pick3(a, [a, '越来越大：压得越狠反而越准是错觉', '与 K 无关、恒定不变', '所需 K 由原始维度 D 决定']),
      },
    ],
  },

  // ── 最大熵原理 ──
  {
    id: 'maxent', title: '最大熵原理', kernel: maxentKernel as Kernel<unknown>,
    /*  2026-09-09 补厚之后 trace 换了口径：轴不再是"μ 逐档收紧"，而是**在约束平面上爬熵的轮次**。
        老的三条题全靠 `t.find(x => x.mu === 3.5)` 找帧 —— 新 trace 里每一帧的 μ 都一样，
        三条全抛，这个实验一道原理题都出不出来（判据①当场红）。重写成考**新口径的那件事**。 */
    doc: { kind: 'maxent', params: { mode: '+ 期望点数 = μ', mu: 5, start: '均匀' }, entities: [], streams: [] },
    facts: [
      {
        id: 'famFound', label: '搜索不假设形式，最后停在指数族上', kind: 'choice', genre: 'concept',
        ask: '这一屏的搜索只做两件事：待在满足约束的平面上、往熵高的地方走 —— 它从不假设分布是什么形式。爬完之后，它跟指数族解 p∝e^{λi} 差多少？',
        compute: t => {
          const f = last(t)
          const g = Number(f.gap)
          return {
            answer: g < 1e-6
              ? '逐项差已掉到 0，两者完全重合 —— 是搜出来的结果'
              : `还差 ${g}，没有重合`,
            step: t.indexOf(f), evidence: `gap=${g}，约束残差=${f.feasErr}`,
          }
        },
        distractors: a => pick3(a, [
          '差得很远，熵最大的分布其实是均匀分布，跟指数族没有关系',
          '差一个常数倍，指数族只是最大熵解的一种近似写法而已',
          '一开始就重合，因为搜索的每一步都是按 e^{λi} 的形式算出来的',
        ]),
      },
      {
        id: 'freedomDim', label: '可行平面还剩几个自由方向', kind: 'choice', genre: 'concept',
        ask: '6 个面（6 个未知数），加上"概率加起来=1"和"期望点数=μ"两条线性约束。可行平面上还剩几个自由方向，为什么？',
        compute: t => {
          const f = last(t)
          return {
            answer: `${f.freedom} 个 —— 6 个未知数减掉 2 条线性无关的约束，剩下能走的维数`,
            step: t.indexOf(f), evidence: `freedom=${f.freedom}，约束=${f.conText}`,
          }
        },
        distractors: a => pick3(a, [
          '6 个 —— 每一面的概率都还可以自由调整，约束只影响最后的取值范围',
          '1 个 —— 只要定下 λ 这一个参数，整条指数族曲线就唯一确定了',
          '0 个 —— 两条约束已经把 6 个未知数全部解死，没有任何余地',
        ]),
      },
      {
        id: 'entCost', label: '熵从上限掉下去的那一段是什么', kind: 'choice', genre: 'concept',
        ask: '没有约束时 6 面骰的熵是 log₂6≈2.585 bit。加上"期望点数=μ"之后熵掉了下来 —— 掉下去的那一段代表什么？',
        compute: t => {
          const f = last(t)
          const drop = +(Number(f.maxEnt) - Number(f.ent)).toFixed(3)
          return {
            answer: `掉了 ${drop} bit，正是这条约束所携带的信息量`,
            step: t.indexOf(f), evidence: `熵 ${f.ent} / 上限 ${f.maxEnt}`,
          }
        },
        distractors: a => pick3(a, [
          '掉下去的部分是数值误差，理论上加约束不该让熵变小才对',
          '代表这个分布比均匀分布更不可信，掉得越多说明假设越武断',
          '代表还没搜到最优解，继续多爬几轮熵还会回到 2.585 附近',
        ]),
      },
      {
        id: 'randCross', label: '随机撒点这条交叉验证在验什么', kind: 'choice', genre: 'concept',
        ask: '屏幕上还印着"在同一张可行平面上随机撒 N 个分布，撞到的最高熵"。这个数拿来干什么？',
        compute: t => {
          const f = last(t)
          const rb = Number(f.randBest), e = Number(f.ent)
          return {
            answer: `随机撞到的最高熵低于爬到的那一个 —— 换个来源确认已到顶`,
            step: t.indexOf(f), evidence: `randBest=${rb}，randN=${f.randN}，爬到 ${e}`,
          }
        },
        distractors: a => pick3(a, [
          '用随机采样代替爬山来求解，比坐标上升更快也更不容易陷进局部极值',
          '用来估计可行集有多大，撞到的分布越多说明约束越松、信息越少',
          '用来给爬山提供起点，撒到的最高熵那一个就是下一轮开始搜索的地方',
        ]),
      },
      {
        id: 'entFinal', label: '爬完之后的熵', kind: 'number',
        ask: '约束"期望点数=5"下，爬熵爬到最后的熵是多少 bit？',
        compute: t => { const f = last(t); return { answer: String(f.ent), step: t.indexOf(f), evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
    ],
  },
]
