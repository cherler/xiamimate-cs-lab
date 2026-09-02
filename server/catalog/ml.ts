// AI 学伴出题目录 · 机器学习基础 / 机器学习算法分片（13 个实验）
// 矩阵乘 matmul / 张量布局 layout / 条件数 condnum / 梯度下降 graddesc / 残差 residual /
// 低秩·LoRA lowrank / softmax / 线性回归 linreg / 逻辑回归 logreg / PageRank pagerank /
// Q-learning qlearn / 推荐系统 recsys / 支持向量机 svm。
//
// 焊死纪律：每个 fact 的 number 答案都由 compute(trace) 从内核真实 trace 现算，
// choice 概念答案配上真轨迹里的 log 做证据。doc 与 web/src/registry.ts 的 defaultDoc 同源
// （空参数用 trivialDoc、带参数的 layout/softmax 逐字抄 params）。

import { matmulKernel } from '../../src/kernels/matmul.ts'
import { layoutKernel } from '../../src/kernels/layout.ts'
import { condnumKernel } from '../../src/kernels/condnum.ts'
import { graddescKernel } from '../../src/kernels/graddesc.ts'
import { residualKernel } from '../../src/kernels/residual.ts'
import { lowrankKernel } from '../../src/kernels/lowrank.ts'
import { softmaxKernel } from '../../src/kernels/softmax.ts'
import { linregKernel } from '../../src/kernels/linreg.ts'
import { logregKernel } from '../../src/kernels/logreg.ts'
import { pagerankKernel } from '../../src/kernels/pagerank.ts'
import { qlearnKernel } from '../../src/kernels/qlearn.ts'
import { recsysKernel } from '../../src/kernels/recsys.ts'
import { svmKernel } from '../../src/kernels/svm.ts'
import { trivialDoc, numDistractors, last, type CatalogEntry, type Kernel, type Frame } from '../catalog-shared.ts'

// 找 trace 里第一个满足条件的帧；找不到就退回末帧（保证 compute 不炸）。
const frameWhere = (t: Frame[], pred: (f: Frame) => boolean): Frame => t.find(pred) ?? last(t)

