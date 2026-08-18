/**
 * 实验单：**这个实验是什么、要我做什么、为什么要做。**
 *
 * ## 为什么要有这一层
 *
 * 用户原话：「实验是什么？我还是不知道。不知道要做什么？为什么要做？」——
 * 说这话的是个计算机研究生。讲解浮层已经能回答"屏幕上这块是什么"，
 * 但那是**站在实验里面**的解释；站在外面的人缺的是另外三个答案：
 * 我为什么该在乎、我该动手做什么、做完算得出什么结论。
 *
 * ## 四段
 *
 *   ① 为什么在乎   不懂这个东西，会在哪儿吃亏
 *   ② 先猜一下     动手之前先押一个 —— 押过的人才会在意结果
 *   ③ 动手        两三条**具体动作**，不是"随便玩玩"
 *   ④ 结论        **从当前轨迹现算**，不是一句写死的话
 *
 * ④ 是这一层的立身之本，理由和整个仓库一样（`docs/standards.md`）：
 * 屏幕上每个数都从验过的内核轨迹派生。写死一句"相联度越高命中率越高"，
 * 学生换一串地址就会发现它是假的 —— 而那句话正好印在一个保证正确的仿真旁边，
 * 那是最坏的位置。所以结论**必须**是拿他此刻的配置重跑出来的。
 *
 * ## 猜测记在本机，不进同步
 *
 * 进度（错题本、已掌握）走后端同步，是因为那是**学习成果**；
 * "我当时猜的是哪个"是一次性的心理锚，跨设备搬过去没有意义，
 * 而且会把 `sync.ts` 里那套已经验过的合并规则搅浑。放 localStorage。
 */
import type { TryStep } from './guide.ts'

/** 结论要重算，就得能拿到"跑一遍任意配置"的能力 —— App 里的 `runDoc` 正是它 */
export type VerdictCtx = {
  doc: { params: Record<string, unknown>; [k: string]: unknown }
  trace: unknown[]
  runDoc: (d: unknown) => unknown[]
}

export type Verdict = {
  /** ② 的哪个选项是对的（下标）。-1 = 这次算不出对错，只给数 */
  pick: number
  /** 一句话结论，**里面的数都是现算的** */
  say: string
  /** 再补一句"为什么是这样"，同样从数据推出来 */
  why: string
}

export type Brief = {
  /** ① 为什么在乎 */
  care: string
  /** ② 先猜一下 */
  guess: { q: string; opts: string[] }
  /** ③ 动手 —— 和导览共用 TryStep，param/preset 会被冒烟拿去核对页面上真有 */
  tasks: TryStep[]
  /** ④ 结论。返回 null = 现在还算不出来（配置不合法、轨迹为空） */
  verdict: (ctx: VerdictCtx) => Verdict | null
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`

/**
 * Cache **整串跑完**的命中率：末态的 hits / (i+1)。轨迹为空返回 null。
 *
 * ⚠️ 这和右边读数栏里的「命中率」不是同一个数 —— 那个是**滚动值**，
 * 只算到你此刻停的那一步。两个数摆在同一屏上，不写清楚就会打架，
 * 所以结论里的说法一律带"整串跑完"。
 */
function hitRate(trace: unknown[]): number | null {
  const s = trace[trace.length - 1] as { hits?: number; i?: number } | undefined
  if (!s || typeof s.hits !== 'number' || typeof s.i !== 'number') return null
  return s.hits / (s.i + 1)
}

export const BRIEFS: Record<string, Brief> = {
  cache: {
    care:
      'CPU 要一个数，要么在 Cache 里就找到了（命中），要么得去主存搬一趟（缺失）。'
      + '这两条路的时间差得很远 —— 所以**同样一段程序、同样多的指令**，命中率不同，跑出来的快慢就不同。'
      + '而命中率不是由 Cache 多大一个数决定的：块多大、几路组相联、你的地址是按什么顺序来的，都在里面。'
      + '这一屏把每一次访问摊开，让你看见"接住了没有"以及为什么。',
    guess: {
      q: '把「相联度」降到 1 路（直接映射），你现在这串地址的命中率会怎样？',
      opts: ['变高', '不变', '变低'],
    },
    tasks: [
      {
        act: '先把「相联度」拧到 1，再拧回去',
        watch: '读数里的「命中率」是不是真的变了 —— 变没变、变多少，先记住这个数',
        param: '相联度',
      },
      {
        act: '换成「同组冲突」这串地址，再把相联度在 1 和 4 之间来回拧',
        watch: '这串地址的三个块组号相同：1 路时它们互相挤，4 路时挤不动了',
        preset: '同组冲突',
      },
      {
        act: '换成「容量不足」这串地址，再拧一次相联度',
        watch: '这次相联度救不了 —— 装不下就是装不下，只有加大「Cache 容量」有用',
        preset: '容量不足',
      },
    ],
    verdict: ({ doc, trace, runDoc }) => {
      const cur = hitRate(trace)
      if (cur === null) return null
      const a = Number(doc.params.associativity) || 1
      const at = (n: number) =>
        hitRate(runDoc({ ...doc, params: { ...doc.params, associativity: n } }))
      /*
       * 已经是 1 路时没法"再降"，那就换个方向问同一件事：升到 2 路会怎样。
       * 反过来读一遍结论，对错判定跟着翻 —— 不能因为起点不同就答非所问。
       */
      const down = a > 1
      const other = at(down ? 1 : 2)
      const full = at(8)
      if (other === null || full === null) return null

      const pick = other > cur ? 0 : other === cur ? 1 : 2
      const say = down
        ? `这串地址整串跑完：${a} 路的命中率是 ${pct(cur)}，降到 1 路（直接映射）是 ${pct(other)}`
          + ` —— 所以「${['变高', '不变', '变低'][pick]}」。`
        : `这串地址整串跑完：1 路（你现在就在这儿）的命中率是 ${pct(cur)}，升到 2 路是 ${pct(other)}。`
                  + `（题面问的是"降到 1 路"，你已经在那儿了，所以反过来读：升上去${other > cur ? '有用' : '也没用'}。）`
      /*
       * 为什么是这样 —— 也现算，不写死。
       * 拿 8 路（这一屏能给的最高）当参照：还能再涨，说明剩的缺失里有**冲突缺失**，
       * 是相联度救得了的；涨不动，说明缺的不是"路数"，加相联度白搭。
       */
      const why = full > cur
        ? `再往上拧到 8 路，整串命中率还能到 ${pct(full)} —— 说明你这串地址里还剩着**冲突缺失**：`
          + '几个块抢同一个组，路数不够就互相挤掉。这种缺失，提高相联度救得了。'
        : `拧到 8 路，整串命中率仍然是 ${pct(full)}，一点没涨 —— 说明剩下的缺失**不是路数的问题**：`
          + '要么是第一次访问必然的强制缺失，要么是要用的块本来就比 Cache 装得下的多。'
          + '这两种，加相联度都白搭。'
      return { pick, say, why }
    },
  },
}

export const briefFor = (id: string): Brief | undefined => BRIEFS[id]