export const ML_ENTRIES: CatalogEntry[] = [
  // ── 矩阵乘法：一切神经网络的地基 ──
  {
    id: 'matmul', title: '矩阵乘法', kernel: matmulKernel as Kernel<unknown>,
    doc: trivialDoc('matmul'),
    facts: [
      {
        id: 'flops', label: '整次矩阵乘的浮点运算次数',
        ask: '2×3 的 A 乘 3×2 的 B，整个矩阵乘一共做多少次浮点运算（2·M·N·K）？',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: String(f.totalFlops), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'c00', label: '输出格 C[0][0] 的值',
        ask: 'C=A·B 里左上角 C[0][0]（A 第 0 行点 B 第 0 列）等于多少？',
        kind: 'number',
        compute: t => { const f = frameWhere(t, x => x.row === 0 && x.col === 0 && x.phase === 'cell'); return { answer: String(f.value), step: t.indexOf(f), evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'when_mul', label: '两个矩阵能相乘的条件',
        ask: 'A[M×K] 和 B[K×N] 什么时候才能相乘？',
        kind: 'choice',
        compute: t => { const f = frameWhere(t, x => x.phase === 'cell'); return { answer: 'A 的列数必须等于 B 的行数（内维 K 对上）；结果 C 是 M×N，每格 C[i][j]=A 第 i 行点 B 第 j 列', step: t.indexOf(f), evidence: String(f.log ?? '') } },
        distractors: () => ['两个矩阵形状必须完全相同（同为方阵）才能乘', 'A 的行数必须等于 B 的列数', '只要两个矩阵元素总个数相等，怎么摆都能乘'],
      },
    ],
  },

  // ── 张量布局：矩阵乘地基的另一半 ──
  {
    id: 'layout', title: '张量布局', kernel: layoutKernel as Kernel<unknown>,
    doc: { kind: 'layout', params: { layout: 'row-major' }, entities: [], streams: [] },
    facts: [
      {
        id: 'colstride', label: 'row-major 扫一列的地址步长',
        ask: '2×3 矩阵按 row-major 摊平进一维内存，顺着"同一列"走，相邻两个元素的地址差（步长）是多少？',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: String(f.colStride), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'addr4', label: '内存地址 4 存的矩阵元素值',
        ask: 'row-major 布局下，一维内存地址 4 存的是矩阵里哪个数？',
        kind: 'number',
        compute: t => { const f = frameWhere(t, x => (x.cur as { addr: number } | null)?.addr === 4); const cur = f.cur as { v: number }; return { answer: String(cur.v), step: t.indexOf(f), evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'why_rowfast', label: 'row-major 为什么扫行快扫列慢',
        ask: 'row-major 布局里，为什么"扫一行"快、"扫一列"慢？',
        kind: 'choice',
        compute: t => ({ answer: 'row-major 把同一行的元素连续存在一起：扫一行地址步长 1（顺着 cache 行、快），扫一列要跨行、步长等于列数（跳着访问、慢）。谁在内存里连续，谁的访问就快', step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: () => ['行比列短，扫行访问的元素更少所以快', 'CPU 对行有专门指令、对列没有', '扫列要先做一次转置，转置本身耗时'],
      },
    ],
  },

  // ── 条件数：为什么"病态"问题又慢又难算 ──
  {
    id: 'condnum', title: '条件数', kernel: condnumKernel as Kernel<unknown>,
    doc: trivialDoc('condnum'),
    facts: [
      {
        id: 'steps50', label: 'κ=50 时梯度下降收敛步数',
        ask: '把损失碗拉到条件数 κ=50（细长椭圆），同一套梯度下降收敛到千分之一要多少步？',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: String(f.steps), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'steps20', label: 'κ=20 时收敛步数',
        ask: '条件数 κ=20 时，梯度下降收敛到千分之一用了多少步？',
        kind: 'number',
        compute: t => { const f = frameWhere(t, x => x.kappa === 20); return { answer: String(f.steps), step: t.indexOf(f), evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'why_slow', label: '条件数越大为什么梯度下降越慢',
        ask: '条件数 κ 越大，同一套梯度下降为什么越慢越难算？',
        kind: 'choice',
        compute: t => ({ answer: 'κ 大时损失碗被拉成细长椭圆，梯度几乎垂直于"通往谷底"的方向，只能之字形慢慢挪；每步误差只缩一个因子 (κ−1)/(κ+1)，κ 越大越接近 1、几乎不降', step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: () => ['κ 大意味着数据量更大，单纯是要算的样本多', 'κ 大会让学习率自动变大、直接冲过谷底发散', 'κ 只影响精度不影响速度，慢是浮点误差累积'],
      },
    ],
  },

  // ── 梯度下降：模型到底怎么"学" ──
  {
    id: 'graddesc', title: '梯度下降', kernel: graddescKernel as Kernel<unknown>,
    doc: trivialDoc('graddesc'),
    facts: [
      {
        id: 'loss0', label: '起点 (4,4) 的损失',
        ask: '损失 L=x²+5y²，从 (4,4) 出发，第 0 步的损失是多少？',
        kind: 'number',
        compute: t => { const f = frameWhere(t, x => x.step === 0); return { answer: String(f.loss), step: t.indexOf(f), evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'gy0', label: '起点处 y 方向梯度',
        ask: '损失 L=x²+5y² 在起点 (4,4) 处，y 方向的梯度 ∂L/∂y 是多少？',
        kind: 'number',
        compute: t => { const f = frameWhere(t, x => x.step === 0); return { answer: String(f.gy), step: t.indexOf(f), evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'why_zigzag', label: 'y 方向为什么来回震荡',
        ask: '梯度下降过程中，y 坐标为什么会正负来回震荡？',
        kind: 'choice',
        compute: t => ({ answer: 'y 方向曲率更大（损失里 y² 的系数 5 比 x² 的 1 大），更陡；同一个学习率下 y 方向步子迈过头，于是在谷底两侧来回震荡——这是学习率与曲率（条件数）的博弈', step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: () => ['因为梯度算错了正负号，走反了方向', '因为随机初始化，每一步都在随机抖动', '因为 x 方向也在震荡，两者叠加成拍频'],
      },
    ],
  },

  // ── 残差=梯度高速路：为什么深网络能训得动 ──
  {
    id: 'residual', title: '残差=梯度高速路', kernel: residualKernel as Kernel<unknown>,
    doc: trivialDoc('residual'),
    facts: [
      {
        id: 'depth', label: '梯度倒传要穿过的层数',
        ask: '这个实验里，梯度从输出往输入倒着传，一共要穿过多少层？',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: String(f.depth), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'vanish_step', label: '没残差梯度跌破 0.1 的步',
        ask: '没有残差时（每层 ×0.8），梯度倒传到第几步首次跌破 0.1、开始"梯度消失"？',
        kind: 'number',
        compute: t => { const f = frameWhere(t, x => x.phase === 'run' && Number(x.gradPlain) < 0.1); return { answer: String(f.step), step: t.indexOf(f), evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'why_res', label: '残差为什么能治梯度消失',
        ask: '残差连接 y=x+f(x) 凭什么让几十上百层的深网络也训得动？',
        kind: 'choice',
        compute: t => ({ answer: "残差让这一层的导数从 f'(x) 变成 1+f'(x)，那个 +1 是一条恒等高速路：梯度即使 f'(x) 很小也能原样穿过，链式连乘不再指数衰减到 0——把连乘衰减变成连加穿过", step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: () => ['残差把每层的梯度都放大 2 倍，抵消掉衰减', '残差跳过了一半的层，连乘次数直接减半', '残差用更大的学习率把消失的梯度补回来'],
      },
    ],
  },

  // ── 低秩近似·LoRA：为什么"低秩"能省参数还不太掉精度 ──
  {
    id: 'lowrank', title: '低秩近似·LoRA', kernel: lowrankKernel as Kernel<unknown>,
    doc: trivialDoc('lowrank'),
    facts: [
      {
        id: 'params_k2', label: '秩 k=2 低秩表示的参数个数',
        ask: '一个 8×8 矩阵做低秩近似，只保留秩 k=2 时，需要多少个参数（2·d·k）？',
        kind: 'number',
        compute: t => { const f = frameWhere(t, x => x.rank === 2); return { answer: String(f.lowrankParams), step: t.indexOf(f), evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'rank_zero_err', label: '重建误差归零所需的秩',
        ask: '把保留的秩 k 一步步提高，提到多少时重建误差归零、完全还原原矩阵？',
        kind: 'number',
        compute: t => { const f = frameWhere(t, x => x.phase === 'run' && Number(x.error) === 0); return { answer: String(f.rank), step: t.indexOf(f), evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'why_lowrank', label: '低秩为什么能省参数还不太掉精度',
        ask: '为什么只留前 2 个奇异分量就能保住约 98% 的能量，低秩近似才省得下参数？',
        kind: 'choice',
        compute: t => ({ answer: '矩阵的信息集中在前几个大奇异值上，丢掉的小奇异值贡献的能量很少；留前 k 个就用 2·d·k 个数逼近原来的 d² 个数（Eckart–Young 保证这是最优的秩-k 近似）。LoRA 就是给权重加一个低秩更新、只训 2·d·r 个参数', step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: () => ['因为矩阵本来就只有 2 行有效、其余全是 0', '因为奇异值彼此相等，留几个结果都一样', '因为低秩会自动过滤掉噪声，精度反而更高'],
      },
    ],
  },

  // ── softmax 与温度：logits → 概率 ──
  {
    id: 'softmax', title: 'softmax 与温度', kernel: softmaxKernel as Kernel<unknown>,
    doc: { kind: 'softmax', params: { temperature: 1, logits: '天气续写' }, entities: [], streams: [] },
    facts: [
      {
        id: 'topprob', label: '温度 T=1 时最高概率的百分比',
        ask: '温度 T=1，对"天气续写"这串 logits 做 softmax，概率最高的那个字占百分之多少？',
        kind: 'number',
        compute: t => { const f = frameWhere(t, x => x.phase === 'norm'); const probs = f.probs as number[]; const pct = Math.round(Math.max(...probs) * 100); return { answer: String(pct), step: t.indexOf(f), evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'norm_step', label: 'softmax 归一化这一步做什么',
        ask: 'softmax 里的"归一化"这一步，具体对每个 exp 值做了什么？',
        kind: 'choice',
        compute: t => { const f = frameWhere(t, x => x.phase === 'norm'); return { answer: '把每个 exp 值除以所有 exp 的总和，让结果都落在 (0,1) 且加起来正好等于 1，成为一个概率分布', step: t.indexOf(f), evidence: String(f.log ?? '') } },
        distractors: () => ['直接取 logit 最大的那个置 1、其余置 0', '给每个 logit 减去平均值，让它们零均值', '把每个 logit 平方后再相加'],
      },
      {
        id: 'temp_up', label: '调高温度分布怎么变',
        ask: '把温度 T 从 1 调大，softmax 出来的概率分布会怎么变？',
        kind: 'choice',
        compute: t => ({ answer: '分布被压平、更均匀，采样更随机、更有创造性（熵变大）；T 调小则分布变尖、越接近只选概率最大的那个（贪心）', step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: () => ['分布变得更尖，越接近只选概率最大的那个字', '概率分布完全不变，温度只影响运行速度', '只有最大项的概率变大，其余不变'],
      },
    ],
  },

  // ── 线性回归：机器怎么"拟合"一条线 ──
  {
    id: 'linreg', title: '线性回归', kernel: linregKernel as Kernel<unknown>,
    doc: trivialDoc('linreg'),
    facts: [
      {
        id: 'gdsteps', label: '收敛到最优用的梯度下降步数',
        ask: '这条回归直线跑了多少步梯度下降，收敛到最小二乘最优解？',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: String(f.gdStep), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'final_mse', label: '收敛后的均方误差 MSE',
        ask: '梯度下降收敛后，这条直线的均方误差 MSE 大约降到多少？',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: String(f.mse), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: (a, t) => { const start = Number(frameWhere(t, x => x.phase === 'run').mse); const av = Number(a); return [String(start), String(+(av + 0.5).toFixed(2)), String(+(av + 1.2).toFixed(2))].filter(x => x !== a) },
      },
      {
        id: 'converge_to', label: '梯度下降收敛到的解',
        ask: '梯度下降把这条回归线一步步调到最后，收敛到的其实是什么解？',
        kind: 'choice',
        compute: t => ({ answer: '最小二乘（OLS）闭式解——梯度下降迭代找到的直线，和用公式一次性算出的数学最优线是同一条', step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: () => ['穿过全部散点的插值曲线', '一条随机但看起来还凑合的线', '让所有残差绝对值中位数最小的线'],
      },
    ],
  },

  // ── 逻辑回归：把"拟合直线"改造成"分两类" ──
  {
    id: 'logreg', title: '逻辑回归', kernel: logregKernel as Kernel<unknown>,
    doc: trivialDoc('logreg'),
    facts: [
      {
        id: 'final_acc', label: '收敛后的分类准确率(%)',
        ask: '逻辑回归梯度下降 60 步后，对这两类点的分类准确率达到多少 %？',
        kind: 'number',
        compute: t => { const f = last(t); const pct = Math.round(Number(f.acc) * 100); return { answer: String(pct), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: (a, t) => { const start = Math.round(Number(frameWhere(t, x => x.phase === 'run').acc) * 100); return [String(start), '83', '94'].filter(x => x !== a) },
      },
      {
        id: 'final_loss', label: '收敛后的交叉熵损失',
        ask: '逻辑回归训练到收敛，交叉熵（对数）损失大约降到多少？',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: String(f.loss), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: (a, t) => { const start = Number(frameWhere(t, x => x.phase === 'run').loss); const av = Number(a); return [String(start), String(+(av + 0.2).toFixed(2)), String(+(av + 0.4).toFixed(2))].filter(x => x !== a) },
      },
      {
        id: 'sigmoid', label: '逻辑回归用什么把打分变概率',
        ask: '逻辑回归先算线性打分 z=w₁x+w₂y+b，再用什么函数把 z 压成"属于第 1 类的概率"？',
        kind: 'choice',
        compute: t => ({ answer: 'sigmoid 函数 σ(z)=1/(1+e⁻ᶻ)，把任意实数 z 压到 (0,1) 当概率；损失换成交叉熵。它本质就是单个神经元 + sigmoid', step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: () => ['ReLU：把负的截成 0、正的原样输出', 'softmax：一次给三类以上归一化', 'tanh：把 z 压到 (−1,1) 之间'],
      },
    ],
  },

  // ── PageRank：重要性顺着链接流动 ──
  {
    id: 'pagerank', title: 'PageRank 网页排名', kernel: pagerankKernel as Kernel<unknown>,
    doc: trivialDoc('pagerank'),
    facts: [
      {
        id: 'top_page', label: '收敛后 PageRank 最高的网页',
        ask: 'A/B/C/D 四个网页互相链接，幂迭代收敛后哪个网页的 PageRank 最高？',
        kind: 'choice',
        compute: t => { const f = last(t); const ranked = f.ranked as { name: string; r: number }[]; return { answer: ranked[0].name, step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: (a, t) => { const ranked = last(t).ranked as { name: string; r: number }[]; return ranked.map(x => x.name).filter(n => n !== a).slice(0, 3) },
      },
      {
        id: 'iters', label: '幂迭代收敛的轮数',
        ask: 'PageRank 用幂迭代反复分配重要性，一共迭代了多少轮到收敛？',
        kind: 'number',
        compute: t => { const f = last(t); return { answer: String(f.iter), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'top_rank', label: '最高网页的 PageRank 收敛值',
        ask: '收敛后，PageRank 最高的那个网页的 rank 值是多少？',
        kind: 'number',
        compute: t => { const f = last(t); const ranked = f.ranked as { name: string; r: number }[]; return { answer: String(ranked[0].r), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: (a, t) => { const ranked = last(t).ranked as { name: string; r: number }[]; return ranked.slice(1).map(x => String(x.r)).filter(x => x !== a).slice(0, 3) },
      },
      {
        id: 'core_idea', label: 'PageRank 的核心思想',
        ask: 'PageRank 判断一个网页重不重要，靠的是什么？',
        kind: 'choice',
        compute: t => { const f = frameWhere(t, x => x.iter === 0 && x.phase === 'run'); return { answer: '重要性顺着链接流动：一个页面的重要性取决于有多少、以及多重要的页面链接到它（重要页面的投票更值钱）；数学上是幂迭代，等价于图上随机游走的稳态分布', step: t.indexOf(f), evidence: String(f.log ?? '') } },
        distractors: () => ['按网页正文字数多少排，越长越重要', '按网页最后更新时间排，越新越重要', '按域名注册得越早排得越高'],
      },
    ],
  },

  // ── 强化学习 Q-learning：把未来总回报倒推回每一步 ──
  {
    id: 'qlearn', title: '强化学习 Q-learning', kernel: qlearnKernel as Kernel<unknown>,
    doc: trivialDoc('qlearn'),
    facts: [
      {
        id: 'path_len', label: '最优路径的步数',
        ask: '学好价值后，从起点跟着策略箭头走到终点，一共要走几步？',
        kind: 'number',
        compute: t => { const f = last(t); const path = f.path as string[]; return { answer: String(path.length - 1), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'start_value', label: '起点格子的价值',
        ask: '折扣 γ=0.9、只有终点 +1。学好后，起点 (0,2) 这个格子的价值是多少？',
        kind: 'number',
        compute: t => { const f = last(t); const [sc, sr] = f.start as [number, number]; const w = f.w as number; const value = f.value as (number | null)[]; return { answer: String(value[sc + sr * w]), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: (a, t) => { const vals = (last(t).value as (number | null)[]).filter((v): v is number => v !== null).map(String); return [...new Set(vals)].filter(x => x !== a).slice(0, 3) },
      },
      {
        id: 'delayed_reward', label: '怎么应对延迟奖励',
        ask: '走迷宫只有终点才 +1、中间每步都没反馈，Q-learning 靠什么学出该往哪走？',
        kind: 'choice',
        compute: t => ({ answer: '用 Bellman 规则给每个格子估一个价值 = 即时奖励 + γ×下一格价值，于是终点的 +1 顺着规则从终点一圈圈倒推开（每远一步打 γ 折）；学好后站在任一格往价值最高的邻居走就是最优策略，全程不需要提前知道地图', step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: () => ['给中间每一步都人工设计一个小奖励来引导', '提前把整张地图和最优路线告诉智能体', '随机乱走，记住哪一次最快到终点就照抄那条'],
      },
    ],
  },

  // ── 推荐系统·矩阵分解：评分=用户隐向量·物品隐向量 ──
  {
    id: 'recsys', title: '推荐系统 · 矩阵分解', kernel: recsysKernel as Kernel<unknown>,
    doc: trivialDoc('recsys'),
    facts: [
      {
        id: 'predict', label: '预测小明对盗梦空间的评分',
        ask: '小明隐向量 (1,0)、盗梦空间隐向量 (4,3)，矩阵分解用内积预测小明会给盗梦空间打几分？',
        kind: 'number',
        compute: t => { const f = last(t); const rating = f.rating as (number | null)[][]; return { answer: String(rating[0][2]), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'nomatch', label: '小明对小森林的预测评分',
        ask: '小明 (1,0) 只爱动作、小森林隐向量 (0,5) 纯文艺，内积预测小明给小森林打几分？',
        kind: 'number',
        compute: t => { const f = last(t); const rating = f.rating as (number | null)[][]; return { answer: String(rating[0][1]), step: t.length - 1, evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'how_fill', label: '矩阵分解怎么补全空缺',
        ask: '评分表大半是空的（没看过），矩阵分解怎么把空缺补出来？',
        kind: 'choice',
        compute: t => ({ answer: '给每个用户、每个物品各学一个隐向量，让"评分 ≈ 两个隐向量的内积"；用已知评分把隐向量学出来，空缺处再用内积一算就是预测评分——口味和属性对得上（内积大）就推荐', step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: () => ['直接用这部电影所有人打分的平均值填', '随机猜一个 1~5 的分数填进去', '找口味最像的一个用户，把他的评分复制过来'],
      },
    ],
  },

  // ── 支持向量机 SVM：找最宽的那条街 ──
  {
    id: 'svm', title: '支持向量机 SVM', kernel: svmKernel as Kernel<unknown>,
    doc: trivialDoc('svm'),
    facts: [
      {
        id: 'margin', label: 'SVM 最大间隔(单侧)宽度',
        ask: 'SVM 在两类之间找"最宽的街"，这条最大间隔线单侧留出的间隔是多少？',
        kind: 'number',
        compute: t => { const f = frameWhere(t, x => x.phase === 'svm'); return { answer: String(f.margin), step: t.indexOf(f), evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'sv_count', label: '支持向量的个数',
        ask: '这条最大间隔的"街"由几个紧贴街边的点（支持向量）定住？',
        kind: 'number',
        compute: t => { const f = frameWhere(t, x => x.phase === 'svm'); const sv = f.supportVectors as number[]; return { answer: String(sv.length), step: t.indexOf(f), evidence: String(f.log ?? '') } },
        distractors: numDistractors,
      },
      {
        id: 'vs_naive', label: 'SVM 相比随便一条线多要求什么',
        ask: '同样能分开两类，SVM 比"随便找一条能分开的线"多要求什么？',
        kind: 'choice',
        compute: t => { const f = frameWhere(t, x => x.phase === 'svm'); return { answer: '要求间隔最大——让决策边界离两类都尽量远（"街"最宽）；边界离两边都最远，对新数据容错最大、泛化最好，而且这条街只由少数几个支持向量决定', step: t.indexOf(f), evidence: String(f.log ?? '') } },
        distractors: () => ['要求训练得更快、迭代更少', '要求用到的参数更少、更省内存', '要求决策边界紧贴其中一类、离另一类更远'],
      },
    ],
  },
]
