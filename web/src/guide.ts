/**
 * 讲解层：这一屏是什么、名词什么意思、先拧什么看什么。
 *
 * ## 为什么是静态文本，不是运行时接一个 AI 智能体
 *
 * 三条理由，都来自这个仓自己的纪律：
 *
 * 1. **它会跟护城河打架。** 本仓的立身之本是「验证器」—— 屏幕上每一个数都从
 *    验过的内核轨迹派生（`docs/standards.md`）。一个大模型在旁边解释
 *    「本步推演缺失」，它**可能是错的**，而且错在一个保证正确的答案旁边。
 *    那是最坏的位置：学生分不清哪半边可信。
 *
 * 2. **成本地板。** 讲解框是**每个新手都会点**的东西 —— 恰恰是流量最大的那一块。
 *    把它接上按次计费的模型，等于给最不产生收入的动作装一个计价器。
 *
 * 3. **它答不出这一步。** 除非把整条轨迹喂进去 —— 而那份轨迹本来就是内核
 *    确定性算出来的。绕一圈，用不确定的东西复述确定的东西。
 *
 * 再加一条实用的：看不懂的人要的是**现在**就有解释，不是三秒的流式输出。
 *
 * ## AI 的位置在作者侧，不在运行时
 *
 * 跟 `scripts/ai-fill.ts` 一样：AI 可以帮着起草这些词条与导览，
 * 但**产出物是审过的静态文本**。跑起来的时候零成本、零延迟、永远对，
 * 单文件产物离线打开也在。
 *
 * ## 三层
 *
 *   TOUR    这个页面怎么用    —— 写一次，所有实验共用
 *   GUIDES  这一屏是什么      —— 每个实验一段：回答什么问题 / 哪块是什么 / 先拧什么
 *   TERMS   名词             —— 共享词表，跨实验复用，点一下就地展开
 *
 * ## 判据
 *
 * - `tests/guide-content.test.ts`：词条引用不许悬空、导览不许有空字段、字段完整性
 * - 冒烟第 13 组：**`try.param` / `try.preset` 写的名字必须真的在页面上** ——
 *   导览说"把相联度调到 1"或"换成「同组冲突」预置"，而页面上根本没有那个旋钮 /
 *   那个预置改过名，是最容易发生也最难发现的漂移：那句话读起来永远像对的。
 */

import type { SimDocument } from '@engine/core/document.ts'

export type Term = {
  id: string
  term: string
  /** 一两句话说清。**不写教科书定义，写"它在这一屏上是哪个东西"**。 */
  gloss: string
}

export type TryStep = {
  /** 动作：让学生做什么 */
  act: string
  /** 看什么：做完之后屏幕上哪里会变、变成什么样 */
  watch: string
  /**
   * 这一步动的是哪个参数（参数面板上的标签，写**前缀**即可）。
   * 冒烟会拿它去页面上核对 —— 导览提到一个不存在的旋钮，是最容易漂的地方。
   */
  param?: string
  /**
   * 这一步要装的预置（序列或实体表的预置按钮上的字，**逐字**写）。
   * 同上：预置改了名，导览里那句"换成「同组冲突」"读起来永远像对的。
   */
  preset?: string
}

export type Guide = {
  /** 这个实验回答什么问题 —— 一句话，看完知道要不要点进来 */
  question: string
  /**
   * 屏幕上每块是什么。`anchor` 是**这块东西在页面上的 CSS 选择器** ——
   * 悬浮卡拿它做两件事：讲到这一条时把那块高亮起来，以及反过来，
   * 用户点了页面上那块就跳到这一条。
   *
   * ⚠️ 选择器只保证在**默认页签**上匹配得到。讲别的页签上的东西时，
   * 锚到 `.tabs`（"去点那个页签"本身就是要说的话）。
   * 冒烟第 13 组逐个核对它们真的匹配得到元素 —— 舞台改了 class，这里会红。
   */
  read: { at: string; is: string; anchor?: string }[]
  /**
   * 「本步推演」 —— **拿当前状态现算的四段**，随着轴走而变。
   *
   * 段名固定，好让 30 个实验读起来是同一种东西：
   *   本步输入 → 判定规则 → 本步结果 → 对应画面。
   *
   * ## 它不住在讲解卡里
   *
   * 一开始写成讲解卡的一张，实测装不下：卡片钉在右下角只有 380×112，
   * 四段一百多字要五行，而任何屏上都腾不出五行还不压住读数
   * （1280×720 上讲解卡本来就压着读数下沿）。
   *
   * 它讲的是舞台上正在发生的事，就该贴着舞台放 —— 所以渲染在
   * 舞台与轴之间那条带子里（`shell/WhyBand.tsx`），一整列宽，四段一行摊开。
   * 讲解卡里只留一张短卡指着它。
   */
  step?: (s: never, doc: SimDocument) => WhyPart[]
  /**
   * 推演卡底下那条**结论横幅**上写什么（概念图上「⊗ 缺失 · 装入组 0」那一条）。
   *
   * 为什么不直接拿 `tone(s).label`：那只有"命中/缺失"两个字，
   * 而横幅的位置和分量要求它一句把这一步交代完 ——
   * "缺失"之后紧跟着的"装到哪儿去了"，正是读者下一眼要找的东西。
   * 不写就退回两个字（见 `WhyRail`），不是必填。
   */
  verdict?: (s: never, doc: SimDocument) => string
  /**
   * **基础**：动手之前先要认识的那几个词，进主干、排在问句后面。
   *
   * 用户原话：「我还想你把基础内容、说明内容尽可能塞进讲解卡呢」。
   * 这一层原来只活在实验单的 ①（要点开、押完注才往下走），
   * 而卡片是随时在屏幕上的 —— 名词该跟着它讲的那一屏一起在。
   *
   * 写法上跟别的卡一样：一张卡一件事。宁可两张短的，别写一张长的
   * （卡片高度封在版面里，长了就得滚，滚起来的字等于没写）。
   */
  basics?: { title: string; body: string }[]
  /** 先拧什么、看什么 */
  try: TryStep[]
  /** 这一屏会用到的名词 */
  terms: string[]
}

/**
 * 页面各区域 —— 与具体实验无关，写一次，**并进每个实验的卡片序列里**。
 *
 * 这一串就是"点哪儿都有说明"的骨架：轴、日志、读数、真题、边界…
 * 不管在哪个实验下点它们，都讲得出话来。
 *
 * `need` 是"这一块不是每个实验都有"：没有参数的实验（银行家、哈夫曼）
 * 渲染的是一段说明而不是 `.body.params`，没有序列的实验没有 `.seqin`。
 * **锚到一个不存在的元素，就是一张永远点不到、翻到也没反应的卡** ——
 * 冒烟第 13 组会当场把它报出来。
 */
export const TOUR: { at: string; is: string; anchor: string; need?: 'params' | 'sequence' | 'entities' }[] = [
  { at: '左边的目录', is: '30 个实验，按四门课分组。点一个就换一整屏。', anchor: '.nav' },
  { at: '上面的页签', is: '同一件事的几种看法 —— 换页签不会重跑，只是换个角度看同一条轨迹。', anchor: '.tabs' },
  { at: '中间的舞台', is: '这个算法此刻的样子。它永远只画"当前这一步"，往前往后都由下面那条轴决定。', anchor: '.stagewrap' },
  { at: '轴', is: '整条推演被切成一步一步。点任意一格跳到那一步；柱子高低是那一步的某个量，柱子上方写着量的是什么。', anchor: '.axis' },
  { at: '逐步日志', is: '每一步一句话，说清这一步发生了什么。点某一行也能跳过去。', anchor: '.card.log' },
  { at: '真题', is: '选一道，实验会自动切成题目的配置。答完能跳回轨迹里看为什么；答错的会进错题本。', anchor: '.card.prob' },
  { at: '参数', is: '改了立刻重跑整条轨迹 —— 不是改画面，是换一个题面重新算一遍。', anchor: '.body.params', need: 'params' },
  { at: '读数', is: '当前这一步的关键数字。它们全部从轨迹派生，不是另算的 —— 所以跟舞台上看到的必然一致。', anchor: '.card.readouts' },
  { at: '访问序列', is: '驱动这个实验的那串数据，可以直接改。半截的、不合法的输入不会喂给仿真，仿真停在上一次有效的地方。', anchor: '.seqin', need: 'sequence' },
  { at: '实体表', is: '题面数据（进程表 / 边表 / 资源矩阵…），可以改、可以加减行。改完立刻重算。', anchor: '.enttab', need: 'entities' },
  { at: '「边界」那一格', is: '这个仿真**没有**模拟什么 —— 免得你拿它当全部事实。', anchor: '.bounds' },
]

/**
 * 共享词表。**一个词只解释一次**，谁需要谁引用。
 *
 * 写法纪律：不抄教科书定义，写"它在这一屏上是哪个东西"。
 * 学生卡住的时候要的是"哦，是屏幕上那个"，不是一句更绕的定义。
 */
/**
 * ## 词条怎么写 —— 三条，2026-08-19 定
 *
 * 起因：用户（计算机专业毕业）看完「组相联」那条说"还是一脸懵"。原文是
 * 「把 Cache 分成若干「组」，一块内存只能进固定的那一组，但组内哪一「路」都行。」
 * 一句话里塞了**四个没解释过的词**（组 / 块 / 路 / "进"），而且是自顶向下的定义式 ——
 * 可读者此刻正盯着**一个具体地址**在找它去哪儿。
 *
 * 1. **先指屏幕上的这一个，再给名字。** 不要先定义概念。
 *    "看中间那张表：一行就是一个组" 比 "把 Cache 分成若干组" 好，
 *    因为前者读者能顺着眼睛找到，后者要求他先在脑子里建一个图。
 * 2. **一句话只引入一个新词。** 用没解释过的词解释词，等于没解释。
 *    引用别的词条时，那个词条必须也在这一屏的 `terms` 里 —— 有判据盯着（`guide-content.test.ts`）。
 * 3. **能被数据证伪的话不要写死。**
 *    「把相联度从 2 调到 1，命中率掉下来」曾经就印在这儿 ——
 *    而默认那串地址逐档量过是 **1 路 25.0%、2 路 25.0%，根本不变**。
 *    讲解卡就长在一个保证正确的仿真旁边，说一句用户一试就发现是假的话，
 *    整层的可信度当场归零。改成**让他去看那个数**。
 */
export const TERMS: Term[] = [
  // ── 计算机组成原理 ──
  { id: 'hit', term: '命中 / 缺失', gloss: '要的数据已经在 Cache 里叫命中，不在就是缺失，得从内存搬一块进来。轴上绿色是命中、红色是缺失。' },
  { id: 'setassoc', term: '组相联', gloss: '看右边那张表：**表头写着「组号 / 路 0 / 路 1 / 状态」，一行就是一个「组」，行里并排的每一格就是一条「路」**。地址中间那几位算出去哪一行 —— 行是定死的，进哪一格随便挑。相联度就是一行里有几格。' },
  { id: 'direct', term: '直接映射', gloss: '相联度 = 1，表里只剩「路 0」一列，每行一格。行号一算出来，位置就唯一了 —— 那一格被别人占着，就只能把它挤掉。' },
  { id: 'fullassoc', term: '全相联', gloss: '整张表只剩一行，哪一格都行。命中率最好，代价是每次要把**所有格子**的 tag 都比一遍 —— 硬件贵就贵在这儿。' },
  { id: 'tagidx', term: 'tag / index / offset', gloss: '一个地址切三段，**从右往左**读：最右边 `offset` 选这一块里的第几个字节；中间 `index` 选去哪一**组**；剩下左边那段是 `tag`，跟着块一起存进格子里 —— 下次拿它比一比，就知道格子里现在装的是不是你要的那一块。**tag 是编号不是地址**，所以屏幕上它不带 0x。' },
  { id: 'blockway', term: '内存块 / 组 / 路', gloss: '**内存块**：主存按"块大小"切成一块块，搬运以它为单位。**组**（set）：Cache 分成若干组，图上一行就是一组，`index` 算出该进哪一组、没得挑。**路**（way）：一组里并排的那几个格子，每格装一个内存块 —— "2 路"就是一组有两个格子，真机常见 4 路、8 路。' },
  { id: 'lru', term: 'LRU / FIFO', gloss: '组满了挤谁走。LRU 挤最久没被用的，FIFO 挤最早进来的。LRU 通常更好，但要记访问时间。' },
  { id: 'locality', term: '局部性', gloss: '刚用过的还会再用（时间局部性）、旁边的马上要用（空间局部性）。Cache 全靠这两条才有意义。' },
  { id: 'exp', term: '阶码', gloss: 'IEEE 754 里表示"小数点挪了几位"的那一段。存的是加过偏置的移码，不是原码。' },
  { id: 'mant', term: '尾数', gloss: '有效数字那一段。规格化之后整数位恒为 1，所以那个 1 不存，叫隐含位。' },
  { id: 'bias', term: '移码 / 偏置', gloss: '阶码存的是「真值 + 127」（单精度）。这样全 0 最小、全 1 最大，比大小可以直接按无符号比。' },
  { id: 'normal', term: '规格化', gloss: '把尾数挪成 1.xxx 的形式，阶码相应加减。加减法对阶之后也要重新规格化。' },
  { id: 'booth', term: 'Booth 算法', gloss: '看相邻两位的组合决定加、减还是只移位，一次处理一位但能直接算带符号数，不用先取绝对值。' },
  { id: 'complement', term: '补码', gloss: '正数补码就是它本身；负数补码 = 对应正数按位取反再加 1。用补码后，减法能变成加法（A−B = A+(−B)补），而且符号位可以跟数值位一起参与运算，硬件只需一个加法器。' },
  { id: 'overflow', term: '溢出', gloss: '运算结果超出了这个位数补码能表示的范围（8 位是 −128~127）。判法：进入符号位的进位 ⊕ 移出符号位的进位，不相等就溢出 —— 等价于"同号相加却得到异号"。溢出后机器数是错的。' },
  { id: 'restore', term: '加减交替法', gloss: '也叫不恢复余数法。余数为负时不退回去，下一步改成加法补偿 —— 省掉一次恢复操作。' },
  { id: 'pipeline', term: '流水线 / 段', gloss: '一条指令拆成取指、译码、执行、访存、写回五段，不同指令的不同段同时进行。理想情况下每周期出一条。' },
  { id: 'hazard', term: '数据冒险', gloss: '后一条指令要用的值，前一条还没写回去。只能等，或者用前递把值直接送过去。' },
  { id: 'forward', term: '前递（旁路）', gloss: '不等写回，把运算结果直接从上一段送到下一段的输入。能消掉大部分停顿。' },
  { id: 'page', term: '页 / 页框', gloss: '虚存把地址空间切成等大的「页」，物理内存切成同样大的「页框」。页表记的就是哪一页放在哪一框。' },
  { id: 'tlb', term: 'TLB', gloss: '页表项的小缓存。命中就省掉一次访存；不命中才去查页表，查完把结果塞回 TLB。' },
  { id: 'vaddr', term: '虚地址拆分', gloss: '低位是页内偏移（页多大就占几位），高位是页号。偏移原样搬到物理地址上，只有页号要查表翻译。' },

  // ── 操作系统 ──
  { id: 'pagefault', term: '缺页', gloss: '要访问的页不在内存里，得从磁盘调进来。物理块满了就要按置换算法挤走一页。' },
  { id: 'belady', term: 'Belady 异常', gloss: '物理块给多了，缺页反而更多。FIFO 会出现，LRU 和 OPT 不会 —— 这是它们的分水岭。' },
  { id: 'opt', term: 'OPT / CLOCK', gloss: 'OPT 挤"以后最久不用的"，需要预知未来，只能当理论上界。CLOCK 是 LRU 的近似：给每页一个使用位，转着圈找位是 0 的。' },
  { id: 'turnaround', term: '周转时间 / 带权', gloss: '周转 = 完成时刻 − 到达时刻。带权周转 = 周转 ÷ 服务时间，衡量"等得值不值"。' },
  { id: 'preempt', term: '抢占 / 时间片', gloss: '抢占是可以打断正在跑的进程。RR 按固定时间片轮着来，SRTF 一有更短的来了就抢。' },
  { id: 'seek', term: '寻道', gloss: '磁头从当前磁道移到目标磁道。寻道时间是磁盘访问的大头，所以调度算法就是在省磁头的路程。' },
  { id: 'scan', term: 'SCAN / LOOK / C-SCAN', gloss: 'SCAN 走到磁盘边界才掉头，LOOK 走到最远的请求就掉头，C-SCAN 到头之后直接回到另一端单向再来一遍。' },
  { id: 'safeseq', term: '安全序列', gloss: '存在一个进程排列，按这个顺序每个进程都能拿到它还差的资源、跑完、把资源还回来。找得到就是安全状态。' },
  { id: 'needmax', term: 'Max / Allocation / Need', gloss: 'Max 是进程声明的最大需求，Allocation 是已经给它的，Need = Max − Allocation 是它还差的。' },
  { id: 'deadlock', term: '死锁', gloss: '一组进程各自拿着一部分资源、又都在等别人手里的，谁也走不了。银行家算法是在事前避免进入这种状态。' },
  { id: 'fragment', term: '外碎片 / 内碎片', gloss: '外碎片是分区之间零散的小空闲，加起来够用但连不成一块。内碎片是分给你却用不上的那部分。' },
  { id: 'fitpolicy', term: '首次 / 最佳 / 最坏 / 邻近适应', gloss: '从头找第一个够大的 / 找最小的够大的 / 找最大的那块 / 从上次停的地方接着找。四种在同一串请求下会分到完全不同的地址。' },
  { id: 'inode', term: '混合索引', gloss: 'inode 里前几个指针直接指数据块，再往后是一级、二级、三级间址。小文件一次访问就到，大文件多绕几层。' },
  { id: 'semaphore', term: '信号量 / PV', gloss: 'P 是申请（减一，不够就阻塞），V 是释放（加一）。生产者消费者里 empty/full 数格子、mutex 保互斥。' },
  { id: 'pvorder', term: 'P 操作的顺序', gloss: '必须先 P 资源信号量（empty/full）再 P 互斥（mutex）。反过来会抱着锁去睡觉，直接死锁 —— 这个实验能让它真的死给你看。' },
  { id: 'bitmap', term: '位示图', gloss: '一位对应一个盘块，0 空闲 1 已用。分配就是找 0，回收就是置 0，关键是位号跟盘块号怎么换算。' },

  // ── 数据结构 ──
  { id: 'stable', term: '稳定性', gloss: '相等的元素排完之后相对次序有没有变。冒泡、插入、归并稳定；快排、堆、选择、希尔不稳定。' },
  { id: 'pass', term: '趟', gloss: '一轮完整的处理。冒泡每趟确定一个最大值，插入每趟把一个元素插进前面的有序段。' },
  { id: 'settled', term: '已定位 / 局部有序', gloss: '两回事：冒泡、选择、快排、堆每趟能**确定**某些元素的最终位置；插入、希尔、归并只是让一段**暂时有序**，后面还会动。' },
  { id: 'relax', term: '松弛', gloss: 'Dijkstra 的核心动作：如果"经过刚确定的点再到 v"比现在记的距离短，就更新它。' },
  { id: 'sptree', term: '最短路径树', gloss: '每个点记住"我是从谁那儿被松弛到最短的"，这些边连起来就是一棵树。' },
  { id: 'bf', term: '平衡因子', gloss: '左子树高 − 右子树高。AVL 要求每个结点的绝对值不超过 1，超了就旋转。' },
  { id: 'inorder', term: '中序遍历与有序性', gloss: '中序 = 左→根→右。对二叉搜索树做中序遍历，输出恰好是从小到大的有序序列 —— 不管插入顺序多乱都成立，是 BST 最常被考的性质。' },
  { id: 'rpn', term: '后缀式（逆波兰）', gloss: '把运算符写在两个操作数后面，如 3 4 + 2 *。它没有括号、也不需要优先级 —— 运算顺序已经写死在排列里。求值只要从左扫一遍：遇数字压栈、遇运算符弹两个算完压回，一个栈就够。' },
  { id: 'precedence', term: '优先级与栈', gloss: '中缀转后缀（调度场算法）靠一个运算符栈：遇到新运算符时，把栈里优先级不低于它的先弹出到后缀序列，再压自己。× ÷ 高于 + −，括号最高。栈的"后进先出"正好保证高优先级的运算符先被输出、先参与运算。' },
  { id: 'stack', term: '遍历的辅助容器', gloss: '前中后序都是"一条路走到底再回退"，靠的是栈（递归就是隐式的栈）；层序一层层铺开，靠的是队列。容器换了，访问的形状就变了。' },
  { id: 'rotate', term: 'LL / RR / LR / RL', gloss: '按"失衡结点往下两步的方向"命名。同向（LL/RR）转一次，异向（LR/RL）要先把下面掰同向再转，一共两次。' },
  { id: 'border', term: 'B+ 树的阶', gloss: 'm 阶最多 m−1 个键，满了就分裂、把中间的键提到父结点。所有真数据都在叶子层，叶子还串成链表。' },
  { id: 'asl', term: 'ASL', gloss: '平均查找长度：把每个关键字查到它所需要比较的次数平均一下。散列表比的就是这个。' },
  { id: 'collide', term: '拉链 / 开放定址', gloss: '冲突了挂成链表，还是在表里另找一个空槽。后者又分线性探测、平方探测、再散列。' },
  { id: 'clustering', term: '堆积（聚集）', gloss: '线性探测的老毛病：冲突的元素挤成一片连续的占用，后来的一撞就要探很多次。平方探测就是为了打散它。' },
  { id: 'wpl', term: 'WPL', gloss: '带权路径长度 = Σ(权值 × 到根的层数)。哈夫曼树让它最小，而且它恰好等于所有内部结点权值之和。' },
  { id: 'prefix', term: '前缀码', gloss: '任何一个编码都不是另一个的前缀，所以码流不用分隔符也能唯一解码。哈夫曼编码天然是前缀码。' },
  { id: 'next', term: 'next 数组', gloss: '模式串每个位置上"最长的相等前后缀"有多长。失配时靠它决定模式串往右滑多远。' },
  { id: 'noback', term: '主串不回退', gloss: 'KMP 相对暴力法的全部好处：主串的指针只往前走，失配时只挪模式串。' },
  { id: 'mst', term: '最小生成树', gloss: '连通所有点、总权值最小的那棵树。Prim 从一个点长出去，Kruskal 从最小的边挑起，两者总权值必然相同。' },
  { id: 'cycle', term: '环 / 连通', gloss: 'Kruskal 每挑一条边都要问"加了会不会成环"；Prim 每次只从"已经连上的那堆"往外挑。' },
  { id: 'topo', term: '拓扑序', gloss: '把有向无环图排成一列，使每条边都从前指向后。做法是反复取出入度为 0 的点。' },
  { id: 'aoe', term: 'AOE 网 / ve / vl', gloss: '边表示活动、点表示事件。ve 是事件最早能发生的时刻（正推取最大），vl 是最迟不影响工期的时刻（逆推取最小）。' },
  { id: 'critical', term: '关键路径', gloss: '余量为 0 的活动串起来的那条路。它决定整个工程的最短工期，拖它一天整体就晚一天。' },
  { id: 'dfsbfs', term: 'DFS / BFS', gloss: '深度优先一条路走到黑，用栈；广度优先一圈一圈铺开，用队列。图不连通时都要从新的起点重来。' },

  // ── 计算机网络 ──
  { id: 'cwnd', term: '拥塞窗口 cwnd', gloss: '发送方自己估出来的"网络能吃下多少"。真正能发多少是它和接收窗口里的较小者。' },
  { id: 'ssthresh', term: '慢启动阈值 ssthresh', gloss: '慢启动和拥塞避免的分界线。cwnd 小于它就翻倍涨，达到之后改成每轮 +1。丢包时它被砍成一半。' },
  { id: 'phases', term: '慢启动 / 拥塞避免 / 快恢复', gloss: '指数涨 / 线性涨 / 三次重复 ACK 后不回到慢启动而是减半接着线性涨（Reno）。超时才回慢启动。' },
  { id: 'gbnsr', term: 'GBN / SR', gloss: '回退 N：一个丢了后面全部重传，接收方只按序收。选择重传：只重传丢的那个，接收方能缓存乱序到达的。' },
  { id: 'cumack', term: '累积确认', gloss: 'ACK n 表示"n 之前的我全收到了"。GBN 用它；SR 是逐帧确认，不累积。' },
  { id: 'crc', term: 'CRC / 生成多项式', gloss: '把数据当成多项式除以约定的生成多项式，余数当校验位附在后面。收端整除得 0 就认为没错。' },
  { id: 'hamming', term: '海明码 / 校验子', gloss: '在 2 的幂次位上插校验位，每位负责一组数据位。收端算出的校验子恰好等于出错位的位号 —— 所以能纠一位。' },
  { id: 'mask', term: '子网掩码 / CIDR', gloss: '掩码里连续的 1 划出网络号、0 是主机号。/26 就是前 26 位是网络号，剩 6 位给主机（去掉全 0 全 1 两个）。' },
  { id: 'longest', term: '最长前缀匹配', gloss: '路由表里可能有多条都匹配，选掩码最长（最具体）的那条。' },
  { id: 'handshake', term: '三次握手 / 四次挥手', gloss: '建连要三步是因为得双向确认初始序号；断连要四步是因为两个方向各自关，中间可以只关一边。' },
  { id: 'timewait', term: 'TIME_WAIT', gloss: '主动关闭方最后要等 2MSL：一是保证最后那个 ACK 送到，二是让旧连接的迷路报文自然消亡。' },
  { id: 'csma', term: 'CSMA/CD', gloss: '先听后发、边发边听、冲突就停、随机等一会儿再来。只用于共享介质的以太网。' },
  { id: 'distvec', term: '距离矢量', gloss: '每台路由器维护一张"到各目的地的代价 + 下一跳"表，只跟直连邻居交换整张表。更新式：到某目的地的代价 = min（到邻居的代价 + 邻居声称到目的地的代价）。一轮一轮把最短路扩散到全网，这就是分布式的 Bellman-Ford。' },
  { id: 'counttoinf', term: '无穷计数', gloss: '链路断了以后，邻居可能把"其实要经过你才到得了"的旧路由又广播回来，路由器信了、加一跳再传，代价就一格格虚长，很慢才发现某处已不可达。RIP 把"无穷"定为 16 来封顶。水平分割 / 毒性逆转就是为了防它。' },
  { id: 'backoff', term: '二进制指数退避', gloss: '第 k 次冲突就从 0 到 2^k−1 里随机挑一个数，等这么多个争用期。冲突越多等得越久，16 次后放弃。' },
  // ── 大模型推理 ──
  { id: 'prefixcache', term: '前缀缓存 / KV 复用', gloss: '推理时每个 token 的 K、V 向量算一次可以反复用。多个请求若共享同一段前缀（同一 system prompt），这段前缀的 KV 只需算一次、跨请求复用。用一棵前缀（radix）树存已缓存的 token 路径，新请求沿树匹配，命中的前缀直接复用、不命中的才计算。' },
  { id: 'prefill', term: 'prefill（预填充）', gloss: '大模型推理分两段：prefill 是把整段输入 prompt 一次性过一遍、算出每个 token 的 KV（算得多、并行度高）；decode 是之后一个一个吐字。前缀缓存省的正是 prefill —— 命中的前缀那段 KV 不用重算，输入越长、共享越多，省得越狠。' },
  { id: 'paging', term: 'KV 分页', gloss: 'PagedAttention 把操作系统的分页搬到 KV 缓存：KV 不要求连续存放，切成固定大小的块（page），需要空间就从空闲块池拿一块、拿到哪块都行。这样从根上消灭了连续分配的外碎片 —— 和 OS 用分页取代连续内存分配是同一招。' },
  { id: 'blocktable', term: '块表 / 块级映射', gloss: '每个请求维护一张块表，把它的逻辑块号映射到物理块号 —— 本质就是页表。物理块在池子里跳着分布也没关系，块表负责把它们串回该请求的逻辑顺序。释放时按块归还空闲池，别的请求立刻能复用。' },
  // ── 机器学习 / 大模型原理 ──
  { id: 'softmaxdef', term: 'softmax', gloss: '把一串任意实数（logits）压成一个概率分布：每个取 exp、再除以所有 exp 的总和，结果非负且和为 1。exp 保证非负与单调，除以总和保证归一。大模型每吐一个字都对下一个 token 的 logits 做 softmax。' },
  { id: 'temp', term: '温度 Temperature', gloss: '采样最常调的旋钮，作用是在 softmax 之前先把 logits 除以 T。T 小（→0）差距被放大、分布变尖，越接近只选最大的那个（贪心、确定）；T 大（>1）差距被压平、分布变均匀，越随机、越有创造性。' },
  { id: 'entropy', term: '熵（bit）', gloss: '衡量一个概率分布有多"不确定"：−Σ p·log₂p。分布越均匀熵越大（越不确定），越集中在一个选项上熵越小（越确定）。温度调高，softmax 分布变平，熵就变大 —— 熵把"更随机"这件事量化成了一个数。' },
  { id: 'qkv', term: 'Q / K / V', gloss: '自注意力里每个 token 都投影出三个向量：Query（我要找什么）、Key（我能被什么找到）、Value（我携带的信息）。查询用自己的 Q 去和每个 token 的 K 比相似度，决定关注谁；再按关注度把各 token 的 V 加权汇总。真实模型里 Q/K/V 由 embedding 分别乘三个可学习矩阵得到。' },
  { id: 'scaleddot', term: '缩放点积注意力', gloss: '注意力分数 = Q·K / √d：点积衡量两个向量有多相似（越相似分数越高），除以 √d（向量维度的平方根）是为了防止维度一大点积就过大、softmax 饱和成一个 one-hot。分数再经 softmax 变成和为 1 的注意力权重。' },
  { id: 'params', term: '参数量', gloss: 'Transformer 的参数量按结构现算：embedding = vocab×d；每层注意力 = 4d²（Q/K/V/O 四个投影）；每层 FFN = 2·ffn·d²（升维+降维）。总数 = embedding + 层数×两者。GPT-2 small 这么一算恰好 124M。FFN 通常是参数大头。' },
  { id: 'scaledd', term: '缩放 √d', gloss: '注意力分数是 Q 和 K 的点积，点积会随向量维度 d 变大（d 个乘积相加）。分数太大时 softmax 会落进饱和区：一个值≈1、其余≈0，几乎处处平坦、梯度接近 0，模型学不动。把分数统一除以 √d，正好抵消维度带来的放大，让 softmax 保持在合适的软硬程度。d 越大，除得越多 —— 这就是「缩放点积注意力」里那个 √d 的来历。' },
  { id: 'causalmask', term: '因果掩码', gloss: '自回归生成时，第 i 个词只能看到自己和它前面的词（不能偷看未来）。做法：把第 i 行里所有 j>i 的注意力分数设成 −∞，softmax 之后这些位的权重恰好为 0。于是整张注意力矩阵变成严格下三角。训练时用它，才能让模型在预测每个位置时只依赖左侧上下文，和推理时逐字生成的信息可见范围一致。' },
  { id: 'chunkpf', term: 'Chunked Prefill', gloss: '把一个长 prompt 的 prefill（一次性算完整段的 KV，耗时长）切成若干小块，块与块之间插进其它请求的 decode 步。这样正在解码的请求不用干等长 prefill 整块跑完，首字延迟大幅下降，而总时间几乎不变。本质是把大颗粒的“整块 prefill”拆成细颗粒、和 decode 交错调度 —— 和操作系统让多个进程轮流上处理器是同一思想。常和 PD 分离（prefill、decode 分到不同资源）一起提。' },
  { id: 'kvoff', term: 'KV 换出 / offload', gloss: '当 GPU 显存装不下所有请求的 KV 缓存块时，把暂时用不到的块换出到容量大得多的 CPU 内存，需要时再换回 GPU。选哪个块换出通常挑最久没用的那个先走，和操作系统页面置换一模一样。好处是显存不够也能继续服务更多/更长的请求；代价是换出换入要走 PCIe 拷贝，比在显存里慢，所以要尽量少换、或异步预取。它把 KV 缓存的显存压力用“换到 CPU”的方式续命。' },
  { id: 'allreduce', term: 'All-Reduce / 环形通信', gloss: '多卡把各自的一份数据求和、并让每张卡都拿到同一个结果，叫 all-reduce。朴素做法人人给人人发（G² 条消息、带宽爆）。环形（ring）算法把卡排成一个环，分两段共 2(G−1) 步：先 reduce-scatter —— 每步各卡把一个块发给环上下一张、对方累加，G−1 步后每张卡「拥有」某一个块的完整求和；再 all-gather —— 把这些已求和的块沿环传一圈，G−1 步后人人集齐所有块 = 完整总和。妙处：每步每张卡只收发一个块，用掉的带宽与卡数无关（带宽最优）。这是多卡对齐梯度/激活的基本操作，张量并行拼结果用的 all-gather 就是它的后半段。' },
  { id: 'tpdef', term: '张量并行 / all-gather', gloss: '把一个大矩阵乘切到多张 GPU 上分头算，再拼回来。列并行：权重 W[K×N] 按列切成 G 份，第 g 张卡拿一段列、算出结果 Y 的对应一段列（Y_g = X·W_g）。每张卡只存 1/G 的权重、只做 1/G 的乘法。最后用一次跨卡通信 all-gather 把各卡的 Y 片拼成完整 Y。因为只是把同一个矩阵乘的列分开算，拼起来和单卡整算的结果完全一样 —— 不改结果，只把显存和算力摊到多卡（各降到 1/G），代价是那一次跨卡通信。它坐在「矩阵乘法」之上，是把大模型放上多卡跑的基本手段。' },
  { id: 'layoutdef', term: '行主序 / 列主序', gloss: '矩阵是二维的，内存是一维的，把二维摊平进一维就是布局。row-major（行主序，C 和 NumPy 默认）：一行的元素在内存里连续存，元素 [i][j] 落在地址 i·cols+j。col-major（列主序，Fortran 和很多 BLAS 库默认）：一列的元素连续存，[i][j] 落在地址 j·rows+i。同一个矩阵、同样的值，两种布局在内存里的顺序完全不同。谁连续，顺着它走的访问就快（正好踩在 cache 行上、一次读一片）：row-major 里扫一行步长 1（连续、快）、扫一列步长 cols（跳着、慢），col-major 反过来。矩阵乘、转置、reshape 都要在意布局，否则访存跳来跳去、cache 命中率崩。' },
  { id: 'matmuldef', term: '矩阵乘法', gloss: '两个矩阵相乘 A·B=C。规则：A 是 M×K、B 必须是 K×N（A 的列数=B 的行数，这个共同的 K 叫内维），结果 C 是 M×N。C 的每个格 C[i][j] = A 的第 i 行和 B 的第 j 列做点积 = Σ_k A[i][k]·B[k][j]（对应位相乘再全加起来）。总运算量 = 2·M·N·K 次浮点（每格 K 次乘 + K 次加）。神经网络几乎每一步都是矩阵乘：注意力的 Q·Kᵀ、前馈网络的 W·x、输出层投影到词表，全是它。FlashAttention 分块、多卡并行切矩阵，都是在切分这个乘法、并不改变结果。' },
  { id: 'fwpass', term: '前向传播 / 一次 decode', gloss: '模型推理时，把输入向量从头算到尾、吐出下一个 token 的完整过程，叫一次前向传播。一层 Transformer 块的顺序是：归一化 → 自注意力 → 残差相加 → 归一化 → 前馈网络 FFN → 残差相加；真实模型把这样的块叠几十上百层，最后一层归一化后接 LM 头投影到词表，得到每个词的 logit，再 softmax + 采样选出下一个 token。生成一句话就是把这条链重复跑很多次（每次多吐一个字）。推理引擎里 KV 缓存、FlashAttention、量化、连续批处理，优化的都是这条链的速度，不改变它算出来的结果。' },
  { id: 'rmsdef', term: 'RMSNorm / 均方根归一化', gloss: '把一个向量缩放到统一尺度的归一化方法，Transformer 每个子层前都用。均方根 RMS = √(各维平方的平均)。RMSNorm 把向量每一维都除以这个 RMS，于是归一化后向量的均方根恰好为 1（尺度被拉齐），再乘一个可学习的增益 g（每维一个）微调。它和 LayerNorm 的关键区别是：LayerNorm 先减均值再除标准差、还带偏置，RMSNorm 不减均值、不带偏置，更省计算和参数，效果却相当 —— 所以 LLaMA、Qwen 等主流大模型都改用它。' },
  { id: 'ropepos', term: 'RoPE 旋转位置编码', gloss: '给注意力加位置信息的一种做法。注意力本身对词序无感（打乱词序结果一样），需要额外告诉它每个词在第几位。RoPE 把每对相邻维度 (x₂ᵢ, x₂ᵢ₊₁) 看成平面上的一个 2D 向量，按“位置 × 频率 θ”的角度旋转它。旋转只改方向、不改模长。妙处在于：位置 m 的 query 和位置 n 的 key 各自旋转后做点积，结果只依赖夹角差 (m−n)·θ —— 只和相对位置有关、与绝对位置无关，所以能自然泛化到训练时没见过的更长上下文。真实实现给每对维度一个不同的频率 θᵢ=base^(−2i/d)：转得快的编码精细位置、慢的编码粗位置。' },
  { id: 'moeroute', term: 'MoE / 专家路由', gloss: '把 Transformer 里那个最大的 FFN 拆成 E 个小“专家”网络，再加一个 router 给每个 token 打分。门控 = softmax(router 分数)，只取分数最高的 top-k 个专家来算，输出是这 k 个专家结果按门控加权求和。于是模型的总参数量随专家数 E 增长（容量变大），但每个 token 只激活 k 个专家、算力只随 k 走（活跃参数 ∝ k/E）。这就是“总参数几百 B、推理只激活几十 B”的稀疏激活。代价是各专家接到的 token 数可能不均（负载不均衡），要靠均衡策略缓解。' },
  { id: 'quantsym', term: '对称量化 / scale', gloss: '把浮点权重压成低位整数的一种做法。先定一个步长 scale = 该组权重绝对值最大 ÷ 整数上限（int8 是 127、int4 是 7）；再把每个权重除以 scale、四舍五入成整数存起来；用时反量化 ŵ = 整数 × scale 还原。因为整数只有有限格、scale 一格代表固定大小，还原值和原值会差一点点（舍入误差）。位数越少，可用的整数格越少、scale 越大、误差越大，但每个权重占的字节越少、越省显存。这是拿一点精度换显存和带宽。' },
  { id: 'specdraft', term: '草稿 / 目标模型', gloss: '投机解码里的两个模型：草稿模型小而快、猜得不一定准，负责一口气提议 K 个后续 token；目标模型（真正要用的大模型）大而准、也贵，负责一次前向并行验证这 K+1 个位置。验证时从头比对，接受草稿猜对的最长前缀，第一个猜错处用目标模型自己的 token 纠正，其余作废；K 个全中还能白送目标模型的下一个 token。因为落地的每个 token 都由目标模型定夺，最终输出和只用目标模型逐字生成完全一致 —— 草稿只是帮忙提速，不改变结果。' },
  { id: 'roofmodel', term: 'Roofline / 算术强度', gloss: '判断一个 kernel 到底卡在哪的性能模型。算术强度 AI = FLOPs ÷ 搬运字节数（每从显存搬一个字节，能做几次浮点运算）。机器有两个上限：峰值算力 P（每秒多少 FLOP）和峰值带宽 B（每秒搬多少字节），两者之比 P/B 叫脊点。可达性能 = min(P, AI·B)：当 AI 小于脊点，性能被带宽卡住（memory-bound，搬得慢）；大于脊点，被算力卡住（compute-bound，算得慢）。画成图就是一条“先斜坡后平顶”的屋顶线。大模型解码 AI≈1、深陷带宽瓶颈，所以优化都在想办法抬高 AI。' },
  { id: 'onlinesoftmax', term: '在线 softmax', gloss: '一次只看一小块数据、就能算出和「看完整批」完全一样的 softmax 加权和的技巧。维护三个滚动量：m（目前见过的最大分数）、l（exp 之和）、O（加权和）。每来一个新块，先把旧的 l、O 按 exp(旧max − 新max) 缩放，对齐到新的最大值，再加上本块的贡献。因为 softmax 对所有分数同减一个常数结果不变，这样分块累加与一次性 softmax 分毫不差。FlashAttention 靠它边扫块边算，中间那条完整的分数向量永远不用存下来。' },
  { id: 'hbmsram', term: 'HBM / SRAM', gloss: 'GPU 的两级存储：HBM 是显存，容量大但带宽相对慢；SRAM 是片上缓存，容量极小但快几十倍。注意力慢往往不是算得慢，而是那条很长的分数向量在 HBM 里被反复读写（访存瓶颈）。FlashAttention 把计算搬进 SRAM 分块做，分数向量不落 HBM —— 和 CPU 缓存的分块（blocking）优化是同一招：让数据尽量待在快的那层里算完。' },
  { id: 'kvprefill', term: '预填充 / 解码', gloss: '大模型推理分两段：预填充（prefill）把整段输入 prompt 一次性喂进模型、并行算出每个 token 的 K/V（算得多、并行度高）；解码（decode）是之后一个字一个字地吐，每步都要用到前面所有 token 的 K/V。KV 缓存省的正是解码阶段这份对前缀 K/V 的重复计算。' },
  { id: 'kvmem', term: 'KV 缓存显存', gloss: '推理时每个 token 的 K、V 向量要缓存起来供后续复用。显存 = 2（K 和 V）× 层数 × 序列长 × d × 每参数字节。它是每序列的额外开销，随序列长度和并发请求数线性增长 —— 长上下文、高并发的显存压力主要来自它，而权重是固定开销。' },
  { id: 'topk', term: 'top-k 采样', gloss: '吐字前只保留概率最高的 k 个候选，其余全部置 0，再在这 k 个里重新归一化后采样。按"个数"截断，简单但固定 —— 不管这 k 个概率是很接近还是很悬殊，都恰好留 k 个。' },
  { id: 'topp', term: 'top-p / 核采样', gloss: '把候选按概率从大到小累加，保留累计概率刚超过 p 的那一小撮（"核"），其余砍掉再归一化。按"累计概率"截断：分布很尖时只留一两个（省得采到长尾），分布很平时自动多留几个（保住多样性）—— 比 top-k 更能随分布自适应。' },
  { id: 'bpe', term: 'BPE 分词', gloss: '字节对编码：先把文本拆成最小单位（字符/字节），再按训练好的 merge 表逐条把高频相邻对合并成一个 token。merge 表是在语料上统计学出来的，高频组合优先合并 —— 这让常见词压成很少的 token，罕见串保留更多 token。' },
  { id: 'tokencost', term: 'token 成本', gloss: '大模型按 token 计费、上下文也按 token 算长度。分词器的 merge 表主要在英文语料上学，英文常见词能一路合并成一两个 token；中文很多字的组合不在表里、甚至先被拆成 2-3 个 UTF-8 字节，合并不动，同样一句话 token 数更多 —— 这就是"中文更贵"的技术原因。' },
  { id: 'contbatch', term: '连续批处理', gloss: '推理引擎把多个请求凑成一个 batch 一起过 GPU。静态批处理等整批跑完才收下一批，请求长短不一时空槽白白浪费；连续批处理每个 decode 步都动态调整 batch —— 请求吐完就离场、腾出的槽立刻补进排队的请求。本质是把进程调度搬到 GPU：槽相当于 CPU、请求相当于进程、每一步 decode 相当于一次调度。' },
  { id: 'mhavariant', term: 'MHA / MQA / GQA', gloss: '多头注意力的三种变体，差在 KV 头怎么共享。MHA：每个 query 头一个 KV 头，表达力最强但 KV 缓存最大。MQA：所有 query 头共享 1 个 KV 头，KV 缓存最小但可能掉点。GQA：query 头分组、每组共享一个 KV 头，是前两者的折中，现在大模型（LLaMA2、Qwen 等）普遍用它。KV 缓存大小正比于 KV 头数。' },
  { id: 'gpuutil', term: 'GPU 利用率', gloss: '当前在跑的 batch 槽数占总槽数的比例。请求长短不一时，静态批处理会因为等最慢的请求而让空槽闲置、利用率低；连续批处理把空槽随时补满，利用率接近 100%，同样的卡能服务更多请求、吞吐更高。' },
]

/** 每个实验一段。**加实验必须加这一段** —— 冒烟会数够不够 30 个。 */
export const GUIDES: Record<string, Guide> = {
  urlshortener: {
    question: '长 URL 怎么变成又短又唯一的短码？短码又怎么跳回长 URL？',
    read: [{ at: '映射表', is: '长 URL → 发号 ID → Base62 短码，逐条长出来。', anchor: '.url-map' }, { at: '读数', is: '发号器下一号、已建短链、容量。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { phase: string; counter: number; entries: { id: number; code: string }[]; lookup: { code: string; id: number } | null; capacity: number; focus: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '发号→编码→跳转→容量全走完' : st.phase === 'redirect' ? `访问短码 /${st.lookup?.code}` : st.phase === 'capacity' ? '算短码位数够不够' : st.entries.length ? `发号器发第 ${st.entries.length} 个号` : '准备发号' },
      { k: '判定规则', v: '发号器发单调自增 ID（唯一不碰撞）；Base62 编码=不断取余 62 映射到 0-9a-zA-Z、商继续、倒序拼；解码=按 62 进制累加回 ID（可逆）。跳转靠解码回 ID 查库、302。' },
      { k: '本步结果', v: st.phase === 'done'
        ? `建了 ${st.entries.length} 条短链，最新码 ${st.entries[st.entries.length - 1]?.code}；6 位可容 62⁶≈${(st.capacity / 1e8).toFixed(0)}亿`
        : st.lookup
          ? `${st.lookup.code} 解码回 ID ${st.lookup.id.toLocaleString()} → 查库 302`
          : st.phase === 'capacity'
            ? `6 位 Base62 = 62⁶ = ${st.capacity.toLocaleString()} 个码`
            : st.entries.length
              ? `ID ${st.entries[st.entries.length - 1]?.id.toLocaleString()} → 短码 ${st.entries[st.entries.length - 1]?.code}`
              : '发号器就绪' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; entries: { code: string }[] }; return st.phase === 'done' ? `最新码 ${st.entries[st.entries.length - 1]?.code ?? '—'}` : st.phase === 'redirect' ? '解码跳转' : st.phase === 'capacity' ? '容量估算' : st.entries.length ? `发号 ${st.entries.length}` : '就绪'; },
    try: [{ act: '看 URL#1 的 Base62 逐位编码', watch: 'ID 100000000 不断取余 62、映射字符、商继续，倒序拼成 "6LAze"——9 位十进制压成 5 位。' }, { act: '看跳转那步解码', watch: '短码按 62 进制累加解回 ID，正好等于当初发的号——编码/解码可逆，这就是短→长的桥。' }], terms: [],
  },
  mqdesign: {
    question: '消息读走后为什么不删除？两个消费组怎么各读一遍同一条消息？offset 是谁的？',
    read: [{ at: '分区日志', is: '两条 append-only 日志，每格带 offset；追加的高亮、被读的标记。', anchor: '.mq-parts' }, { at: '各组 offset', is: '每个分区头部显示 G1/G2 各自读到哪。', anchor: '.mq-poff' }],
    step: (s: never) => { const st = s as { phase: string; op: string; P: number; parts: { log: unknown[] }[]; produce: { key: string; part: number; offset: number; val: string } | null; poll: { group: string; part: number; offset: number; val: string } | null; groups: { name: string; offsets: number[] }[]; focus: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '生产追加+两组消费全走完' : st.produce ? `生产「${st.produce.val}」key=${st.produce.key}` : st.poll ? `${st.poll.group} poll 分区${st.poll.part}` : '准备' },
      { k: '判定规则', v: `生产：key 哈希%${st.P} 选分区、追加到日志尾得单调 offset（同 key 同分区→分区内有序）。消费：读不删除，消费者自己的 offset 记读到哪、poll 一条 +1；不同组 offset 独立。` },
      { k: '本步结果', v: st.phase === 'done'
        ? `日志共 ${st.parts.reduce((a, p) => a + p.log.length, 0)} 条；G1 offset ${st.groups[0]!.offsets.join('/')}、G2 ${st.groups[1]!.offsets.join('/')}`
        : st.produce
          ? `「${st.produce.val}」→ 分区 ${st.produce.part}、offset ${st.produce.offset}`
          : st.poll
            ? `${st.poll.group} 读 分区${st.poll.part}@${st.poll.offset} →「${st.poll.val}」，offset→${st.poll.offset + 1}（消息不删）`
            : '就绪' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; produce: unknown; poll: { group: string } | null; parts: { log: unknown[] }[] }; return st.phase === 'done' ? `日志 ${st.parts.reduce((a, p) => a + p.log.length, 0)} 条` : st.poll ? `${st.poll.group} 消费` : st.produce ? '生产追加' : '就绪'; },
    try: [{ act: '看同 key 落同分区', watch: 'key=A 的两条(下单#1、付款#1)都追加到分区1、offset 0 和 1——分区内严格有序，这就是 MQ 的顺序保证。' }, { act: '看 G2 从 0 重读', watch: 'G1 早读过分区1的 offset 0 了，但消息没删；G2 offset 从 0 起照样读到「下单#1」——两组独立，各消费一遍(发布订阅)。' }], terms: [],
  },
  objectstore: {
    question: '存海量图片、短视频，怎么做到便宜、不丢、还播放不卡？',
    read: [{ at: '架构', is: '一步步搭起来的组件（上传→对象存储→CDN分发）。', anchor: '.sd-arch' }, { at: '读数', is: '当前阶段、关键数、组件。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { stage: string; focus: string; metric: string; components: unknown[]; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '走完整套对象存储设计' : `${st.stage}` },
      { k: '判定规则', v: '存：文件切块+多副本/纠删码存多机+元数据单独存(扁平key水平扩展)。传：大文件分片续传+哈希秒传去重。发：CDN边缘缓存+视频多码率转码切片。每步问"为什么这么选"。' },
      { k: '本步结果', v: st.phase === 'done' ? '一套对象存储搭好，可讲清切块/冗余/分发的取舍' : `${st.focus}；关键：${st.metric}（已定 ${st.components.length} 个组件）` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; stage: string }; return st.phase === 'done' ? '设计完成' : st.stage.replace(/^[①②③④⑤⑥⑦]\s*/, '') },
    try: [{ act: '按「下一步」走框架', watch: '需求→估算→对象存储→上传→CDN分发，组件一块块搭。' }, { act: '记住两条要点', watch: '副本vs纠删码(成本vs恢复)、CDN+转码让播放快——面试要点。' }], terms: [],
  },
  feed: {
    question: '普通用户发帖为什么"推"、大V发帖为什么"拉"？刷 feed 时两路怎么合成时间线？',
    read: [{ at: '两路箱', is: '「我」的收件箱(推来的) + 大V 的 outbox(不扩散)。', anchor: '.fd-boxes' }, { at: '读数', is: '推累计写入、大V拉省下的写、收件箱/Feed 条数。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { phase: string; op: string; event: { author: string; text: string; mode: string; fanout: number } | null; myInbox: unknown[]; vOutbox: unknown[]; pushWrites: number; savedWrites: number; feed: { text: string; t: number }[]; focus: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '发帖(推/拉)+刷feed归并全走完' : st.event ? `${st.event.author} 发帖（走${st.event.mode === 'push' ? '推' : '拉'}）` : st.op === 'merge' ? '「我」刷 feed' : '准备' },
      { k: '判定规则', v: '推(fan-out on write)：发帖写进每个粉丝收件箱→读 O(1)、写 O(粉丝数)。拉(fan-out on read)：只存 outbox→写 O(1)、读时拉关注人归并。大V 粉丝太多必须拉、普通用户推。刷 feed=收件箱+拉大V→按时间归并。' },
      { k: '本步结果', v: st.phase === 'done'
        ? `推共写 ${st.pushWrites} 次、大V走拉省 ${st.savedWrites.toLocaleString()} 次；feed 归并 ${st.feed.length} 条`
        : st.event?.mode === 'push'
          ? `写进 ${st.event.fanout} 个粉丝收件箱，累计写 ${st.pushWrites}；我的收件箱 ${st.myInbox.length} 条`
          : st.event?.mode === 'pull'
            ? `只存 outbox，省 ${(1_000_000).toLocaleString()} 次写（累计省 ${st.savedWrites.toLocaleString()}）`
            : st.op === 'merge'
              ? `收件箱 ${st.myInbox.length} + 拉大V ${st.vOutbox.length} → 归并：${st.feed.map(p => p.text.split('：')[0]).join(' > ')}`
              : '就绪' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; event: { mode: string } | null; op: string; pushWrites: number; savedWrites: number }; return st.phase === 'done' ? `推写${st.pushWrites}/省${st.savedWrites.toLocaleString()}` : st.event?.mode === 'push' ? '推·写扩散' : st.event?.mode === 'pull' ? '拉·存outbox' : st.op === 'merge' ? '刷feed归并' : '就绪'; },
    try: [{ act: '看普通用户走推', watch: 'A/B 发帖时写进每个粉丝(3人)收件箱——「我」的收件箱直接攒好，刷 feed 读它 O(1)。' }, { act: '看大V走拉省了多少', watch: '大V 百万粉，推要写百万次；走拉只存 outbox、省 2,000,000 次写，刷时才拉这一个作者。最后两路按时间归并成 feed。' }], terms: [],
  },
  fk: {
    question: '已知每个关节转了多少度、每根连杆多长，机械臂末端到底在哪、朝哪？',
    read: [{ at: '连杆臂', is: '平面手臂逐关节画出来，末端(橙点)是求解目标。', anchor: '.fk-svg' }, { at: '读数', is: '已应用关节、累计朝向 cumθ、当前末端坐标。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { phase: string; links: { theta: number; L: number }[]; revealed: number; cur: number; points: { x: number; y: number }[]; cumAngle: number; endAngle: number; focus: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '三关节全部应用完' : st.revealed > 0 ? `应用关节 ${st.cur + 1}（θ=${st.links[st.cur]?.theta}°、L=${st.links[st.cur]?.L}）` : '准备：末端在基座 (0,0)' },
      { k: '判定规则', v: '把这个关节的角叠进累计朝向 cumθ=θ₁+…+θᵢ，再从上一节末端沿 cumθ 走一根连杆：xᵢ=xᵢ₋₁+Lᵢ·cos cumθᵢ，yᵢ=yᵢ₋₁+Lᵢ·sin cumθᵢ。一节一节累到末端。' },
      { k: '本步结果', v: st.phase === 'done'
        ? `末端位姿 (${st.points[st.points.length - 1]?.x}, ${st.points[st.points.length - 1]?.y})、朝向 ${st.endAngle}°`
        : st.revealed > 0
          ? `累计朝向 ${st.cumAngle}°，第 ${st.revealed} 节末端 (${st.points[st.points.length - 1]?.x}, ${st.points[st.points.length - 1]?.y})`
          : '末端 (0, 0)' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; revealed: number; points: { x: number; y: number }[] }; return st.phase === 'done' ? `末端 (${st.points[st.points.length - 1]?.x}, ${st.points[st.points.length - 1]?.y})` : st.revealed > 0 ? `第 ${st.revealed} 节` : '基座'; },
    try: [{ act: '逐关节看累计朝向', watch: 'cumθ 是从基座到当前的角度和；关节2 后 cumθ=90°，那一节就竖直向上走 L=2 到 (1.732, 3)。' }, { act: '想反问题：IK', watch: 'FK 是关节角→末端(唯一解)；反过来「要末端到某点，各关节转几度」是逆运动学 IK——可能多解或够不到，难得多。' }], terms: [],
  },
  ik: {
    question: '给机械臂末端一个目标点，各关节该转几度？为什么答案不止一个、有时还够不到？',
    read: [{ at: '臂与目标', is: '目标(空心圈)、可达圆环、两支解的臂姿(肘上/肘下)。', anchor: '.fk-svg' }, { at: '读数', is: '目标距离 r 与可达范围、cosθ2、已求出的解。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { phase: string; op: string; r: number; reachLo: number; reachHi: number; reachable: boolean; cosTheta2: number; solutions: { branch: string; th1: number; th2: number; checkX: number; checkY: number }[]; curBranch: number; focus: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '两支解全求出并回代验证' : st.op === 'reach' ? `判目标可达性（r=${st.r}）` : st.op === 'cosine' ? '余弦定理求肘角 θ2' : st.op === 'branch' ? `解第 ${st.curBranch + 1} 支（${st.solutions[st.curBranch]?.branch.split(' ')[0]}）` : '准备反解' },
      { k: '判定规则', v: '可达：r 须落在 [|L1−L2|, L1+L2]。肘角：cosθ2=(x²+y²−L1²−L2²)/(2L1L2)，θ2=±acos(±两支=肘上/肘下)。肩角 θ1=atan2(y,x)−atan2(L2 sinθ2, L1+L2 cosθ2)。每支回代 FK 验证落到目标。' },
      { k: '本步结果', v: st.phase === 'done'
        ? `两组解 ${st.solutions.map(x => `(${x.th1}°,${x.th2}°)`).join(' / ')}，都回代 FK=(${st.solutions[0]?.checkX},${st.solutions[0]?.checkY}) ✓`
        : st.op === 'reach'
          ? `r=${st.r} ${st.reachable ? '∈' : '∉'} [${st.reachLo},${st.reachHi}] → ${st.reachable ? '够得到' : '够不到、无解'}`
          : st.op === 'cosine'
            ? `cosθ2=${st.cosTheta2} → θ2=±acos → 两支(肘上/肘下)`
            : st.op === 'branch'
              ? `θ1=${st.solutions[st.curBranch]?.th1}°、θ2=${st.solutions[st.curBranch]?.th2}° → 回代 FK=(${st.solutions[st.curBranch]?.checkX},${st.solutions[st.curBranch]?.checkY})`
              : '就绪' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; reachable: boolean; solutions: unknown[] }; return st.phase === 'done' ? `${st.solutions.length} 组解` : !st.reachable ? '无解' : st.op === 'branch' ? `解出第 ${st.solutions.length} 支` : st.op === 'cosine' ? '余弦定理' : st.op === 'reach' ? '判可达' : '就绪'; },
    try: [{ act: '看 ± 两支解', watch: 'cosθ2=0 → θ2=±90°，正负两支就是肘朝下(0°,90°)、肘朝上(90°,−90°)两种姿势，够到同一点 (2,2)。' }, { act: '想无解的情况', watch: '目标 (4.5,0) 的 r=4.5 超出可达上界 4，手臂伸直也够不到——这就是 IK 的"无解"，FK 永远不会遇到。' }], terms: [],
  },
  jacobian: {
    question: '关节以某个角速度转，机械臂末端会以什么速度、朝哪动？手臂伸直时为什么会"卡住"？',
    read: [{ at: '臂+速度箭头', is: '当前构型的臂 + 末端速度向量(绿箭头)。', anchor: '.fk-svg' }, { at: 'J 矩阵', is: '2×2 雅可比与 det；奇异时标红。', anchor: '.jc-matwrap' }],
    step: (s: never) => { const st = s as { phase: string; op: string; theta1: number; theta2: number; J: number[][]; det: number; singular: boolean; dtheta: [number, number] | null; endVel: { vx: number; vy: number } | null; focus: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '把 θ2 转到 0（手臂伸直）看奇异' : st.op === 'build' ? `在 θ=[${st.theta1}°,${st.theta2}°] 求 J` : st.op === 'apply' ? `施加关节速度 θ̇=[${st.dtheta?.[0]}, ${st.dtheta?.[1]}]` : st.op === 'det' ? '算 det(J) 判可逆' : '准备' },
      { k: '判定规则', v: '雅可比 J=末端(x,y)对关节(θ1,θ2)的偏导；ẋ=Jθ̇ 把关节速度线性映成末端速度。det(J)=L1L2 sinθ2：≠0 可逆(能反解)，=0 奇异(两列平行、末端丢一个自由度、J⁻¹ 爆炸)。' },
      { k: '本步结果', v: st.phase === 'done'
        ? `θ2=0 手臂伸直 → det(J)=${st.det} 奇异！两列平行，末端只能沿一个方向动、丢自由度`
        : st.op === 'build'
          ? `J=[[${st.J[0][0]}, ${st.J[0][1]}], [${st.J[1][0]}, ${st.J[1][1]}]]`
          : st.op === 'apply'
            ? `末端速度 = (${st.endVel?.vx}, ${st.endVel?.vy})`
            : st.op === 'det'
              ? `det(J)=${st.det} ≠ 0 → 可逆，能反解关节速度(速度层 IK)`
              : '就绪' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; singular: boolean; det: number }; return st.singular ? '奇异·丢自由度' : st.phase === 'done' ? '可逆' : st.op === 'apply' ? '速度映射' : st.op === 'build' ? '求 J' : st.op === 'det' ? `det=${st.det}` : '就绪'; },
    try: [{ act: '看 J 的两列', watch: '每一列 = 只转那个关节时末端往哪动；θ̇=[1,0] 的末端速度就是第 1 列 (-2.732, 0.732)。' }, { act: '看伸直时的奇异', watch: 'θ2=0 手臂伸直 → det(J)=L1L2 sin0=0，J 两列平行，末端只能沿一条线动、丢了一个自由度，J⁻¹ 爆炸——这就是奇异构型。' }], terms: [],
  },
  quat: {
    question: '机器人的"朝向"怎么表示？为什么用四元数而不是直观的欧拉角（roll/pitch/yaw）？',
    read: [{ at: '向量旋转', is: 'xy 平面里向量随四元数转过去（起始虚箭头→当前实箭头）。', anchor: '.fk-svg' }, { at: '读数', is: '四元数 q=(w,x,y,z)、|q|²、累计转角。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { phase: string; op: string; q: number[]; qnorm: number; R: number[][]; vecNow: number[]; angleShown: number; eulerSets: { yaw: number; pitch: number; roll: number }[]; focus: string }; return [
      { k: '本步输入', v: st.phase === 'intro' ? '绕 z 轴转 90°，向量 (1,0,0)' : st.op === 'quat' ? '轴-角 (0,0,1)、90°' : st.op === 'matrix' ? '四元数 → 旋转矩阵' : st.op === 'rotate' ? 'R 乘向量 (1,0,0)' : st.op === 'compose' ? '再转 90°（四元数自乘）' : st.op === 'gimbal' ? 'pitch=90° 的三组欧拉角' : '收束' },
      { k: '判定规则', v: 'q=(cos(θ/2), sin(θ/2)·轴)，|q|=1；四元数→矩阵有固定公式，R 乘向量=转它；组合旋转=四元数相乘(不可交换)；欧拉角 pitch=90° 时 yaw 与 roll 绕同轴→丢自由度(万向锁)。' },
      { k: '本步结果', v: st.op === 'quat' ? `q=(${st.q.join(', ')})，|q|²=${st.qnorm}`
        : st.op === 'matrix' ? `R=[[${st.R[0].join(',')}],[${st.R[1].join(',')}],[${st.R[2].join(',')}]]`
          : st.op === 'rotate' ? `R·(1,0,0)=(${st.vecNow.join(', ')})，x 轴→y 轴`
            : st.op === 'compose' ? `q⊗q → 转 ${st.angleShown}°，(1,0,0)→(${st.vecNow.join(', ')})`
              : st.op === 'gimbal' ? `三组不同欧拉角(yaw−roll 都=30)→同一个 R，丢一个自由度`
                : st.phase === 'done' ? '四元数：4 数、无奇异、好插值 → 机器人首选' : '就绪' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; angleShown: number }; return st.phase === 'done' ? '四元数首选' : st.phase === 'gimbal' ? '万向锁' : st.op === 'quat' ? '轴角→q' : st.op === 'matrix' ? '→矩阵' : st.op === 'rotate' ? `转 ${st.angleShown}°` : st.op === 'compose' ? '相乘组合' : '就绪'; },
    try: [{ act: '看 |q| 恒为 1', watch: '绕轴转 θ → q=(cos(θ/2), sin(θ/2)·轴)，w²+x²+y²+z²=1。只用 4 个数编码一个旋转，比矩阵的 9 个省。' }, { act: '看万向锁', watch: 'pitch=90° 时 (30,90,0)、(60,90,30)、(50,90,20) 给出同一个 R——yaw 和 roll 锁成一个、丢一个自由度。四元数没这毛病，所以机器人/IMU 用它。' }], terms: [],
  },
  trajectory: {
    question: '机器人关节从 0° 转到 90°，为什么不能匀速直接走？怎么生成一条平滑的时间轨迹？',
    read: [{ at: '位置/速度图', is: '三次多项式(实线)的位置 S 曲线、速度钟形；线性(虚线)的速度两端突跳。', anchor: '.traj-charts' }, { at: '读数', is: '时间、位置 θ、速度 θ̇、加速度 θ̈。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { phase: string; op: string; theta0: number; thetaF: number; T: number; a: number[]; t: number; theta: number; vel: number; accel: number; linVel: number; focus: string }; return [
      { k: '本步输入', v: st.op === 'intro' ? `关节 ${st.theta0}°→${st.thetaF}°、T=${st.T}s` : st.op === 'linear' ? '线性插值（匀速）' : st.op === 'solve' ? '解三次多项式系数' : `采样 t=${st.t}s` },
      { k: '判定规则', v: '线性插值速度两端从 0 突跳=无穷加速度。三次多项式 θ(t)=a0+a1t+a2t²+a3t³，用 4 个边界条件(θ(0)、θ(T)、θ̇(0)=0、θ̇(T)=0)定系数：位置 S 曲线、速度钟形(两端归零)、加速度有限。' },
      { k: '本步结果', v: st.op === 'linear' ? `速度恒 ${st.linVel}°/s，但两端突跳→无穷加速度`
        : st.op === 'solve' ? `a=[${st.a.join(', ')}]（两端速度=0 定死）`
          : st.op === 'sample' || st.op === 'summary' ? `t=${st.t}s：θ=${st.theta}°、θ̇=${st.vel}°/s、θ̈=${st.accel}°/s²${st.op === 'summary' ? '（到位、速度归零）' : ''}`
            : '就绪' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; t: number; vel: number }; return st.phase === 'done' ? '平滑到位' : st.op === 'linear' ? '速度突跳' : st.op === 'solve' ? '解系数' : st.op === 'sample' ? `t=${st.t}s v=${st.vel}` : '就绪'; },
    try: [{ act: '看线性的速度突跳', watch: '线性插值速度恒 45°/s，但起点从 0 突跳到 45、终点又跳回 0=瞬间无穷大加速度，真电机顿挫抖动。' }, { act: '看三次的速度钟形', watch: '三次多项式速度从 0 爬到中点最大(64.8)再回 0，位置走 S 曲线——起步和停止都平滑。要加速度也平滑就用五次多项式。' }], terms: [],
  },
  kalman: {
    question: '里程计会漂、GPS 会跳，机器人怎么把两个都不准的信息融合成一个更准的位置估计？',
    read: [{ at: '滤波图', is: '真值(绿)、GPS观测(空心)、融合估计(橙)带 ±√P 不确定带。', anchor: '.fk-svg' }, { at: '读数', is: '本拍、估计 x vs 真值、方差 P、增益 K。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { phase: string; op: string; stepNo: number; x: number; P: number; truePos: number; z: number | null; K: number | null; innov: number | null; xPred: number; Q: number; R: number; focus: string }; return [
      { k: '本步输入', v: st.phase === 'intro' ? '初始 x=0、P=1' : st.op === 'predict' ? `步 ${st.stepNo} · Predict：里程计前进 u` : `步 ${st.stepNo} · Update：GPS 观测 z=${st.z}` },
      { k: '判定规则', v: 'Predict：x\'=x+u、P\'=P+Q(方差涨)。Update：增益 K=P\'/(P\'+R)、x=x\'+K(z−x\')、P=(1−K)P\'(方差缩)。K 是"信预测还是信观测"的权重：观测准(R小)→K大→多信观测。' },
      { k: '本步结果', v: st.phase === 'done'
        ? `估计 x=${st.x} 贴着真值 ${st.truePos}，方差收敛到 ${st.P}（K→${st.K}）`
        : st.op === 'predict'
          ? `x'=${st.x}、P'=${st.P} ↑（真值 ${st.truePos}，只靠预测会漂）`
          : st.K !== null
            ? `K=${st.K} 融合 → x=${st.x}（真值 ${st.truePos}），方差缩到 ${st.P}`
            : '就绪' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; x: number; P: number; K: number | null }; return st.phase === 'done' ? `x=${st.x}·P=${st.P}` : st.op === 'predict' ? '预测·方差涨' : st.op === 'update' ? `校正·K=${st.K}` : '就绪'; },
    try: [{ act: '看方差 P 的锯齿', watch: 'predict 时 P 涨(误差棒变长、越推越不确定)、update 时 P 缩(观测拉回、更确定)，收敛到稳态 ~0.5。' }, { act: '看增益 K 权衡', watch: 'K=P/(P+R)：预测不确定(P大)时 K 大、多信观测；确定后 K 小、多信预测。融合估计比单独预测或观测都贴真值。' }], terms: [],
  },
  icp: {
    question: '激光雷达两帧点云，机器人不知道哪个点对哪个点，怎么把它们对齐、算出自己动了多少？',
    read: [{ at: '点云图', is: '目标点云(空心)、源点云(实心)、对应连线；源云逐轮转到目标上。', anchor: '.fk-svg' }, { at: '读数', is: '迭代轮、点对平均误差、累计旋转 vs 真值。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { phase: string; op: string; iterNo: number; iterRot: number; cumRot: number; error: number; trueRot: number; focus: string }; return [
      { k: '本步输入', v: st.op === 'intro' ? `源点云 + 目标(转 ${st.trueRot}°+平移)、初始误差 ${st.error}` : `第 ${st.iterNo} 轮：当前源点云位置` },
      { k: '判定规则', v: '① 每个源点在目标里找欧氏最近的点当对应(一开始会猜错几个)；② 用这批点对算最佳刚体变换(去质心、交叉协方差求旋转)；③ 把源点云搬过去；④ 重来。对应和变换互相改进，误差单调下降。' },
      { k: '本步结果', v: st.phase === 'done'
        ? `收敛：累计旋转 ${st.cumRot}°(真 ${st.trueRot}°)、误差 ${st.error}≈0，两片点云重合`
        : st.op === 'iter'
          ? `本轮旋转 ${st.iterRot}°(累计 ${st.cumRot}°)，误差降到 ${st.error}`
          : '两片点云未对齐' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; iterNo: number; error: number }; return st.phase === 'done' ? '配准收敛' : st.iterNo > 0 ? `第${st.iterNo}轮 误差${st.error}` : '就绪'; },
    try: [{ act: '看对应先猜错再修正', watch: '初始没对齐，最近点对应会猜错几个(如两个源点都连到同一目标点)；随着源云转过去，对应越来越准。' }, { act: '看误差单调下降', watch: '误差 0.72→0.55→0.22→0.01，累计旋转还原真值 25°。ICP=猜对应+求变换反复迭代；依赖初值(差太多会陷局部最优)。' }], terms: [],
  },
  slam: {
    question: '机器人走一圈回到起点，为什么里程计以为自己在别处？回环怎么把整条轨迹拉正？',
    read: [{ at: '轨迹图', is: '真实回路(虚线)、里程计漂移轨迹(红,不闭合)、校正后轨迹(绿,闭合)。', anchor: '.fk-svg' }, { at: '读数', is: '进度、回环漂移、轨迹误差(校正前后)。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { phase: string; op: string; poseNo: number; odom: number[][]; drift: number[] | null; driftMag: number; errOdom: number; errCorr: number; focus: string }; return [
      { k: '本步输入', v: st.op === 'intro' ? '机器人沿八边形走一圈' : st.op === 'step' ? `走到位姿 ${st.poseNo}` : st.op === 'loopclose' ? '走完一圈，识别回环' : '位姿图优化' },
      { k: '判定规则', v: '里程计每步累积系统漂移→轨迹越走越偏、回不到起点。回环检测认出回到旧地→加约束"终点=起点"，缺口=累计漂移。位姿图优化把漂移按 i/N 分摊回整条轨迹→环闭合、误差抹平。' },
      { k: '本步结果', v: st.phase === 'done'
        ? `漂移分摊回去→环闭合，轨迹误差 ${st.errOdom}→${st.errCorr}`
        : st.op === 'loopclose'
          ? `终点≠起点，漂移 (${st.drift?.[0]}, ${st.drift?.[1]})、大小 ${st.driftMag}`
          : st.op === 'step'
            ? `里程计到 (${st.odom[st.odom.length - 1]?.[0]}, ${st.odom[st.odom.length - 1]?.[1]})，越走越偏`
            : '起点出发' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; poseNo: number; driftMag: number; errCorr: number }; return st.phase === 'done' ? `闭环 误差→${st.errCorr}` : st.phase === 'loopclose' ? `漂移 ${st.driftMag}` : st.poseNo > 0 ? `位姿 ${st.poseNo}` : '就绪'; },
    try: [{ act: '看里程计越走越偏', watch: '系统漂移每步累积，红线一步步偏离真实回路(虚线)，走完一圈终点停在 (2.45,0.82) 而非起点(0,0)——回环不闭合。' }, { act: '看回环校正拉正', watch: '识别回到起点→把 2.58 的漂移按位置比例分摊回整条轨迹→环闭合，绿线贴回真实回路，误差 1.26→0.25。这是 SLAM 精度的关键一跃。' }], terms: [],
  },
  impedance: {
    question: '机械臂去拧螺丝、打磨、和人协作，为什么不能只用位置控制？怎么让它"会用力"、柔顺接触？',
    read: [{ at: '轨道', is: '末端(块)、墙、目标、软弹簧；末端遇墙柔顺贴住。', anchor: '.fk-svg' }, { at: '接触力对比', is: '刚性(砸,红) vs 柔顺(贴,绿) 两条力条。', anchor: '.imp-cmp' }],
    step: (s: never) => { const st = s as { phase: string; op: string; xCmd: number; xWall: number; x: number; contactForce: number; penetration: number; stiffForce: number; t: number; focus: string }; return [
      { k: '本步输入', v: st.op === 'intro' ? `命令末端去 x=${st.xCmd}、墙在 x=${st.xWall}` : st.op === 'stiff' ? '刚性位置控制' : `阻抗控制 t=${st.t}s` },
      { k: '判定规则', v: '位置控制刚度高：为把位置误差压到 0 会死命顶墙、输出巨大接触力。阻抗控制让末端像虚拟弹簧+阻尼 F=K(x目标−x)−D·ẋ，遇阻柔顺让步；接触力≈K×侵入深度，K 你自己设。' },
      { k: '本步结果', v: st.op === 'stiff' ? `硬顶：接触力 ${st.stiffForce}N（砸），侵入墙 ${st.penetration}`
        : st.op === 'sample' || st.op === 'summary' ? `末端 ${st.x}${st.contactForce > 0 ? `，接触力 ${st.contactForce}N（柔顺）` : '（还没碰墙）'}${st.op === 'summary' ? `——刚性 ${st.stiffForce}N vs 柔顺 ${st.contactForce}N` : ''}`
          : '就绪' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; contactForce: number; stiffForce: number }; return st.phase === 'done' ? `柔顺 ${st.contactForce}N` : st.op === 'stiff' ? `刚性 ${st.stiffForce}N` : st.phase === 'compliant' ? '阻抗逼近' : '就绪'; },
    try: [{ act: '看刚性硬顶', watch: '位置控制命令去 x=8、墙挡在 x=5，剩 3 的位置误差消不掉→死命顶出 480N，砸坏工件。' }, { act: '看柔顺贴合', watch: '阻抗控制让末端像软弹簧被拉向目标、遇墙柔顺让步，接触力 settle 到 ~73N。接触力=K×侵入，K 是你设的旋钮——软就轻贴、对人安全。' }], terms: [],
  },
  mpc: {
    question: '质量块要精准停在目标(也是墙)，为什么反应式控制会冲过头？MPC 怎么"往前看"提前刹车？',
    read: [{ at: '位置图', is: 'MPC(绿,预测刹车停在目标) vs 反应式(红,冲过目标);当前步显示预测停点。', anchor: '.fk-svg' }, { at: '读数', is: '当前模式、位置、预测停点、反应式 vs MPC。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { phase: string; op: string; target: number; t: number; x: number; v: number; u: number; brakeDist: number; predStop: number; braking: boolean; reacMax: number; focus: string }; return [
      { k: '本步输入', v: st.op === 'intro' ? `质量块从 0 要停在目标 x=${st.target}` : st.op === 'reactive' ? '反应式(纯比例,无预测)' : `MPC t=${st.t}s：x=${st.x}、v=${st.v}` },
      { k: '判定规则', v: 'MPC 每步用模型预测未来一段、优化整条控制序列、只执行第一步、下步重规划。本例预测=刹车距离(照现在速度刹停要多远)→预测停点；预测停点够到目标就提前刹车，否则加速。反应式只看当前误差、无预测。' },
      { k: '本步结果', v: st.op === 'reactive' ? `无预测→冲过目标飙到 ${st.reacMax}（越界）`
        : st.op === 'sample' ? `预测停点 ${st.predStop} ${st.braking ? `≥目标→提前刹车(u=${st.u})` : `<目标→加速(u=${st.u})`}`
          : st.op === 'summary' ? `精准停在 x=${st.x}（目标 ${st.target}）；反应式冲到 ${st.reacMax}`
            : '就绪' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; x: number; reacMax: number; braking: boolean }; return st.phase === 'done' ? `MPC 停在 ${st.x}` : st.op === 'reactive' ? `反应式冲到 ${st.reacMax}` : st.phase === 'mpc' ? (st.braking ? 'MPC 刹车' : 'MPC 加速') : '就绪'; },
    try: [{ act: '看反应式冲过头', watch: '纯比例无预测，一路加速冲向目标，到跟前速度还很大刹不住→冲过目标 10 飙到 15.98（撞穿墙）。' }, { act: '看 MPC 预测刹车', watch: 'MPC 每步算"照现在速度刹停要多远"=预测停点，一旦预测停点够到目标就提前刹车→稳稳停在 9.94。这就是"往前看"，PID/阻抗做不到。' }], terms: [],
  },
  bc: {
    question: '让机器人照专家示范学开车，为什么小误差会滚成大祸、冲出车道？',
    read: [{ at: '轨迹图', is: '专家(绿,留道内) vs BC(红,漂出示范区→冲出车道)；示范区/车道边界。', anchor: '.fk-svg' }, { at: '读数', is: '滚动步、专家偏移、BC 偏移与状态。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { phase: string; op: string; shown: number; expertY: number; bcY: number; demoBound: number; roadBound: number; bcOff: boolean; bcCrashed: boolean; focus: string }; return [
      { k: '本步输入', v: st.op === 'intro' ? `车道保持，专家只在中线附近示范(|偏移|≤${st.demoBound})` : `第 ${st.shown} 步：扰动把车往外推` },
      { k: '判定规则', v: 'BC=把专家的状态→动作当回归拟合、一步监督。只在示范过的状态学得好；漂到没示范过的状态就欠修正→漂更远→错上加错(复合误差)。专家修正不封顶、能拉回。' },
      { k: '本步结果', v: st.phase === 'done'
        ? `专家稳在 ${st.expertY}(道内)；BC ${st.bcY}——冲出车道(>${st.roadBound})`
        : st.bcOff
          ? `专家 ${st.expertY}、BC ${st.bcY}（BC 已漂出示范区、欠修正、误差复合）`
          : `专家 ${st.expertY}、BC ${st.bcY}（都在示范区、几乎一样）` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; bcCrashed: boolean; bcOff: boolean; bcY: number }; return st.bcCrashed ? 'BC 冲出车道' : st.phase === 'done' ? 'BC 崩了' : st.bcOff ? `BC 漂出 ${st.bcY}` : '示范区内'; },
    try: [{ act: '看 BC 何时开始崩', watch: '第 2 步 BC 偏移越过示范边界 0.5 后，它没学过这些状态、欠修正、压不住扰动，每步再漂一点（复合误差）。' }, { act: '看专家为什么不崩', watch: '专家修正能力不封顶，偏移越大拉得越狠、稳在 0.66；BC 却一路漂到冲出车道 1.76。差别是"训练分布≠自己走出的分布"，靠 DAgger/纠错数据/VLA 海量数据补。' }], terms: [],
  },
  diffpolicy: {
    question: '绕障碍向左或向右都对，为什么 BC 会"取平均"直行撞上去？扩散策略怎么修？',
    read: [{ at: '动作轴', is: '双峰分布(±1)、BC 均值落 0(撞)、两个噪声样本去噪收敛到右/左模态。', anchor: '.fk-svg' }, { at: '读数', is: '当前、BC 均值、扩散样本 A/B。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { phase: string; op: string; bcAction: number; shown: number; aVal: number; bVal: number; focus: string }; return [
      { k: '本步输入', v: st.op === 'intro' ? '绕障动作是双峰：左(−1)或右(+1)' : st.op === 'bc' ? 'BC 回归拟合' : `扩散去噪第 ${st.shown} 步` },
      { k: '判定规则', v: 'BC 回归最小化均方误差→最优单点=均值=(−1+1)/2=0=直行→撞。Diffusion Policy 建整个动作分布(可多峰)，从噪声沿学到的能量去噪、落到某一个模态而非平均。' },
      { k: '本步结果', v: st.op === 'bc' ? `BC 均值 ${st.bcAction}(直行)→撞障碍`
        : st.op === 'step' ? `样本 A→${st.aVal}、B→${st.bVal}（往两个峰靠，不是往平均 0）`
          : st.op === 'summary' ? `A→${st.aVal}(右绕)、B→${st.bVal}(左绕)，都是有效解`
            : '双峰动作分布' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; shown: number }; return st.phase === 'done' ? '各落一模态' : st.op === 'bc' ? 'BC 平均成撞' : st.phase === 'denoise' ? `去噪 ${st.shown} 步` : '就绪'; },
    try: [{ act: '看 BC 为什么撞', watch: '回归的最优单点预测是均值；左(−1)和右(+1)一平均落到 0(直行)，正好撞障碍——加大网络也没用，是回归的结构缺陷。' }, { act: '看扩散去噪采样', watch: '两个样本从随机噪声出发、沿能量往最近的峰拉：A→+1(右绕)、B→−1(左绕)。不同噪声给不同模态=多解，都绕过障碍。这是 VLA 动作头用扩散的原因。' }], terms: [],
  },
  vla: {
    question: '一个机器人怎么吃"一张图 + 一句话"就直接干活？动作是怎么从大模型里"说出来"的？',
    read: [{ at: '流水线', is: '图像+指令→预训练VLM骨干→动作token→反解执行，逐段点亮。', anchor: '.vla-pipe' }, { at: 'token化表', is: '连续 Δpose 每维离散成格→token→反解。', anchor: '.vla-tok' }],
    step: (s: never) => { const st = s as { phase: string; op: string; instruction: string; tokens: number[]; novelObj: string; focus: string }; return [
      { k: '本步输入', v: st.op === 'intro' ? `指令「${st.instruction}」+ 场景图` : st.op === 'input' ? '图像(视觉token)+指令(文本token)' : st.op === 'backbone' ? '过预训练 VLM 骨干' : st.op === 'tokenize' ? '连续动作 Δpose' : st.op === 'execute' ? '生成的动作 token' : `换个没训过的物体「${st.novelObj}」` },
      { k: '判定规则', v: 'VLA=网络预训练视觉-语言大模型当骨干+动作输出+机器人示范微调。动作 token 化(RT-2)：连续 Δpose 每维按范围离散成 256 格→token，大模型像预测单词一样自回归生成，机器人端反解回位姿。骨干带网络知识→泛化到没训过的物体。' },
      { k: '本步结果', v: st.op === 'backbone' ? '骨干已懂"红/碗/放进"，理解出要把红积木放进碗'
        : st.op === 'tokenize' ? `Δpose → 动作 token [${st.tokens.join(', ')}]（和语言共用词表）`
          : st.op === 'execute' ? `自回归吐 token [${st.tokens.join(', ')}]→反解成 Δpose→机械臂执行`
            : st.op === 'generalize' ? `骨干在网络见过无数「${st.novelObj}」→直接接到动作、伸手去拿`
              : st.phase === 'done' ? 'VLA=通才机器人策略，把网络知识迁移到机器人' : '就绪' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string }; return st.phase === 'done' ? '通才策略' : st.op === 'tokenize' ? '动作token化' : st.op === 'backbone' ? 'VLM 骨干' : st.op === 'execute' ? '生成执行' : st.op === 'generalize' ? '泛化' : '就绪'; },
    try: [{ act: '看动作怎么 token 化', watch: '连续 Δpose 每维按范围离散成 256 格→token id，动作变成一串"词"[204,96,77,255]，大模型像预测单词一样吐出来、再反解回位姿。' }, { act: '看它为什么能泛化', watch: '换成「拿起紫色的杯子」——机器人数据里没有，但骨干在网络图文里见过无数紫色的、杯子→直接接到动作。这是"预训练大模型+少量机器人数据"的威力，BC 做不到。' }], terms: [],
  },
  lerobot: {
    question: '想自己动手搞一套会自主抓取的机械臂，从买硬件到部署要走哪几步？',
    read: [{ at: '工作流', is: '硬件→装配标定→采集→训练→部署，逐段点亮。', anchor: '.lr-flow' }, { at: '手臂仿真', is: '真算 FK 的 SO-101 手臂 + 方块 + 夹爪开合。', anchor: '.fk-svg' }],
    step: (s: never) => { const st = s as { phase: string; op: string; stageLabel: string; poseName: string; gripper: string; holding: boolean; armPts: number[][]; focus: string }; return [
      { k: '本步输入', v: st.op === 'intro' ? 'SO-101 硬件 + LeRobot 库' : st.op === 'pose' || st.op === 'summary' ? `部署执行：${st.poseName}` : `${st.stageLabel}` },
      { k: '判定规则', v: '全链路=模仿学习：装配标定(find-port/setup-motors/calibrate)→leader遥操follower采集≥50段示范(lerobot-record)→训练ACT策略(lerobot-train)→自主部署(lerobot-rollout)。部署段手臂位姿由四连杆正运动学从关节角现算(真实模拟引擎)。' },
      { k: '本步结果', v: st.op === 'pose' || st.op === 'summary'
        ? `${st.poseName}：夹爪${st.gripper === 'closed' ? '合' : '开'}${st.holding ? '、抓住方块' : ''}，末端 (${st.armPts[st.armPts.length - 1]?.join(', ')})`
        : `${st.stageLabel}：照真实命令走` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; holding: boolean; stageLabel: string }; return st.phase === 'done' ? '抓取成功' : st.holding ? '抓住方块' : st.stageLabel.replace(/^[①②③④⑤]\s*/, '').split(' ')[0] || '就绪'; },
    try: [{ act: '看全链路怎么走', watch: '装配标定→leader 遥操 follower 采集示范→lerobot-train 训 ACT→lerobot-rollout 自主执行。每步都有真实 CLI 命令，照着能搭。' }, { act: '看真算的抓取仿真', watch: '部署段手臂从 home→伸手→合爪→抬起，每帧位姿是四连杆正运动学现算的、方块抓住后跟夹爪走——这是"真实模拟引擎"，不是画的动画。' }], terms: [],
  },
  pid: {
    question: '让机器人关节停到目标角，为什么只用比例(P)会来回震荡？加个 D 项怎么就稳了？',
    read: [{ at: '位置曲线', is: '纯 P(红,冲过头震荡) 与 PD(绿,阻尼收敛) 对目标线(虚线)。', anchor: '.fk-svg' }, { at: '读数', is: '控制器、位置 vs 目标、误差 e、控制量 u=P(+D)。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { phase: string; op: string; mode: string; k: number; target: number; e: number; uP: number; uD: number; u: number; p: number; focus: string }; return [
      { k: '本步输入', v: st.phase === 'intro' ? '目标=10、被控对象是质量块' : st.op === 'switch' ? '纯 P 震荡 → 加 D 项' : `${st.mode === 'P' ? '纯 P' : 'PD'} 步 ${st.k}：当前误差 e=${st.e}` },
      { k: '判定规则', v: '每拍 e=目标−实际；P=Kp·e(误差越大越使劲推)、D=Kd·误差变化率(快到时反向刹车、阻尼)、I=Ki·误差累计(消稳态误差)。u=P+I+D 推质量块。纯 P 无阻尼→震荡；加 D 才稳。' },
      { k: '本步结果', v: st.phase === 'done'
        ? `PD 平稳收敛：位置 ${st.p}→目标 ${st.target}，不震荡（D 阻尼掉了）`
        : st.op === 'switch'
          ? '重跑：Kp 不变、加 Kd=0.9 提供阻尼'
          : st.mode === 'P'
            ? `u=P=${st.uP} → 位置 ${st.p}${st.p > st.target ? '（冲过目标 10！）' : ''}`
            : `P=${st.uP}、D=${st.uD}(刹车) → u=${st.u} → 位置 ${st.p}` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; mode: string; p: number; target: number }; return st.phase === 'done' ? 'PD 稳到目标' : st.op === 'switch' ? '加 D 项' : st.mode === 'P' ? (st.p > st.target ? '纯P冲过头' : '纯 P') : 'P+D'; },
    try: [{ act: '看纯 P 冲过头', watch: '纯 P 到目标时还有速度、刹不住 → 冲到 11.77 还在涨 → 来回震荡（红线）。质量块没有阻尼。' }, { act: '看 D 项刹车', watch: '加 D=Kd·误差变化率：快到目标时 D 变负(反向刹车)、提前减速，绿线平稳停在目标不震荡。' }], terms: [],
  },
  rrt: {
    question: '机器人要从起点绕开障碍走到终点，怎么在没有地图公式的情况下"探"出一条路？',
    read: [{ at: '世界+树', is: '障碍(灰)、起点(绿)、终点(橙)，树逐节点长出、绕障碍，到终点高亮路径。', anchor: '.fk-svg' }, { at: '读数', is: '树节点数、丢弃次数、路径段数。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { phase: string; op: string; nodes: unknown[]; sample: { x: number; y: number } | null; nearest: number; goalward: boolean; rejected: number; reason: string; path: number[] | null; focus: string }; return [
      { k: '本步输入', v: st.phase === 'intro' ? '起点、终点、中央障碍' : `随机采样 (${st.sample?.x}, ${st.sample?.y})${st.goalward ? '（朝终点）' : ''}` },
      { k: '判定规则', v: '找树上离采样点最近的节点，朝采样点迈一步 step。若这一步撞障碍/出界就丢弃；否则加为新节点、连边。够到终点就沿父指针回溯出路径。树朝空白蔓延、自动绕障碍。' },
      { k: '本步结果', v: st.phase === 'done'
        ? `节点#到终点！回溯出 ${st.path ? st.path.length - 1 : 0} 段路径（共 ${st.nodes.length} 节点、丢弃 ${st.rejected} 次）`
        : st.op === 'reject'
          ? `最近#${st.nearest} 迈一步 ${st.reason} → 丢弃（累计丢 ${st.rejected}）`
          : st.op === 'extend'
            ? `最近#${st.nearest} 迈一步没撞 → 加节点#${st.nodes.length - 1}（现 ${st.nodes.length} 节点）`
            : '树只有起点' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; nodes: unknown[]; path: number[] | null }; return st.phase === 'done' ? `${st.path ? st.path.length - 1 : 0} 段路径` : st.op === 'reject' ? '撞障碍丢弃' : st.op === 'extend' ? `树 ${st.nodes.length} 节点` : '就绪'; },
    try: [{ act: '看撞障碍就丢弃', watch: '朝障碍方向迈的步会撞矩形→丢弃(不加进树)；撞的方向长不出去，树只往空白蔓延，这就是自动避障。' }, { act: '看回溯出路径', watch: '有个节点够到终点圈就连上，沿父指针一路回溯到起点=路径。RRT 概率完备但不最优，路径歪、要平滑或用 RRT*。' }], terms: [],
  },
  topk: {
    question: '内存装不下全部计数，怎么求出现最多的 K 个？哈希分片和小顶堆各解决什么？',
    read: [{ at: '分片表', is: '各片的词→计数；同一个词只会在一片里。', anchor: '.tk-shards' }, { at: '小顶堆', is: 'K 个槽，堆顶(门槛)高亮；新词比门槛大才挤进来。', anchor: '.tk-heap' }],
    step: (s: never) => { const st = s as { phase: string; op: string; K: number; N: number; route: { word: string; shard: number; count: number } | null; heap: { word: string; count: number }[]; consider: { word: string; count: number } | null; evicted: { word: string; count: number } | null; threshold: number; topk: { word: string; count: number }[]; focus: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '分片+堆全走完' : st.route ? `路由词「${st.route.word}」(计数 ${st.route.count})` : st.consider ? `考察词「${st.consider.word}」(计数 ${st.consider.count})` : '准备' },
      { k: '判定规则', v: `哈希分片：hash(词)%${st.N} 确定→同词必同片、计数不被拆。小顶堆(大小 ${st.K})：堆顶=第 ${st.K} 大=门槛；新词 ≤ 门槛直接扔，> 门槛淘汰堆顶换上，O(㏒K)。` },
      { k: '本步结果', v: st.phase === 'done'
        ? `Top-${st.K} = ${st.topk.map(x => `${x.word}${x.count}`).join('、')}，门槛 ${st.threshold}`
        : st.route
          ? `「${st.route.word}」→ shard${st.route.shard}，计数 ${st.route.count}`
          : st.op === 'insert' ? `堆未满→放入，堆顶门槛=${st.threshold < 0 ? '未满' : st.threshold}`
          : st.op === 'replace' ? `${st.consider?.count} > 门槛 ${st.evicted?.count} → 淘汰「${st.evicted?.word}」，新门槛 ${st.threshold}`
          : st.op === 'skip' ? `${st.consider?.count} ≤ 门槛 ${st.threshold} → 扔` : '就绪' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; K: number; topk: { word: string }[]; threshold: number }; return st.phase === 'done' ? `Top-${st.K}: ${st.topk.map(x => x.word).join('>')}` : st.op === 'replace' ? '淘汰堆顶' : st.op === 'skip' ? '低于门槛扔' : st.phase === 'shard' ? '哈希分片' : st.phase === 'heap' ? `门槛 ${st.threshold < 0 ? '未满' : st.threshold}` : '就绪'; },
    try: [{ act: '看分片：同词同片', watch: 'hash(词) 确定，所以「苹果」每次都落同一片——计数不被拆到两片，独立统计才不出错。' }, { act: '看堆的淘汰与门槛', watch: '堆满后堆顶就是门槛(第 K 大)；橙子3>门槛1 淘汰梨，葡萄2/桃1≤门槛3 直接扔——大多数词一比就走。' }], terms: [],
  },
  seckill: {
    question: '库存 2 件、3 个请求同时抢，为什么 naive 扣库存会卖出 3 件？原子 DECR 怎么修？',
    read: [{ at: '并发请求', is: '三个请求各自读到的库存值 + 抢到/拒绝状态。', anchor: '.sk-reqs' }, { at: '读数', is: '当前库存(可为负)、卖出/库存、扣减方式。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { mode: string; stock: number; sold: number; initStock: number; oversold: boolean; focus: string; reqs: { id: string; local: number | null }[]; phase: string }; return [
      { k: '本步输入', v: st.mode === '' ? '开场：库存 2、3 个请求同抢' : `${st.mode === 'naive' ? 'naive 读改写' : '原子 DECR'} · ${st.focus}` },
      { k: '判定规则', v: 'naive：读库存→判>0→写回，三步非原子，并发读到同一旧值→各扣一次→超卖。原子 DECR：读判写合成一步，DECR 结果<0 就回滚拒绝。红线=卖出不得超过库存。' },
      { k: '本步结果', v: st.phase === 'done'
        ? `原子 DECR 跑完：卖出 ${st.sold}/${st.initStock}、库存 ${st.stock}，未超卖`
        : st.oversold
          ? `超卖！库存=${st.stock}、卖出=${st.sold}（只有 ${st.initStock} 件）`
          : `库存=${st.stock}、卖出=${st.sold}；各请求读到值 [${st.reqs.map(r => r.local === null ? '—' : r.local).join(', ')}]` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; oversold: boolean; mode: string; sold: number }; return st.oversold ? `超卖(卖出${st.sold})` : st.phase === 'done' ? '不超卖' : st.mode === 'naive' ? 'naive 扣减' : st.mode === 'atomic' ? '原子 DECR' : '就绪'; },
    try: [{ act: '盯 naive 幕的 R3', watch: 'R3 在 R2 写回前就读了库存、读到同一个旧值 → 两个请求都判"有货"都扣 → 库存变 -1、卖出 3。' }, { act: '对比原子 DECR 幕', watch: '同一批请求，第 3 个 DECR 结果 <0 → 回滚拒绝，卖出停在 2。防超卖=让扣库存原子化，不是靠限流/MQ。' }], terms: [],
  },
  minisearch: {
    question: '给一堆文档和一个查询，搜索引擎怎么排出"最相关"的几篇？',
    read: [{ at: '倒排索引', is: '词 → 出现在哪些文档(×词频)，逐篇读入后长出来。', anchor: '.ms-index' }, { at: '打分', is: '每个候选的 TF-IDF 得分条与排名。', anchor: '.ms-scores' }, { at: '读数', is: '阶段、倒排规模、候选、最相关。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { stage: string; focus: string; reading: string; index: unknown[]; query: string[]; candidates: string[]; idf: { term: string; df: number; idf: number }[]; scores: { id: string; score: number }[]; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '整条检索流水跑完' : st.reading ? `读入文档 ${st.reading}` : st.scores.length ? '候选打分' : st.idf.length ? '算各词 idf' : st.candidates.length ? '查倒排取候选' : st.query.length ? `收到查询「${st.query.join(' ')}」` : '准备语料' },
      { k: '判定规则', v: '建倒排索引(词→文档×词频)让查询不扫全库；打分 score=Σ tf×idf：tf=词在该文档出现次数(词频高更相关)，idf=ln(N/df)(词越稀有权重越高)。按分降序返回。' },
      { k: '本步结果', v: st.phase === 'done' ? `排序 ${st.scores.map(x => `${x.id}(${(Math.round(x.score * 100) / 100).toFixed(2)})`).join(' > ')}` : st.reading ? `倒排索引已含 ${st.index.length} 个词` : st.scores.length ? st.scores.map(x => `${x.id}=${(Math.round(x.score * 100) / 100).toFixed(2)}`).join(', ') : st.idf.length ? st.idf.map(r => `idf(${r.term})=${(Math.round(r.idf * 100) / 100).toFixed(2)}`).join(', ') : st.candidates.length ? `候选 {${st.candidates.join(', ')}}` : st.query.length ? `分词 [${st.query.join(', ')}]` : `${st.index.length} 词的倒排表待建` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; scores: { id: string }[]; stage: string }; return st.phase === 'done' ? `Top: ${st.scores[0]?.id ?? '—'}` : st.stage.replace(/^[①②③④⑤⑥⑦]\s*/, '') },
    try: [{ act: '看 D2 为什么第一', watch: '它只含一个查询词"狗"，但"狗"稀有(idf=1.10)，稀有词命中更相关。' }, { act: '看 D3 为什么超过 D1', watch: '都含"猫"，但"猫"在 D3 出现两次(tf=2)，词频高更相关。' }], terms: [],
  },
  minikv: {
    question: '把学过的零件拼起来，能造一个真能跑的数据库吗？',
    read: [{ at: '五个零件', is: 'WAL/memtable/SSTable/布隆四块 + 当前操作路径。', anchor: '.kv-grid' }, { at: '读数', is: '本步、memtable、SSTable、get 结果。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { op: string; key: string; val: number; memtable: [string, number][]; sstables: [string, number][][]; result: string; bloomHit: boolean; foundIn: string; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '一条 put/更新/get/压实跑完' : st.op === 'put' ? `写 put(${st.key}, ${st.val})` : st.op === 'update' ? `更新 ${st.key}=${st.val}` : st.op === 'get' ? `读 get(${st.key})` : st.op === 'flush' ? 'memtable 满，刷盘' : st.op === 'compact' ? '后台压实' : '开始' },
      { k: '判定规则', v: '写：先 WAL→memtable→满了刷 SSTable+入布隆；更新只**追加新版本**、旧值不动。读：问布隆→memtable→**从新到旧**查 SSTable(所以读到最新)。压实：归并 SSTable，同键只留最新、丢旧。' },
      { k: '本步结果', v: st.op === 'put' || st.op === 'update' ? `memtable=[${st.memtable.map(e => `${e[0]}=${e[1]}`).join(',')}]${st.op === 'update' ? '(a 追加新版本,旧 a=1 还在 SSTable)' : ''}` : st.op === 'get' ? (st.bloomHit ? `从新到旧查到 ${st.key}=**${st.result}**(在 ${st.foundIn})` : `布隆说一定不在→不查盘`) : st.op === 'flush' ? `刷成 SSTable${st.sstables.length}` : st.op === 'compact' ? `归并成 [${st.sstables[0]?.map(e => `${e[0]}=${e[1]}`).join(',')}]，旧 a=1 被丢` : '五零件就位' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; result: string }; return st.phase === 'done' ? 'KV跑通' : (st.op === 'get' ? (st.result || 'get') : st.op) },
    try: [{ act: '看更新 a=9', watch: '不改旧值，追加新版本；SST1 里 a=1、SST2 里 a=9 同时存在。' }, { act: '看 get(a) 和压实', watch: 'get 从新到旧读到 a=9；压实把旧的 a=1 归并丢掉。' }], terms: [],
  },
  reactagent: {
    question: '想→做→看的循环好写，难在"什么时候、怎么停"——它会不会跑飞 / 烧钱 / 白跑？',
    read: [{ at: '控制条', is: '步数预算 + stuck 窗口，循环拦不拦得住就看这俩。', anchor: '.ra-ctrl' }, { at: '轨迹', is: 'Thought/Action/Observation 一行行累积。', anchor: '.ra-trace' }, { at: '终止横幅', is: '停下来的原因（正常/重复/超预算/出错）。', anchor: '.ra-halt' }],
    step: (s: never) => { const st = s as { scenario: string; kind: string; round: number; text: string; tool: string; arg: string; obs: string; stepCount: number; budget: number; halt: string }; return [
      { k: '本步输入', v: st.kind === 'intro' ? `场景：${st.scenario}` : st.kind === 'thought' ? `第 ${st.round} 轮 · 想：${st.text}` : st.kind === 'action' ? `第 ${st.round} 轮 · 做：${st.tool}(${st.arg})` : st.kind === 'observation' ? `第 ${st.round} 轮 · 看：${st.obs || '（空）'}` : '终止判定' },
      { k: '判定规则', v: '循环每步：模型想→调工具(一步，计数)→看结果。终止 = ①模型不再发工具(正常) ②最近 3 步动作相同(stuck 检测) ③步数到预算上限 ④出错 autosubmit 交一版。stuck 和步数都现算。' },
      { k: '本步结果', v: st.halt === 'answer' ? `模型不再发工具 → 正常终止（用了 ${st.stepCount} 步）` : st.halt === 'stuck' ? `最近 3 步动作相同 → stuck 中止（第 ${st.stepCount} 步）` : st.halt === 'budget' ? `走满 ${st.budget} 步预算 → 超预算终止` : st.halt === 'error' ? '中途崩 → autosubmit 交一版' : st.kind === 'action' ? `第 ${st.stepCount}/${st.budget} 步，进 stuck 窗口` : st.kind === 'observation' ? `拿到「${st.obs || '空'}」→ 下一轮` : st.kind === 'thought' ? '决定下一步动作' : `场景 ${st.scenario}，看它怎么停` },
    ] },
    verdict: (s: never) => { const st = s as { halt: string; kind: string; stepCount: number; scenario: string }; return st.halt === 'answer' ? '正常终止' : st.halt === 'stuck' ? 'stuck 中止' : st.halt === 'budget' ? '超预算停' : st.halt === 'error' ? 'autosubmit' : st.kind === 'action' ? `第 ${st.stepCount} 步` : st.kind === 'thought' ? '想' : st.kind === 'observation' ? '看' : `场景 ${st.scenario}` },
    try: [{ act: '切「重复」场景', watch: '模型一直 search 同一个，最近 3 步动作全相同 → stuck 检测中止，没无限跑下去。' }, { act: '切「超预算」场景', watch: '一直不收敛，走满 6 步撞预算 → 停、交 best-effort，别烧爆算力。' }], terms: [],
  },
  ctxcompact: {
    question: 'Agent 会话越聊越长、上下文窗口迟早爆——怎么在不丢关键信息的前提下把它压回去？',
    read: [{ at: '计量条', is: '累计 token vs 窗口，竖线是压缩阈值。', anchor: '.cc-gauge' }, { at: '消息列表', is: '每条按区域染色：留头/中间/留尾/已剪/摘要。', anchor: '.cc-list' }, { at: '读数', is: '累计 token、阈值、省了多少。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { stage: string; running: number; threshold: number; before: number; strategy: string; N: number; relievedByPrune: boolean; meter?: { est: number; real: number } }; return [
      { k: '本步输入', v: ({ full: `一段会话共 ${st.before} tokens、窗口 ${st.N}`, partition: '把历史切成 头/中/尾', prune: '中间的超大工具结果', compress: `压中间（${st.strategy}）`, rebuild: '头 + 压过的中间 + 尾' } as Record<string, string>)[st.stage] ?? '' },
      { k: '判定规则', v: '会话超过 窗口×阈值 就压 → 留头(系统+首任务)+留最近(retainRatio=0.16，不拆 call/result 对)+压中间 → 先剪超大工具输出，够了就停，否则总结(有损)或省略(全丢)。原始日志不删。' },
      { k: '本步结果', v: ({ full: `${st.before} tokens ≥ 阈值 ${st.threshold}，得压缩`, partition: '头钉住、尾原样、中间待压', prune: st.relievedByPrune ? `剪到 ${st.running} < 阈值，免总结` : `剪到 ${st.running}，仍超`, compress: `压到 ${st.running} tokens`, rebuild: `${st.before}→${st.running}，省 ${st.before - st.running}` } as Record<string, string>)[st.stage] ?? '' },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; running: number; threshold: number; strategy: string; relievedByPrune: boolean }; return st.stage === 'rebuild' ? `压缩完成 ${st.running}t` : st.stage === 'compress' ? `压中间·${st.strategy}` : st.stage === 'prune' ? (st.relievedByPrune ? '剪够了' : '剪超大输出') : st.stage === 'partition' ? '分区·头/中/尾' : `满了 ${st.running}≥${st.threshold}` },
    try: [{ act: '把「压中间」切成省略', watch: '总结换成一行 [已省略]：token 更少，但中间全丢了——省钱 vs 记得住的取舍。' }, { act: '把阈值调到 0.9', watch: '光剪超大工具输出就落回阈值下，免了总结那次模型调用——先上最便宜的一招。' }], terms: [],
  },
  toolcall: {
    question: '模型发的工具调用，harness 怎么把它变成真结果，还不被一个坏调用搞崩整个循环？',
    read: [{ at: '流水线', is: '解析→门禁→执行→回灌，当前调用走到哪、卡在哪。', anchor: '.tc-pipe' }, { at: '历史', is: '回灌给模型的调用/结果配对，错误红色标出。', anchor: '.tc-hist' }, { at: '读数', is: '进度、本调用结局、已回灌几条。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { stage: string; cur: number; call?: { name: string; raw: string; result: string }; outcome: string; total: number }; return [
      { k: '本步输入', v: st.cur < 0 ? `模型发的 ${st.total} 个工具调用` : `调用 ${st.cur + 1}/${st.total}：${st.call?.name || '(malformed)'} — ${st.call?.raw ?? ''}` },
      { k: '判定规则', v: '解析(取 name/参数，不合法→PARSE_ERROR)→门禁(未知工具→UNKNOWN_TOOL；危险操作→DENY)→执行(带超时)→回灌(结果或错误，当 tool_result 配对喂回)。出错不抛异常终止循环。' },
      { k: '本步结果', v: st.cur < 0 ? `${st.total} 个待逐个处理` : st.outcome === 'ok' ? `${st.call?.name} 执行✓${st.call?.result ? ' → ' + st.call.result : ''}，结果配对回灌` : st.outcome === 'denied' ? '门禁拒绝，错误当结果回灌（循环不中断）' : st.outcome === 'unknown' ? '未知工具，错误回灌（循环不中断）' : '解析失败，错误回灌（循环不中断）' },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; cur: number; outcome: string; total: number; history: { ok: boolean }[] }; return st.stage === 'done' ? `${st.history.filter(h => h.ok).length}成/${st.history.filter(h => !h.ok).length}败·循环不断` : st.cur < 0 ? `发出 ${st.total} 个` : st.outcome === 'ok' ? '执行·回灌' : st.outcome === 'denied' ? '门禁拒绝' : st.outcome === 'unknown' ? '未知工具' : '解析失败' },
    try: [{ act: '看错误怎么处理', watch: '第 3/4/5 个调用失败（拒绝/未知/解析错），但都变成 error 结果喂回、循环没断——模型能重试。' }, { act: '看 calc 真执行', watch: '第 2 个 calc(1234*5678) 由引擎真算出 7006652，不是写死。' }], terms: [],
  },
  permguard: {
    question: '模型想跑 rm -rf 或联网，harness 凭什么决定放不放行，又不误伤正常操作？',
    read: [{ at: '决议流水线', is: '定性→规则→沙箱→结局，当前操作走到哪、卡在哪。', anchor: '.pg-pipe' }, { at: '历史', is: '每个操作的判决，拒绝红/升级黄/放行绿。', anchor: '.pg-hist' }, { at: '读数', is: '模式、本操作结局、已判几个。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { stage: string; cur: number; mode: string; op?: { cmd: string; eLabel: string }; res?: { rule: string; sandbox: string; final: string; fLabel: string }; total: number }; return [
      { k: '本步输入', v: st.cur < 0 ? `模型想跑的 ${st.total} 个操作（模式 ${st.mode}）` : `操作 ${st.cur + 1}/${st.total}：${st.op?.cmd}（${st.op?.eLabel}）` },
      { k: '判定规则', v: '两道相互独立的墙：①规则/审批 deny→ask→allow，首次匹配即生效；②沙箱物理隔离、fail-closed(网络默认关、写只在工作区内)。两墙都过才真跑；越权=带理由申请+一次人工批准的一次性升级。模式决定"写"要不要问。' },
      { k: '本步结果', v: st.cur < 0 ? `${st.total} 个待逐个判` : `${st.res?.fLabel}（${st.res?.rule === 'deny' ? 'deny 规则首次匹配即拦' : st.res?.sandbox === 'block' ? '沙箱 fail-closed 拦' : st.res?.sandbox === 'escalate' ? '越界→一次性升级' : '两墙都过'}）` },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; cur: number; res?: { final: string }; mode: string; total: number; history: { final: string }[] }; return st.stage === 'done' ? `${st.history.filter(h => h.final !== 'blocked').length}跑/${st.history.filter(h => h.final === 'blocked').length}拦` : st.cur < 0 ? `${st.mode}·${st.total} 待判` : st.res?.final === 'blocked' ? '拒绝' : st.res?.final === 'escalate-run' ? '升级放行' : st.res?.final === 'ask-run' ? '问过放行' : '放行' },
    try: [{ act: '把模式切成「放行」', watch: 'edit/rm 都放行了——但 curl 还是被沙箱拦住：两道墙相互独立，跳过审批也过不了沙箱。' }, { act: '把模式切成「计划」', watch: '所有写(edit/rm/写外)都拒，只有 read 能跑——计划=只读探查。' }], terms: [],
  },
  subagent: {
    question: '复杂任务派给子 agent，怎么既省父的上下文、又不让子生子把配额炸光？',
    read: [{ at: 'token 账本', is: '子内部干的活 vs 回传给父，差=省下的。', anchor: '.sa-ledger' }, { at: '委派树', is: '父→子的树，按深度缩进。', anchor: '.sa-tree' }, { at: '守卫', is: '深度 / 并发上限。', anchor: '.sa-guards' }],
    step: (s: never) => { const st = s as { stage: string; cur: string; nodes: { id: string; name: string; depth: number; internalTok: number; returnTok: number }[]; parentCtx: number; internalTotal: number; returnTotal: number; depthCap: number }; const n = st.nodes.find(x => x.id === st.cur); return [
      { k: '本步输入', v: st.stage === 'intro' ? `父任务，起始上下文 ${st.parentCtx}t` : st.stage === 'blocked' ? '子想在深度上限处再派子 agent' : st.stage === 'done' ? '汇总账本' : n ? `派子 agent「${n.name}」(深度 ${n.depth})` : '派子 agent' },
      { k: '判定规则', v: '子在独立上下文里探索、只把最终结论回传给父(省父的 token)；深度上限(maxDepth 3，到顶摘 spawn 工具)+并发上限防 fork 炸弹；只回传结果非整条轨迹；子权限不可自扩、崩了不连累父。' },
      { k: '本步结果', v: st.stage === 'blocked' ? `深度已达 ${st.depthCap}，spawn 工具被摘 → 拦下（防 fork 炸弹）` : st.stage === 'done' ? `子内部共 ${st.internalTotal}t，父只涨 ${st.returnTotal}t，省 ${st.internalTotal - st.returnTotal}t` : n ? `内部花 ${n.internalTok}t、只回传 ${n.returnTok}t → 父省 ${n.internalTok - n.returnTok}t（父现 ${st.parentCtx}t）` : `父 ${st.parentCtx}t` },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; cur: string; internalTotal: number; returnTotal: number }; return st.stage === 'done' ? `省 ${st.internalTotal - st.returnTotal}t` : st.stage === 'blocked' ? '深度上限拦下' : st.cur ? `派 ${st.cur}` : '待派' },
    try: [{ act: '切「承接(fork)」', watch: '子起始从空白 10t 变成承接父前缀 120t——有上下文续得上，但更贵；只回传结果这条不变。' }, { act: '看深度守卫', watch: 'B1a 在深度 3 想再往下派 → spawn 工具被摘、拦下，防子生子指数爆炸。' }], terms: [],
  },
  memretrieve: {
    question: '记忆一大堆、上下文塞不下，查询来了该捞哪几条进上下文？凭什么排序？',
    read: [{ at: '打分公式', is: '得分 = w·最近 + w·相关 + w·重要。', anchor: '.mr-formula' }, { at: '记忆表', is: '每条的三信号 + 得分，排序后 top-k 高亮捞回。', anchor: '.mr-table' }, { at: '读数', is: '权重、查询、捞回哪几条。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { stage: string; weights: string; wr: number; wl: number; wi: number; topK: number; mems: { id: string; retrieved: boolean; score: number }[] }; const top = st.mems.filter(m => m.retrieved).map(m => m.id); return [
      { k: '本步输入', v: st.stage === 'intro' ? `${st.mems.length} 条记忆 + 一个查询` : st.stage === 'signals' ? '每条记忆算三个信号' : st.stage === 'score' ? `加权求分（权重 ${st.weights}）` : st.stage === 'rank' ? `按得分排序，取 top-${st.topK}` : '捞回的记忆集' },
      { k: '判定规则', v: `得分 = w_rec·最近度(decay^龄) + w_rel·相关度(余弦) + w_imp·重要度(LLM 1~10)，排序取 top-${st.topK}。权重不同(论文 1·1·1 / GA 代码 0.5·3·2)排名就不同。` },
      { k: '本步结果', v: st.stage === 'intro' ? `${st.mems.length} 条待打分` : st.stage === 'signals' ? '三信号各说各话：有的很新但不相关、有的很重要但不相关' : st.stage === 'score' ? `得分算出（权重 ${st.weights}：${st.wr}·${st.wl}·${st.wi}）` : st.stage === 'rank' ? `top-${st.topK}：${top.join(' / ')} 被捞回` : `捞回 ${top.length} 条进上下文（${top.join('/')}）` },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; weights: string; mems: { retrieved: boolean; id: string }[] }; return st.stage === 'done' || st.stage === 'rank' ? `捞 ${st.mems.filter(m => m.retrieved).map(m => m.id).join('/')}` : st.stage === 'score' ? `加权·${st.weights}` : st.stage === 'signals' ? '三信号' : '查询来了' },
    try: [{ act: '切「重相关」', watch: 'm3「用户是 VIP」相关度只 0.2，相关权重一大(0.5·3·2)就落榜，m2「JWT」顶上来。' }, { act: '切「重时新」', watch: '最近的记忆被拉上来，哪怕没那么相关——recency 权重大的代价。' }], terms: [],
  },
  mempaging: {
    question: '上下文窗口有限、装不下所有历史，MemGPT 怎么像操作系统那样管内存？',
    read: [{ at: 'RAM 水位', is: '主上下文用量，越过 70% 触发内存压力。', anchor: '.mp-bar' }, { at: 'RAM/磁盘两栏', is: '左 RAM 的槽 + 右磁盘的 recall/archival。', anchor: '.mp-cols' }, { at: '换页操作', is: '换出(驱逐)/换入(调回)。', anchor: '.mp-op' }],
    step: (s: never) => { const st = s as { stage: string; ramUsed: number; N: number; warnAt: number; recall: unknown[] }; return [
      { k: '本步输入', v: st.stage === 'intro' ? 'RAM(系统+工作记忆) + 磁盘(recall/archival)' : st.stage === 'fill' ? '消息陆续进 FIFO 队列' : st.stage === 'pressure' ? `RAM ${st.ramUsed} vs 警告线 ${st.warnAt}` : st.stage === 'evict' ? '驱逐最老的消息' : st.stage === 'pagein' ? '需要一条已驱逐的旧信息' : '汇总' },
      { k: '判定规则', v: `上下文=RAM、外部=磁盘。RAM 到窗口 70%(${st.warnAt}) 触发内存压力 → 驱逐 ~50% 老消息到 recall + 写递归摘要回队首(换出)；需要旧信息 → 检索追加到队尾(缺页换入)。就是页面置换/缺页。` },
      { k: '本步结果', v: st.stage === 'intro' ? `RAM ${st.ramUsed}/${st.N}` : st.stage === 'fill' ? `RAM 涨到 ${st.ramUsed}，越过 ${st.warnAt} 警告线` : st.stage === 'pressure' ? `${st.ramUsed} ≥ ${st.warnAt}(70%)，插内存压力警告` : st.stage === 'evict' ? `驱逐 3 条→recall(磁盘)、写递归摘要，RAM 降到 ${st.ramUsed}` : st.stage === 'pagein' ? `从 recall 检索调回队尾，RAM ${st.ramUsed}` : `换页完成，RAM ${st.ramUsed}/${st.N}` },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; ramUsed: number; warnAt: number }; return st.stage === 'done' ? '换页完成' : st.stage === 'pagein' ? '缺页调回' : st.stage === 'evict' ? '驱逐换出' : st.stage === 'pressure' ? `压力 ${st.ramUsed}≥${st.warnAt}` : st.stage === 'fill' ? `填到 ${st.ramUsed}` : 'RAM/磁盘' },
    try: [{ act: '看驱逐那步', watch: 'RAM 从 77 降到 49：3 条老消息进 recall(磁盘)，队首多了一条递归摘要——就是页面换出。' }, { act: '对照 408 页面置换', watch: 'RAM=物理内存、recall=磁盘、驱逐=换出、检索调回=缺页调入——同一套算法，页换成了对话。' }], terms: [],
  },
  reflection: {
    question: '光存一堆零散观察不够——agent 怎么把它们消化成"用户是个后端工程师"这种高层理解？',
    read: [{ at: '累计条', is: '最近观察的重要度之和，过阈值就反思。', anchor: '.rf-cum' }, { at: '观察流', is: '原始观察(带重要度)，被反思的高亮。', anchor: '.rf-obs' }, { at: '洞察', is: '提炼出的高层洞察 + 引用的证据。', anchor: '.rf-insight' }],
    step: (s: never) => { const st = s as { stage: string; threshold: number; cum: number; insight: { text: string; evidence: string[] } | null }; return [
      { k: '本步输入', v: st.stage === 'intro' ? '一串零散的原始观察' : st.stage === 'observe' ? '观察陆续进记忆流、重要度累积' : st.stage === 'trigger' ? `累计重要度 ${st.cum} vs 阈值 ${st.threshold}` : st.stage === 'reflect' ? '就最近观察提炼洞察' : '巩固完成' },
      { k: '判定规则', v: `最近观察的重要度之和 ≥ 阈值(论文约 150、本例 ${st.threshold}) → 触发反思；LLM 综合观察成洞察并引用证据；洞察当高重要度新记忆入库、可再被更高层反思(反思树)。` },
      { k: '本步结果', v: st.stage === 'intro' ? '待累积、消化' : st.stage === 'observe' ? `累计到 ${st.cum}` : st.stage === 'trigger' ? `${st.cum} ≥ ${st.threshold}，触发反思` : st.stage === 'reflect' && st.insight ? `提炼：「${st.insight.text.replace(/\*/g, '')}」，引用 ${st.insight.evidence.join('/')}` : st.insight ? `${st.insight.evidence.length} 条观察 → 1 条洞察` : '—' },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; cum: number; threshold: number; insight: unknown }; return st.stage === 'done' ? '洞察入库' : st.stage === 'reflect' ? '提炼洞察' : st.stage === 'trigger' ? `触发 ${st.cum}≥${st.threshold}` : st.stage === 'observe' ? `累计 ${st.cum}` : '待反思' },
    try: [{ act: '切「敏感」阈值', watch: '阈值 10，攒到第 3 条(累计 11)就触发反思——反思更勤、洞察更碎。' }, { act: '切「迟钝」阈值', watch: '阈值 20，攒到第 5 条才触发——攒够一大批才消化一次。' }], terms: [],
  },
  memwrite: {
    question: '新信息来了，往长期记忆里怎么写，才不会"住北京"和"搬上海了"自相矛盾？',
    read: [{ at: '新事实', is: '本步进来的事实 + 检索到的相似旧记忆 + 决定的操作。', anchor: '.mw-fact' }, { at: '记忆库', is: '每条记忆，刚被操作的按 ADD/UPDATE/DELETE 变色，陈旧矛盾的划掉。', anchor: '.mw-store' }, { at: '读数', is: '模式、库大小、陈旧条数。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { stage: string; mode: string; fact: string; similar: string; op: string; store: { stale?: boolean }[] }; const stale = st.store.filter(m => m.stale).length; return [
      { k: '本步输入', v: st.stage === 'intro' ? `已有记忆库 + ${st.mode} 模式` : `新事实「${st.fact}」，检索相似：${st.similar || '无'}` },
      { k: '判定规则', v: '每条新事实先检索最相似旧记忆，再决定：ADD(无相似→新建)/UPDATE(补充修正)/DELETE(与旧矛盾→删旧)/NOOP(已知道→不动)。单遍模式一律 ADD、只加不改。' },
      { k: '本步结果', v: st.stage === 'intro' ? '待逐条写入' : st.op === 'ADD' ? (st.mode === '单遍' && st.similar ? `单遍只 ADD：新增、和 ${st.similar} 并存(矛盾没消解)` : 'ADD 新建一条') : st.op === 'UPDATE' ? `UPDATE 修正 ${st.similar}` : st.op === 'DELETE' ? `DELETE 删掉矛盾的 ${st.similar}` : st.op === 'NOOP' ? `NOOP 不动(${st.similar} 已知道)` : `库 ${st.store.length} 条${stale ? `、${stale} 条陈旧` : ''}` },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; op: string; store: { stale?: boolean }[] }; const stale = st.store.filter(m => m.stale).length; return st.stage === 'done' ? (stale ? `${stale} 条陈旧矛盾` : '库自洽') : st.op ? `${st.op}` : '待写入' },
    try: [{ act: '看四步各操作', watch: '养猫=ADD、Python3.12=UPDATE 改旧、戒咖啡=DELETE 删旧、又提北京=NOOP——库始终自洽。' }, { act: '切「单遍」模式', watch: '全都 ADD、只加不改：美式咖啡 vs 戒咖啡、3.10 vs 3.12 并存，陈旧矛盾越积越多。' }], terms: [],
  },
  planning: {
    question: 'Agent 怎么"先想后做"、又不在长任务里跑偏？计划模式是真门禁还是走过场？',
    read: [{ at: '计划模式门', is: '只读锁定 / 已解锁；写被门禁挡下会标红。', anchor: '.pl-gate' }, { at: 'Todo', is: '状态机，恰好一个进行中，新插入的虚线标出。', anchor: '.pl-todos' }, { at: '复述', is: '整张 todo 贴回近端(注意力操控)。', anchor: '.pl-recite' }],
    step: (s: never) => { const st = s as { stage: string; mode: string; planMode: boolean; writeBlocked: boolean; todos: { status: string }[] }; const done = st.todos.filter(t => t.status === 'done').length; return [
      { k: '本步输入', v: st.stage === 'intro' ? `复杂任务 + 计划模式(${st.mode})` : st.stage === 'planning' ? '只读探查、拟 todo，并试图写' : st.stage === 'exit' ? '人批准了计划' : st.stage === 'exec' ? '按 todo 推进' : st.stage === 'replan' ? '执行中发现计划没料到的依赖' : '收尾' },
      { k: '判定规则', v: '计划模式=硬门禁(权限层强制"批准前只读"，Claude Code)或软建议(工具照调，DeepSeek)；Todo 状态机 pending→in_progress→completed、恰一个进行中；每轮复述整表到近端防漂移；现实岔开就重规划(整表替换)。' },
      { k: '本步结果', v: st.stage === 'intro' ? '进入计划模式(只读)' : st.stage === 'planning' ? (st.writeBlocked ? '拟出 4 项 todo；想写 → 被硬门禁挡下' : '拟出 4 项 todo；想写 → 建议模式放行(不拦)') : st.stage === 'exit' ? '批准 → 退出计划模式、写解锁' : st.stage === 'exec' ? `t1✓、t2 进行中(恰一个)；整表复述到近端` : st.stage === 'replan' ? '发现 auth.py 依赖 session.py → 重规划、插一项(共 5)' : `${done}/${st.todos.length} 完成` },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; planMode: boolean; writeBlocked: boolean }; return st.stage === 'done' ? '计划走完' : st.stage === 'replan' ? '重规划' : st.stage === 'exec' ? '推进+复述' : st.stage === 'exit' ? '写解锁' : st.stage === 'planning' ? (st.writeBlocked ? '门禁挡写' : '计划中') : '进计划模式' },
    try: [{ act: '切「建议」模式', watch: '计划模式里想写不再被挡——软建议 vs Claude Code 的硬门禁(批准前权限层堵死写)。' }, { act: '看复述那步', watch: '每轮把整张 todo 贴回上下文近端——不是记账，是把计划推回近端注意力、对抗 lost-in-the-middle。' }], terms: [],
  },
  promptbuild: {
    question: 'Agent 每步都重拼 prompt，怎么排能让前缀命中缓存、省 90% 的钱？',
    read: [{ at: '各段', is: '按 tools→system→messages 排，缓存断点分隔可缓存前缀(绿)与动态尾部(黄)。', anchor: '.pb-secs' }, { at: '成本', is: '第2轮：前缀命中缓存 vs 全价。', anchor: '.pb-cost' }, { at: '读数', is: '排序、前缀、省多少。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { stage: string; ordering: string; prefixTok: number; tailTok: number; turn2Cached: number; turn2Full: number }; const save = Math.round((1 - st.turn2Cached / st.turn2Full) * 100); return [
      { k: '本步输入', v: st.stage === 'intro' ? `6 段 + 排序方式(${st.ordering})` : st.stage === 'assemble' ? '按 tools→system→messages 排、定断点' : st.stage === 'turn1' ? '第 1 轮（缓存空）' : st.stage === 'turn2' ? '第 2 轮（历史涨、来新消息）' : '汇总' },
      { k: '判定规则', v: '前缀缓存是最长相同前缀匹配(tools→system→messages 到断点)；断点前变一处、缓存全废；缓存读只 0.1× 基础价。静态排前、动态排后、断点放逐轮不变的最后一块。' },
      { k: '本步结果', v: st.stage === 'intro' ? '待排序' : st.stage === 'assemble' ? `可缓存前缀 ${st.prefixTok}t、动态尾部 ${st.tailTok}t` : st.stage === 'turn1' ? `前缀 ${st.prefixTok}t 写入缓存(1.25×)` : st.stage === 'turn2' ? `前缀命中缓存(0.1×)→等效 ${st.turn2Cached}t vs 全价 ${st.turn2Full}t、省 ${save}%` : `${st.ordering}：省 ${save}%` },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; prefixTok: number; turn2Cached: number; turn2Full: number }; return st.stage === 'done' || st.stage === 'turn2' ? `省 ${Math.round((1 - st.turn2Cached / st.turn2Full) * 100)}%` : st.stage === 'turn1' ? '写缓存' : st.stage === 'assemble' ? `前缀 ${st.prefixTok}t` : '待排序' },
    try: [{ act: '切「乱序」', watch: '把逐轮变的"运行时快照"塞进 system(靠前)→缓存从这断，只剩工具 40t 能缓存，省得少(21% vs 44%)。' }, { act: '想想为什么静态排前', watch: '前缀缓存要"最长相同前缀"——静态的排前面、前缀才又长又稳，命中的 token 才多。' }], terms: [],
  },
  actte: {
    question: '机械臂按模仿学到的策略动，怎么不抖、不越走越偏（复合误差）？',
    read: [{ at: '重叠预测', is: '同一动作被好几块预测到 + 各自权重。', anchor: '.at-votes' }, { at: '轨迹', is: '真值 / 只用最新(抖) / 时序集成(平滑)。', anchor: '.at-traj' }, { at: '读数', is: '块长、权重、集成 vs 最新。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { stage: string; K: number; detailT: number; votes: { val: number }[]; ensembled: number; newest: number; trajTrue: number[]; m: number }; return [
      { k: '本步输入', v: st.stage === 'intro' ? `模仿策略 + 权重 m=${st.m}` : st.stage === 'chunk' ? `一次观测预测 K=${st.K} 个动作` : st.stage === 'overlap' ? `动作 a${st.detailT} 的 ${st.votes.length} 条重叠预测` : st.stage === 'ensemble' ? '加权集成这些重叠预测' : st.stage === 'traj' ? '整条轨迹' : '收尾' },
      { k: '判定规则', v: `动作分块:一次预测 K 个、有效时域 T→T/K(治复合误差)。时序集成:每步重预测→同一动作多块重叠→加权平均，权重 w_i=exp(-m·i)、i=0 最旧，a_t=Σw·P/Σw。` },
      { k: '本步结果', v: st.stage === 'intro' ? '待分块、集成' : st.stage === 'chunk' ? `预测出一整块、有效时域砍到 1/${st.K}` : st.stage === 'overlap' ? `${st.votes.length} 条不一致(${Math.min(...st.votes.map(v => v.val))}~${Math.max(...st.votes.map(v => v.val))})、只看最新会抖` : st.stage === 'ensemble' ? `a${st.detailT} 集成=${st.ensembled}(只用最新=${st.newest}、真值≈${st.trajTrue[st.detailT]})` : st.stage === 'traj' ? '集成轨迹更平滑、更贴真值' : '分块砍时域、集成抹抖动' },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; ensembled: number; votes: unknown[] }; return st.stage === 'done' ? '分块+集成' : st.stage === 'traj' ? '集成平滑' : st.stage === 'ensemble' ? `集成=${st.ensembled}` : st.stage === 'overlap' ? `${st.votes.length}块重叠` : st.stage === 'chunk' ? '分块预测' : '待跑' },
    try: [{ act: '切「重旧」权重', watch: 'm=0.7：最旧那条权重最大(1)、新的被压很低，集成明显偏向旧预测。' }, { act: '看集成 vs 最新', watch: '只用最新那条会抖([31,34,43,41,35,29])，集成把重叠预测平均、平滑贴真值。' }], terms: [],
  },
  deltats: {
    question: '策略要的不是单帧、是一段"历史观测/未来动作块"，怎么从扁平表里把这些帧取出来、还不越到别条轨迹？',
    read: [{ at: 'episode 条', is: '本轨迹的帧范围 + 当前采样帧。', anchor: '.dt-ep' }, { at: '两窗口表', is: '观测/动作块，每行 秒→帧偏移→目标帧→取到帧→pad。', anchor: '.dt-table' }, { at: '读数', is: 'fps、episode、pad 数。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { stage: string; fps: number; absIdx: number; epStart: number; epEnd: number; obs: { pad: boolean }[]; act: { pad: boolean }[] }; const pads = st.obs.filter(c => c.pad).length + st.act.filter(c => c.pad).length; return [
      { k: '本步输入', v: st.stage === 'intro' ? `当前帧 ${st.absIdx}、episode [${st.epStart},${st.epEnd})、fps=${st.fps}` : st.stage === 'sec2idx' ? '各偏移(秒)' : st.stage === 'clamp' ? '目标帧 = 当前帧 + 帧偏移' : st.stage === 'pad' ? '哪些帧落在 episode 外' : '取出的窗口' },
      { k: '判定规则', v: `delta_idx=round(偏移·fps=${st.fps})；目标帧=当前帧+delta；query=clamp(目标帧, ${st.epStart}, ${st.epEnd - 1})；is_pad=(目标帧落在[${st.epStart},${st.epEnd})外)、喂 loss 排除。` },
      { k: '本步结果', v: st.stage === 'intro' ? '待取一段时序窗口' : st.stage === 'sec2idx' ? `秒×fps 取整成帧偏移(如 -0.06s→-3 帧)` : st.stage === 'clamp' ? '越出本 episode 的钳到边界帧' : st.stage === 'pad' ? `${pads} 个越界帧标 pad=True(喂 loss 排除)` : 'ACT 动作块=range(K)，就这么取' },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; obs: { pad: boolean }[]; act: { pad: boolean }[] }; return st.stage === 'done' ? '窗口取出' : st.stage === 'pad' ? `${st.obs.filter(c => c.pad).length + st.act.filter(c => c.pad).length}个pad` : st.stage === 'clamp' ? '边界钳' : st.stage === 'sec2idx' ? '秒→帧' : '待取' },
    try: [{ act: '切「靠开头」', watch: '当前帧 102 靠 episode 起点：历史观测往回 -3 帧 = 99 越界 → 钳到 100、标 pad。' }, { act: '切「靠结尾」', watch: '当前帧 158 靠终点：未来动作块 +2/+3/+4 帧越过 160 → 钳到 159、标 pad(3 个)。' }], terms: [],
  },
  normstats: {
    question: '一条样本里关节角到 ±3、夹爪 0~1、还有个离群力矩，量纲天差地别——怎么把它们拉到同一量级，喂进策略又还能还原？',
    read: [{ at: '原始表', is: '6 个样本 × 3 特征，后面亮出 μ/σ/min/max。', anchor: '.ns-table' }, { at: '两归一化表', is: 'MEAN_STD 与 MIN_MAX 两视图，当前策略用的那个高亮。', anchor: '.ns-tbl' }, { at: '反归一化框', is: '策略输出→还原真实动作；忘了会差一大截。', anchor: '.ns-unnorm' }],
    step: (s: never) => { const st = s as { stage: string; policy: string; mode: string; cols: { name: string; mean: number; std: number; min: number; max: number; ms: number[]; mm: number[] }[]; unnormFeat: string; policyOut: number; unnormVal: number; forgotVal: number }; const th = st.cols[0]!, ta = st.cols[2]!; return [
      { k: '本步输入', v: st.stage === 'intro' ? '三个特征量纲差异大' : st.stage === 'stats' ? '6 个样本、整套数据集' : st.stage === 'meanstd' ? `μ=${th.mean}、σ=${th.std}` : st.stage === 'minmax' ? `min=${ta.min}、max=${ta.max}` : st.stage === 'unnorm' ? `策略输出 ${st.policyOut}(归一化)` : '两端归一化' },
      { k: '判定规则', v: `MEAN_STD x′=(x−μ)/(σ+eps)、拉成 ~0 均值；MIN_MAX x′=2(x−min)/(max−min)−1→固定 [-1,1]；σ=√(E[x²]−μ²)；反归一化用同一套统计量还原。当前 ${st.policy}→${st.mode}。` },
      { k: '本步结果', v: st.stage === 'intro' ? '待把特征拉到同一量级' : st.stage === 'stats' ? `θ:μ=${th.mean}、σ=${th.std}(整套数据集算一遍存 meta)` : st.stage === 'meanstd' ? `θ 各样本→${th.ms.slice(0, 3).join('、')}…(μ=0 故保号)` : st.stage === 'minmax' ? `力矩离群 3.0→+1，正常样本挤到 ${ta.mm[0]}~${ta.mm[3]}(离群敏感)` : st.stage === 'unnorm' ? `真实 ${st.unnormFeat}=${st.unnormVal}(漏了反归一化只发 ${st.forgotVal})` : '输入归一化观测 + 输出反归一化动作' },
    ] },
    verdict: (s: never) => { const st = s as { stage: string }; return st.stage === 'done' ? '两端归一化' : st.stage === 'unnorm' ? '反归一化' : st.stage === 'minmax' ? '离群敏感' : st.stage === 'meanstd' ? 'MEAN_STD' : st.stage === 'stats' ? '算统计量' : '量纲差异' },
    try: [{ act: '切「给 ACT」', watch: 'MEAN_STD 高亮：关节角 (x−μ)/σ 拉成 ~0 均值；反归一化 1.0→1.63 rad。' }, { act: '切「给 Diffusion」', watch: 'MIN_MAX 高亮：映射 [-1,1] 配加噪 schedule；反归一化夹爪 0.6→0.8。' }], terms: [],
  },
  teleop: {
    question: '人拧一只机械臂、另一只实时跟随，中间到底做了什么？为什么不用逆运动学？',
    read: [{ at: '关节表', is: '6 关节：leader 原始码→标定角→跳变Δ→安全钳后目标。', anchor: '.tp-table' }, { at: '安全钳说明', is: '抖动关节被钳(开)还是直通急跳(关)。', anchor: '.tp-note' }, { at: '读数', is: '安全钳、阈值、被钳关节数。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { stage: string; safety: string; maxRel: number; joints: { name: string; leaderTick: number; leaderDeg: number; present: number; delta: number; goal: number; clamped: boolean }[]; clampedN: number }; const g = st.joints[4]!; return [
      { k: '本步输入', v: st.stage === 'intro' ? '一对同构臂：人拧 leader' : st.stage === 'readraw' ? '6 个舵机原始码(0~4095)' : st.stage === 'calib' ? '原始码 + homing_offset' : st.stage === 'safety' ? `目标角 vs follower 当前角` : '跟随完成的一步' },
      { k: '判定规则', v: `标定 角=(码−homing_offset)×360/4096；安全钳 goal=present+clamp(Δ, ±${st.maxRel}°)；同构臂直接抄关节角、不用 IK。当前安全钳=${st.safety === 'on' ? '开' : '关'}。` },
      { k: '本步结果', v: st.stage === 'intro' ? '同构→抄关节角即复现末端位姿' : st.stage === 'readraw' ? `如腕转码=${g.leaderTick}(还不是角度)` : st.stage === 'calib' ? `腕转标定角=${g.leaderDeg}°` : st.stage === 'safety' ? (st.safety === 'on' ? `腕转 Δ=${g.delta}° 超阈值→钳到目标 ${g.goal}°；共 ${st.clampedN} 个被钳` : `安全钳关：腕转直通、急跳 ${g.delta}°(危险)`) : '录下 (obs,action)=示教数据集' },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; safety: string; clampedN: number }; return st.stage === 'done' ? '跟随+录数据' : st.stage === 'safety' ? (st.safety === 'on' ? `钳${st.clampedN}关节` : '直通急跳') : st.stage === 'calib' ? '标定成角' : st.stage === 'readraw' ? '读原始码' : '同构免IK' },
    try: [{ act: '切「开 max_relative_target」', watch: '腕转抖动 Δ≈90° 被钳到 ±15° → 目标只挪到 13°，follower 平稳(1 个被钳)。' }, { act: '切「关（直通）」', watch: '腕转目标直接 87.89°、急跳 90°——真机上一次危险甩臂、可能撞坏。' }], terms: [],
  },
  miniduck: {
    question: '一只 BD-X 小鸭机器人怎么"学"会走路？它的"模仿"和前面 ACT/BC 的"模仿"是一回事吗？',
    read: [{ at: '相位条', is: '步态相位 t=(i mod N)/N → φ=(cos,sin)。', anchor: '.mk-phase' }, { at: '腿关节表', is: '参考 q̂ vs 实际 q、偏差、PD 力矩。', anchor: '.mk-table' }, { at: '奖励分解', is: 'R_vel + R_imit(主导 −15‖q−q̂‖²) + alive。', anchor: '.mk-reward' }, { at: '结局横幅', is: '消融后直立/退化/摔倒。', anchor: '.mk-out' }],
    step: (s: never) => { const st = s as { stage: string; modeLabel: string; phaseT: number; cosp: number; sinp: number; v: number; cmdV: number; imitJoint: number; rVel: number; rImit: number; alive: number; reward: number; imitOn: boolean; fallen: boolean; outcome: string }; return [
      { k: '本步输入', v: st.stage === 'intro' ? '腿式 RL(Brax PPO@MuJoCo)、非模仿学习' : st.stage === 'phase' ? `第 i 步 → 相位 t=${st.phaseT}` : st.stage === 'policy' ? '策略残差 a、默认姿势 q_def' : st.stage === 'reward' ? `v=${st.v}(指令 ${st.cmdV})、‖q−q̂‖²=${st.imitJoint}` : st.stage === 'ablate' ? '当前消融模式' : '整步跑完' },
      { k: '判定规则', v: `相位 φ=(cos2πt,sin2πt)；策略 u=q_def+0.25a→PD τ=kp(u−q)−kd·q̇；奖励 r=2.5R_vel${st.imitOn ? '+1.0R_imit' : '+(模仿项消融)'}+alive，R_imit 主导项 −15·‖q−q̂‖²；摔判 projected_gravity_z<0。` },
      { k: '本步结果', v: st.stage === 'intro' ? '模仿奖励≠模仿学习(同词反机制)' : st.stage === 'phase' ? `t=${st.phaseT}→φ=(${st.cosp},${st.sinp})，取出参考步态 q̂` : st.stage === 'policy' ? '残差绕默认姿势、PD 内环执行' : st.stage === 'reward' ? `R_vel=${st.rVel}、R_imit=${st.rImit}、alive=${st.alive} → r=${st.reward}` : st.stage === 'ablate' ? st.outcome : '模仿奖励(RL,能恢复)≠模仿学习(BC,累积误差)' },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; mode: string; reward: number }; return st.stage === 'done' ? '模仿奖励≠模仿学习' : st.stage === 'ablate' ? (st.mode === 'imit' ? '直立自然' : st.mode === 'velonly' ? '步态退化' : '摔倒') : st.stage === 'reward' ? `r=${st.reward}` : st.stage === 'policy' ? '残差+PD' : st.stage === 'phase' ? '相位+参考' : '腿式RL' },
    try: [{ act: '切「带模仿奖励」', watch: '−15‖q−q̂‖² 拉向参考步态 → q 紧跟 q̂、直立摇摆，r≈23.5。' }, { act: '切「只 velocity」', watch: '去掉模仿项 → q 偏离参考 ‖q−q̂‖²=0.365、reward 却只差一点点(22.5)、步态退化。' }, { act: '切「reference+PD 无策略」', watch: '开环 q=q̂ 精确对齐、照样摔——欠驱动浮基没被闭环镇定，回报崩到 0.5。' }], terms: [],
  },
  foc: {
    question: '三相电机的电流是随转子转的交流量，PID 根本追不上——FOC 是怎么把它变成能用两个 PI 独立控的？',
    read: [{ at: '流水线', is: 'Clarke→Park→PI→逆变换+SVPWM 四块逐步现算。', anchor: '.fc-flow' }, { at: 'Park 块', is: 'i_d/i_q——交流相电流转成直流。', anchor: '.fc-badge' }, { at: '转矩条', is: 'τ=1.5·p·λ_m·i_q，随 i_q 翻转。', anchor: '.fc-torque' }],
    step: (s: never) => { const st = s as { stage: string; cmdLabel: string; thetaDeg: number; iqTarget: number; iAlpha: number; iBeta: number; iD: number; iQ: number; eD: number; eQ: number; uD: number; uQ: number; uAc: number; poles: number; lambdaM: number; torque: number }; const z = (x: number) => (Object.is(x, -0) ? 0 : x); return [
      { k: '本步输入', v: st.stage === 'intro' ? `力矩指令 ${st.cmdLabel}、θ_e=${st.thetaDeg}°` : st.stage === 'clarke' ? '测得三相电流 i_a,i_b,i_c' : st.stage === 'park' ? `αβ 电流 + θ_e=${st.thetaDeg}°` : st.stage === 'pi' ? `i_d=${z(st.iD)}、i_q=${z(st.iQ)}、目标 i_d*=0/i_q*=${st.iqTarget}` : '两轴电压 U_d,U_q' },
      { k: '判定规则', v: `Clarke i_α=i_a、i_β=(1/√3)i_a+(2/√3)i_b；Park i_d=i_α cosθ+i_β sinθ、i_q=i_β cosθ−i_α sinθ；PI e_d=0−i_d、e_q=i_q*−i_q(i_d*=0=MTPA)；逆变换+SVPWM 中点钳位；τ=1.5·p·λ_m·i_q。` },
      { k: '本步结果', v: st.stage === 'intro' ? '交流电流 PI 追不了，先转进 dq 系' : st.stage === 'clarke' ? `→ i_α=${st.iAlpha}、i_β=${st.iBeta}(3相→2相)` : st.stage === 'park' ? `→ i_d=${z(st.iD)}、i_q=${z(st.iQ)}(交流变直流!)` : st.stage === 'pi' ? `→ U_d=${st.uD}、U_q=${st.uQ}(i_d 压向 0、i_q 追指令)` : st.stage === 'invsvpwm' ? `→ 三相占空比(含 SVPWM 共模)、τ=1.5×${st.poles}×${st.lambdaM}×${z(st.iQ)}=${z(st.torque)} N·m` : 'i_q 是力矩旋钮、i_d 恒 0' },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; torque: number }; const z = (x: number) => (Object.is(x, -0) ? 0 : x); return st.stage === 'done' ? 'i_q力矩旋钮' : st.stage === 'invsvpwm' ? `τ=${z(st.torque)}` : st.stage === 'pi' ? 'i_d*=0' : st.stage === 'park' ? '交流→直流' : st.stage === 'clarke' ? '3相→2相' : 'dq变换' },
    try: [{ act: '切「正转 iq*=+1.0A」', watch: 'i_q→+0.9、τ=+0.094 N·m(正转)；i_d 恒被压到 0。' }, { act: '切「反转 iq*=−1.0A」', watch: 'i_q→−0.9、τ=−0.094 N·m(反转)；i_d 仍是 0——只翻 i_q。' }, { act: '切「零力矩 iq*=0」', watch: 'i_q→0、τ=0；i_d 还是被压向 0。i_q 就是力矩旋钮。' }], terms: [],
  },
  dyneom: {
    question: '机械臂能不能一个电机管一个关节、各自 PID 就行？动力学方程 M q̈+C q̇+G=τ 到底在说什么？',
    read: [{ at: '质量矩阵 M', is: '2×2，非对角=关节耦合。', anchor: '.dy-matrix' }, { at: '三项表', is: '惯性 M q̈ / 科氏 C q̇ / 重力 G 逐列汇成 τ。', anchor: '.dy-terms' }, { at: '读数', is: '运动状态、耦合项、G、τ。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { stage: string; motionLabel: string; M: number[][]; Cqd: number[]; G: number[]; Mqdd: number[]; tau: number[]; qd: number[]; qdd: number[] }; const z = (x: number) => (Object.is(x, -0) ? 0 : x); return [
      { k: '本步输入', v: st.stage === 'intro' ? `运动状态 ${st.motionLabel}` : st.stage === 'mass' ? '构型 q=[30°,45°]' : st.stage === 'coriolis' ? `关节角速度 q̇=[${st.qd}]` : st.stage === 'gravity' ? '构型 q（重力方向）' : st.stage === 'assemble' ? `q̈=[${st.qdd}]、M/C/G 三项` : '完整运动方程' },
      { k: '判定规则', v: `M(q)q̈+C(q,q̇)q̇+G(q)=τ；M 随构型变(非对角=耦合)、C·q̇ 科氏离心(∝q̇²、q̇=0则0)、G 重力(静止也要)。` },
      { k: '本步结果', v: st.stage === 'intro' ? '关节被惯性/科氏/重力强耦合、不能各自独立' : st.stage === 'mass' ? `M=[[${st.M[0][0]},${st.M[0][1]}],[${st.M[1][0]},${st.M[1][1]}]]，非对角 ${st.M[0][1]}≠0=耦合` : st.stage === 'coriolis' ? `C·q̇=[${z(st.Cqd[0]!)}, ${z(st.Cqd[1]!)}]${z(st.Cqd[0]!) === 0 && z(st.Cqd[1]!) === 0 ? '（静止→全0）' : ''}` : st.stage === 'gravity' ? `重力 G=[${z(st.G[0]!)}, ${z(st.G[1]!)}]、静止也要顶` : st.stage === 'assemble' ? `τ=[${z(st.tau[0]!)}, ${z(st.tau[1]!)}]（M q̈+C q̇+G）` : '连逆动力学/计算力矩/正向动力学' },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; tau: number[] }; const z = (x: number) => (Object.is(x, -0) ? 0 : x); return st.stage === 'done' ? 'τ=Mq̈+Cq̇+G' : st.stage === 'assemble' ? `τ₁=${z(st.tau[0]!)}` : st.stage === 'gravity' ? '重力G' : st.stage === 'coriolis' ? '科氏离心' : st.stage === 'mass' ? '质量矩阵M' : '强耦合' },
    try: [{ act: '切「静止保持」', watch: 'q̇=q̈=0 → 科氏、惯性项全为0，τ=重力 G=[14.01,1.27]，举着也要力矩。' }, { act: '切「匀速转动」', watch: 'q̇≠0 → 冒出科氏/离心 C·q̇=[−2.39,0.8]，τ=科氏+重力。' }, { act: '切「加速起摆」', watch: 'q̈≠0 → 三项都在，τ=[17.05,3.78]，这才是完整动力学。' }], terms: [],
  },
  rnea: {
    question: '逆动力学(给运动求力矩)怎么算得又快又不用组一大堆矩阵？RNEA 的两次扫描在做什么？',
    read: [{ at: '外向表', is: '基→梢：每连杆 ω/α/质心加速度。', anchor: '.rn-flow' }, { at: '内向表', is: '梢→基：F=m·a_c、N=I·α → τ。', anchor: '.rn-table' }, { at: '对拍条', is: 'RNEA 的 τ = M q̈+C q̇+G。', anchor: '.rn-verify' }],
    step: (s: never) => { const st = s as { stage: string; grav: string; q: number[]; qd: number[]; qdd: number[]; a0: number[]; out: { aCom: number[] }[]; tau: number[]; eomTau: number[] }; return [
      { k: '本步输入', v: st.stage === 'intro' ? `q=[${st.q}]°、q̇=[${st.qd}]、q̈=[${st.qdd}]` : st.stage === 'outward' ? `基座假加速度 a₀=[${st.a0}]（重力技巧）` : st.stage === 'inward' ? '各连杆质心加速度 a_c' : st.stage === 'verify' ? 'RNEA 的 τ 与运动方程' : '完整两次扫描' },
      { k: '判定规则', v: `外向 ω_i=ω_{i−1}+q̇_i、a=a_prev+α×r−ω²r；内向 F=m·a_c、N=I·α、τ_i=n_i 投影关节轴；重力当基座假加速度 a₀=−g。` },
      { k: '本步结果', v: st.stage === 'intro' ? '逆动力学:给运动求力矩,O(n)两次扫描' : st.stage === 'outward' ? `连杆1 a_c=[${st.out[0]!.aCom}]、连杆2 a_c=[${st.out[1]!.aCom}]（往外传）` : st.stage === 'inward' ? `τ=[${st.tau[0]}, ${st.tau[1]}]（内向传力得到）` : st.stage === 'verify' ? `RNEA τ=[${st.tau}] = M q̈+C q̇${st.grav === 'on' ? '+G' : ''}=[${st.eomTau}] ✓一致` : '连计算力矩控制/CRBA/ABA' },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; tau: number[] }; return st.stage === 'done' ? 'O(n)逆动力学' : st.stage === 'verify' ? '=Mq̈+Cq̇+G' : st.stage === 'inward' ? `τ=[${st.tau}]` : st.stage === 'outward' ? '外向传运动' : '逆动力学' },
    try: [{ act: '切「含重力」', watch: '基座假加速度 a₀=[0,9.81]，每连杆自动含自重 → τ=[13.8,1.8]。' }, { act: '切「无重力」', watch: 'a₀=[0,0] → τ=[−0.22,0.53]，正好比含重力少一个 G=[14.01,1.27]，验证重力技巧。' }, { act: '看对拍', watch: 'RNEA 的 τ 和 M q̈+C q̇+G 完全一致——同一套动力学、O(n) 递归。' }], terms: [],
  },
  fwddyn: {
    question: '物理仿真(MuJoCo/Bullet)每一步在算什么？给定关节力矩，怎么求出关节加速度、再推进到下一帧？',
    read: [{ at: '偏置块', is: 'b=Cq̇+G（速度+重力项）。', anchor: '.fw-flow' }, { at: '质量矩阵块', is: 'M 与 det、M⁻¹。', anchor: '.fw-mat' }, { at: 'q̈ 块', is: 'q̈=M⁻¹(τ−b)。', anchor: '.fw-qdd' }],
    step: (s: never) => { const st = s as { stage: string; tqLabel: string; tau: number[]; bias: number[]; detM: number; qdd: number[]; qdNext: number[]; qNext: number[]; dt: number }; const z = (x: number) => (Object.is(x, -0) ? 0 : x); return [
      { k: '本步输入', v: st.stage === 'intro' ? `施加力矩 τ=[${st.tau}]（${st.tqLabel}）` : st.stage === 'bias' ? 'q,q̇（算速度+重力项）' : st.stage === 'massinv' ? '构型 q（组质量矩阵）' : st.stage === 'solve' ? `τ−b=[${z(Math.round((st.tau[0]! - st.bias[0]!) * 100) / 100)},${z(Math.round((st.tau[1]! - st.bias[1]!) * 100) / 100)}]` : `q̈=[${st.qdd}]、dt=${st.dt}` },
      { k: '判定规则', v: `正向动力学 q̈=M⁻¹(τ−Cq̇−G)：①偏置 b=Cq̇+G ②M 对称正定→可逆 ③解 q̈ ④半隐式欧拉 q̇←q̇+q̈dt、q←q+q̇dt。` },
      { k: '本步结果', v: st.stage === 'intro' ? '仿真=给力矩求运动、逆动力学的反问题' : st.stage === 'bias' ? `偏置 b=Cq̇+G=[${st.bias}]（=一次 q̈=0 的 RNEA）` : st.stage === 'massinv' ? `M 对称正定 det=${st.detM}≠0 可逆(实际 Cholesky 解、不真求逆)` : st.stage === 'solve' ? `q̈=M⁻¹(τ−b)=[${z(st.qdd[0]!)}, ${z(st.qdd[1]!)}] rad/s²` : st.stage === 'integrate' ? `积分一步:q̇→[${st.qdNext}]、q→[${st.qNext}]°` : '仿真一步=MuJoCo 循环一次' },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; qdd: number[] }; const z = (x: number) => (Object.is(x, -0) ? 0 : x); return st.stage === 'done' ? '仿真一步' : st.stage === 'integrate' ? '积分推进' : st.stage === 'solve' ? `q̈=[${z(st.qdd[0]!)},${z(st.qdd[1]!)}]` : st.stage === 'massinv' ? 'M⁻¹' : st.stage === 'bias' ? '偏置b' : '仿真' },
    try: [{ act: '切「偏小(τ=[10,2])」', watch: '力矩顶不住重力 → q̈=[−3.89,9.16]，关节1 往下掉(q̈₁<0)。' }, { act: '切「平衡(τ=Cq̇+G)」', watch: '力矩正好抵消偏置 → q̈≈0，关节匀速维持不加速。' }, { act: '切「发力(τ=[20,4])」', watch: '力矩大于偏置 → q̈=[2.24,2.52]，加速起摆。' }], terms: [],
  },
  computedtorque: {
    question: '机械臂非线性又耦合，固定增益 PID 只能保守整定。计算力矩控制怎么用模型把它"拉直"成线性的？',
    read: [{ at: '误差块', is: 'e、ė、Kp/Kd。', anchor: '.ct-flow' }, { at: '伺服律块', is: 'v=q̈_d+Kd ė+Kp e。', anchor: '.ct-blk' }, { at: '误差动力学块', is: '线性 ë+Kd ė+Kp e=0 或残留。', anchor: '.ct-dyn' }],
    step: (s: never) => { const st = s as { stage: string; modeLabel: string; e: number[]; ed: number[]; qddDes: number[]; Kp: number; Kd: number; innerV: number[]; Mv: number[]; Cqd: number[]; G: number[]; pdPart: number[]; tau: number[]; useM: boolean; useGrav: boolean; linear: boolean }; const z = (x: number) => (Object.is(x, -0) ? 0 : x); return [
      { k: '本步输入', v: st.stage === 'intro' ? `模式 ${st.modeLabel}` : st.stage === 'error' ? `目标与实际之差` : st.stage === 'law' ? `q̈_d=[${st.qddDes}]、Kd=${st.Kd}、Kp=${st.Kp}` : st.stage === 'torque' ? `伺服律 v=[${st.innerV}]` : '把 τ 代回被控对象' },
      { k: '判定规则', v: `v=q̈_d+Kd ė+Kp e；τ=M·v+Cq̇+G（计算力矩）；代回 M q̈+Cq̇+G=τ → Cq̇+G 抵消、M 约掉 → ë+Kd ė+Kp e=0。` },
      { k: '本步结果', v: st.stage === 'intro' ? '用模型抵消非线性、拉直成线性' : st.stage === 'error' ? `e=[${st.e}]、ė=[${st.ed}]（Kd=2√Kp 临界阻尼）` : st.stage === 'law' ? `v=q̈_d+Kd ė+Kp e=[${st.innerV}]` : st.stage === 'torque' ? `τ=${st.useM ? `M·v+Cq̇+G` : st.useGrav ? 'Kp e+Kd ė+G' : 'Kp e+Kd ė'}=[${z(st.tau[0]!)},${z(st.tau[1]!)}]` : st.linear ? 'ë+Kd ė+Kp e=0（线性解耦、可配极点）' : '残留非线性（增益被M⁻¹缩放/科氏或重力没消）' },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; linear: boolean; tau: number[] }; const z = (x: number) => (Object.is(x, -0) ? 0 : x); return st.stage === 'done' ? '模型抵消非线性' : st.stage === 'errordyn' ? (st.linear ? 'ë+Kd ė+Kp e=0' : '残留非线性') : st.stage === 'torque' ? `τ=[${z(st.tau[0]!)}]` : st.stage === 'law' ? '伺服律v' : st.stage === 'error' ? '误差e,ė' : '反馈线性化' },
    try: [{ act: '切「计算力矩」', watch: 'τ=M·v+Cq̇+G=[21.7,3.08]，Cq̇+G抵消 → ë+Kd ė+Kp e=0 线性解耦。' }, { act: '切「只重力补偿」', watch: 'τ=Kp e+Kd ė+G=[20.01,−6.73]，消重力但科氏耦合没消、误差仍非线性。' }, { act: '切「纯 PID」', watch: 'τ=Kp e+Kd ė=[6,−8]，啥都不消、稳态下垂、要保守整定。' }], terms: [],
  },
  contactlcp: {
    question: '物理引擎(MuJoCo/Bullet)每一步怎么解接触力？为什么接触不是普通的 ODE，而要解一个互补问题？',
    read: [{ at: '法向行', is: '法向互补 f_n=mg。', anchor: '.lc-line' }, { at: '摩擦锥条', is: 'μf_n 边界 vs 推力 F。', anchor: '.lc-bar' }, { at: '粘/滑条', is: 'F vs μf_n → 粘或滑。', anchor: '.lc-verdict' }],
    step: (s: never) => { const st = s as { stage: string; pushLabel: string; m: number; g: number; mu: number; F: number; fn: number; maxStatic: number; stick: boolean; ft: number; accel: number }; return [
      { k: '本步输入', v: st.stage === 'intro' ? `${st.pushLabel}、μ=${st.mu}` : st.stage === 'normal' ? '竖直平衡（求法向力）' : st.stage === 'cone' ? `f_n=${st.fn}、μ=${st.mu}` : st.stage === 'stickslip' ? `F=${st.F} 与 μf_n=${st.maxStatic}` : `F=${st.F}、f_t=${st.ft}、m=${st.m}` },
      { k: '判定规则', v: `法向互补 0≤f_n⊥φ≥0（不能拉不能穿）；摩擦锥 |f_t|≤μf_n；粘/滑=KKT 开关：F≤μf_n 粘(a=0)、否则滑(f_t=μf_n、a=(F−μf_n)/m)。` },
      { k: '本步结果', v: st.stage === 'intro' ? '接触非光滑、每步解 LCP' : st.stage === 'normal' ? `法向互补 f_n=m·g=${st.fn}N（只推不拉）` : st.stage === 'cone' ? `摩擦锥 |f_t|≤μf_n=${st.maxStatic}N（最大静摩擦）` : st.stage === 'stickslip' ? `F=${st.F}${st.stick ? '≤' : '>'}μf_n=${st.maxStatic} → ${st.stick ? '粘住' : '滑动'}、f_t=${st.ft}` : `a=(F−f_t)/m=${st.accel} m/s²${st.stick ? '（粘→0）' : ''}` },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; stick: boolean; accel: number }; return st.stage === 'done' ? '互补+摩擦锥' : st.stage === 'accel' ? (st.stick ? 'a=0粘' : `a=${st.accel}滑`) : st.stage === 'stickslip' ? (st.stick ? '粘住' : '滑动') : st.stage === 'cone' ? '摩擦锥' : st.stage === 'normal' ? '法向互补' : '接触' },
    try: [{ act: '切「轻推 F=3」', watch: 'F=3≤μf_n=4.905 → 粘住，f_t=3(锥内)、a=0。' }, { act: '切「重推 F=6」', watch: 'F=6>μf_n=4.905 → 滑动，f_t 饱和 4.905、a=(6−4.905)/1=1.095 m/s²。' }, { act: '切「临界 F=4.9」', watch: '4.9<4.905 刚好粘住(将滑未滑)、a=0——摩擦锥边界的开关。' }], terms: [],
  },
  ekf: {
    question: '卡尔曼滤波要求线性，可机器人测的是「到地标的距离」这种非线性量——EKF 怎么办？',
    read: [{ at: '数轴图', is: '地标(10,5)、机器人先验/预测/后验位置。', anchor: '.ek-svg' }, { at: '雅可比块', is: 'H=∂h/∂x 就地线性化(EKF 精髓)。', anchor: '.ek-jt' }, { at: '读数', is: '信任、H、x̂、方差 P。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { stage: string; trustLabel: string; xPrior: number; u: number; PPrior: number; Q: number; L: number; xPred: number; PPred: number; hPred: number; z: number; innov: number; H: number; R: number; S: number; K: number; xPost: number; PPost: number }; return [
      { k: '本步输入', v: st.stage === 'intro' ? `信任 ${st.trustLabel}、非线性观测` : st.stage === 'predict' ? `先验 x̂=${st.xPrior}、运动 u=${st.u}` : st.stage === 'measmodel' ? `预测位置 x̂=${st.xPred}、地标 L=${st.L}` : st.stage === 'jacobian' ? `在估计点 x̂=${st.xPred} 求偏导` : `创新 y=${st.innov}、H=${st.H}、R=${st.R}` },
      { k: '判定规则', v: `预测 x̂←x̂+u、P←P+Q；观测 h(x̂)=√((L−x̂)²+d²)非线性；雅可比 H=∂h/∂x=−(L−x̂)/h 就地线性化；更新 S=H²P+R、K=PH/S、x←x̂+Ky、P←(1−KH)P。` },
      { k: '本步结果', v: st.stage === 'intro' ? 'EKF=在估计点雅可比线性化+卡尔曼' : st.stage === 'predict' ? `预测 x̂=${st.xPred}、P=${st.PPred}(不确定度涨)` : st.stage === 'measmodel' ? `h(x̂)=${st.hPred}、实测 ${st.z} → 创新 y=${st.innov}` : st.stage === 'jacobian' ? `H=−(L−x̂)/h=${st.H}（就地线性化、负=往右离地标更近）` : `x←x̂+Ky=${st.xPost}、P←(1−KH)P=${st.PPost}（收敛）` },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; H: number; xPost: number }; return st.stage === 'done' ? '雅可比+卡尔曼' : st.stage === 'update' ? `x̂=${st.xPost}` : st.stage === 'jacobian' ? `H=${st.H}` : st.stage === 'measmodel' ? '非线性观测' : st.stage === 'predict' ? '预测' : '非线性' },
    try: [{ act: '切「测量准(R=0.25)」', watch: '信测量 → K=−1.286 大、状态拉到 3.81、P 从 5 收到 0.45。' }, { act: '切「测量糙(R=9)」', watch: '信预测 → K=−0.307 小、状态几乎不动(4.71)、P 只收到 3.91。' }, { act: '看雅可比 H', watch: 'H=−0.707 把非线性距离测量翻译成局部线性斜率，卡尔曼公式才能用。' }], terms: [],
  },
  particlefilter: {
    question: 'EKF 用一个高斯表信念、强非线性/多峰就崩。粒子滤波怎么用一堆样本表示任意分布？',
    read: [{ at: '粒子云图', is: '数轴上粒子(半径∝权重)、重采样后聚拢。', anchor: '.pf-svg' }, { at: '加权块', is: 'w∝观测似然。', anchor: '.pf-blk' }, { at: '读数', is: 'N_eff、加权均值估计。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { stage: string; modeLabel: string; z: number; sigma: number; particles: { pos: number; wn: number }[]; neff: number; N: number; resampled: number[]; estimate: number; mode: string }; return [
      { k: '本步输入', v: st.stage === 'intro' ? `${st.N} 个粒子、测量 z=${st.z}` : st.stage === 'predict' ? '每粒子按运动+噪声动' : st.stage === 'weight' ? `测量 z=${st.z}、σ=${st.sigma}` : st.stage === 'neff' ? '归一化权重' : '归一权重的累积分布' },
      { k: '判定规则', v: `加权 w_i=exp(−(z−x_i)²/(2σ²))；归一 + N_eff=1/Σw²（<N/2 重采样）；系统重采样高权复制/低权淘汰；估计=加权均值。` },
      { k: '本步结果', v: st.stage === 'intro' ? '一堆带权粒子表任意分布(多峰/非高斯)' : st.stage === 'predict' ? '粒子云散开(不确定度涨)' : st.stage === 'weight' ? `离 z=${st.z} 近的权重高(x=5、6≈0.33)` : st.stage === 'neff' ? `N_eff=${st.neff}(满值${st.N})、加权均值估计=${st.estimate}` : st.mode === 'on' ? `重采样→[${st.resampled.join(',')}]、聚拢、权重重置` : '不重采样→权重退化、N_eff→1' },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; neff: number; N: number; mode: string }; return st.stage === 'done' ? '样本表信念' : st.stage === 'resample' ? (st.mode === 'on' ? '重采样聚拢' : '退化') : st.stage === 'neff' ? `N_eff=${st.neff}` : st.stage === 'weight' ? '加权' : st.stage === 'predict' ? '预测散开' : '粒子' },
    try: [{ act: '切「重采样」', watch: 'N_eff=3.72、加权均值 5.4；系统重采样 → [4,5,5,6,6,8]，x=2/9 死、x=5/6 复制、聚拢。' }, { act: '切「不重采样」', watch: '权重继续退化：迭代几步后全集中到极少数粒子(N_eff→1)、粒子浪费——所以 PF 必须重采样。' }, { act: '想 vs EKF', watch: 'EKF 一个高斯、单峰；粒子滤波一堆样本、能表多峰/非高斯(全局定位)、但慢。' }], terms: [],
  },
  ukf: {
    question: 'EKF 要求雅可比、导数难算又只是一阶近似。UKF 怎么不求导就处理非线性？',
    read: [{ at: 'h(x)曲线', is: 'sigma 点撒在真曲线上(不是切线)。', anchor: '.uk-svg' }, { at: 'sigma 块', is: '取点→过真非线性→重组。', anchor: '.uk-blk' }, { at: '对比框', is: 'UKF vs EKF 同题结果。', anchor: '.uk-cmpbox' }],
    step: (s: never) => { const st = s as { stage: string; uncLabel: string; xPred: number; P: number; sqrtTerm: number; sigmas: { x: number; h: number }[]; zPred: number; S: number; Pxz: number; K: number; xPost: number; PPost: number; xEkf: number; unc: string }; return [
      { k: '本步输入', v: st.stage === 'intro' ? `先验 ${st.uncLabel}、非线性观测` : st.stage === 'sigma' ? `均值 μ=${st.xPred}、协方差 P=${st.P}` : st.stage === 'transform' ? `3 个 sigma 点` : st.stage === 'recombine' ? '过 h 后的 3 个值' : `ẑ=${st.zPred}、S=${st.S}、Pxz=${st.Pxz}` },
      { k: '判定规则', v: `sigma 点 X₀=μ、X₁,₂=μ±√((n+λ)P)；每点过真 h(不求导)；ẑ=ΣWm·h(Xᵢ)、S、Pxz；更新 K=Pxz/S、x←x̂+K(z−ẑ)、P←P−KSK。` },
      { k: '本步结果', v: st.stage === 'intro' ? 'UKF:不线性化、用 sigma 点探非线性' : st.stage === 'sigma' ? `sigma 点=[${st.sigmas.map(g => g.x).join(',')}]（μ±${st.sqrtTerm}）` : st.stage === 'transform' ? `${st.sigmas.map(g => `h(${g.x})=${g.h}`).join('、')}（过真非线性、不求导）` : st.stage === 'recombine' ? `ẑ=ΣWm·h=${st.zPred}（≠EKF 的 7.07）、S=${st.S}、Pxz=${st.Pxz}` : `UKF x=${st.xPost}、P=${st.PPost}；EKF x=${st.xEkf}（${st.unc === 'big' ? '分道' : '≈UKF'}）` },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; xPost: number; zPred: number }; return st.stage === 'done' ? 'sigma+卡尔曼' : st.stage === 'update' ? `x̂=${st.xPost}` : st.stage === 'recombine' ? `ẑ=${st.zPred}` : st.stage === 'transform' ? '过真非线性' : st.stage === 'sigma' ? 'sigma点' : '无迹变换' },
    try: [{ act: '切「不确定大(P=5)」', watch: 'sigma 点铺得开(±3.87)、UKF 捕捉曲率 → x=4.02，和 EKF 的 3.81 分道。' }, { act: '切「不确定小(P=1)」', watch: 'sigma 点靠得近(±1.73)、这段 h 近似线性 → UKF x=4.16≈EKF x=4.12。' }, { act: '看 h(x) 曲线', watch: 'sigma 点撒在真曲线上(EKF 用切线)，所以 UKF 带上了曲率。' }], terms: [],
  },
  complementary: {
    question: '陀螺仪短期准但会漂、加速度计不漂但抖——怎么把这两个传感器融成一个好用的倾角？',
    read: [{ at: '倾角刻度尺', is: '陀螺/加速度/融合三个标记。', anchor: '.co-scale' }, { at: '融合块', is: 'θ=α·陀螺+(1−α)·加速度。', anchor: '.co-hot2' }, { at: '取舍块', is: 'α 大平滑纠漂慢/小压漂快但抖。', anchor: '.co-behav' }],
    step: (s: never) => { const st = s as { stage: string; blendLabel: string; thetaPrev: number; omega: number; dt: number; thetaAcc: number; alpha: number; gyroPred: number; fused: number; driftPerSec: number; blend: string }; return [
      { k: '本步输入', v: st.stage === 'intro' ? `混合 ${st.blendLabel}` : st.stage === 'gyro' ? `上一角 ${st.thetaPrev}°、角速度 ω=${st.omega}°/s` : st.stage === 'accel' ? '重力方向' : st.stage === 'fuse' ? `陀螺 ${st.gyroPred}°、加速度 ${st.thetaAcc}°` : '两个极端 vs 互补' },
      { k: '判定规则', v: `陀螺 θ_gyro=θ_prev+ω·dt（短期准长期漂）；加速度 θ_acc 绝对（不漂但抖）；互补 θ=α·θ_gyro+(1−α)·θ_acc（高通陀螺+低通加速度）。` },
      { k: '本步结果', v: st.stage === 'intro' ? '两传感器互补长短板' : st.stage === 'gyro' ? `θ_gyro=${st.thetaPrev}+${st.omega}×${st.dt}=${st.gyroPred}°（bias 逐秒漂 ${st.driftPerSec}°）` : st.stage === 'accel' ? `θ_acc=atan2(重力)=${st.thetaAcc}°（绝对不漂、但抖）` : st.stage === 'fuse' ? `θ=α·陀螺+(1−α)·加速度=${st.alpha}×${st.gyroPred}+${Math.round((1 - st.alpha) * 100) / 100}×${st.thetaAcc}=${st.fused}°` : `只陀螺→漂、只加速度→抖；α=${st.alpha}(${st.blend === 'gyro' ? '平滑纠漂稳' : st.blend === 'accel' ? '纠漂快略抖' : '发抖'})` },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; fused: number }; return st.stage === 'done' ? '高通陀螺+低通加速度' : st.stage === 'behavior' ? 'α取舍' : st.stage === 'fuse' ? `融=${st.fused}°` : st.stage === 'accel' ? '加速度(抖)' : st.stage === 'gyro' ? '陀螺(漂)' : 'IMU融合' },
    try: [{ act: '切「偏信陀螺(α=0.98)」', watch: '融=30.24°≈陀螺30.2°：平滑抗抖，靠 2% 加速度慢慢纠漂。' }, { act: '切「均衡(α=0.5)」', watch: '融=31.1°：一半跟加速度、纠漂快但明显发抖。' }, { act: '想两个极端', watch: '只陀螺→bias 无限漂；只加速度→抖得没法用。互补两全。' }], terms: [],
  },
  rrtstar: {
    question: 'RRT 能找到一条避障路、但往往绕。RRT* 加了哪两步，让路径随采样越来越接近最优？',
    read: [{ at: '树图', is: '节点+父边、x_new+邻域圈、选父边绿/重连边橙。', anchor: '.rs-svg' }, { at: '选父块', is: 'cost[邻居]+dist 取最小。', anchor: '.rs-hot2' }, { at: '重连块', is: '邻居经 x_new 更省则改接。', anchor: '.rs-rwchip' }],
    step: (s: never) => { const st = s as { stage: string; algoLabel: string; xnew: { x: number; y: number }; radius: number; neighbors: { id: string; dist: number; viaCost: number }[]; nearestId: string; rrtCost: number; chosenParent: string; starCost: number; rewired: { id: string; oldCost: number; newCost: number }[] }; return [
      { k: '本步输入', v: st.stage === 'intro' ? `算法 ${st.algoLabel}` : st.stage === 'sample' ? `采样 x_new=(${st.xnew.x},${st.xnew.y})、r=${st.radius}` : st.stage === 'chooseparent' ? '邻域各节点的 cost 与距离' : st.stage === 'rewire' ? `x_new(代价 ${st.starCost})` : 'RRT vs RRT* 结果' },
      { k: '判定规则', v: `选父:父=argmin(cost[邻居]+dist(邻居,x_new))；重连:若 cost[x_new]+dist<cost[邻居] 则邻居改接 x_new；邻域半径随 n 收缩。` },
      { k: '本步结果', v: st.stage === 'intro' ? 'RRT 找一条、RRT* 加两步趋最优' : st.stage === 'sample' ? `邻域=${st.neighbors.map(n => n.id).join('、')}、最近=${st.nearestId}` : st.stage === 'chooseparent' ? `选父=${st.chosenParent}、代价 ${st.starCost}（最近的 ${st.nearestId} 反而贵 ${st.rrtCost}）` : st.stage === 'rewire' ? (st.rewired.length ? `重连 ${st.rewired.map(r => `${r.id}:${r.oldCost}→${r.newCost}`).join('、')}` : '本例无重连') : `RRT 代价 ${st.rrtCost}、RRT* 代价 ${st.starCost}${st.rewired.length ? `+重连 ${st.rewired.map(r => r.id).join('、')}` : ''}` },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; chosenParent: string; starCost: number; rewired: unknown[] }; return st.stage === 'done' ? '选父+重连' : st.stage === 'compare' ? `省到${st.starCost}` : st.stage === 'rewire' ? (st.rewired.length ? `重连${st.rewired.length}个` : '无重连') : st.stage === 'chooseparent' ? `父=${st.chosenParent}` : st.stage === 'sample' ? '采样+邻域' : '渐近最优' },
    try: [{ act: '切「RRT*」', watch: '选父挑代价最小的 A(代价6，非最近 B 的9)、还重连 B 8→7 → 树更优。' }, { act: '切「RRT只接最近」', watch: 'x_new 直接接最近的 B、代价 9、不重连——找到一条但不最优。' }, { act: '看树图', watch: '绿边=选父的最优连接、橙虚线=重连；随采样增多不断抄近道逼近最优。' }], terms: [],
  },
  potentialfield: {
    question: '不采样不搜图，让目标"吸"机器人、障碍"推"机器人，顺合力走——这么简单的势场法栽在哪？',
    read: [{ at: '2D 平面', is: '目标/障碍(+影响圈)/机器人 + 引力绿/斥力红/合力蓝箭头。', anchor: '.po-svg' }, { at: '合力块', is: 'F=F_att+F_rep。', anchor: '.po-t' }, { at: '结局横幅', is: '绕过 or 卡局部极小。', anchor: '.po-out' }],
    step: (s: never) => { const st = s as { stage: string; scenLabel: string; robot: number[]; goal: number[]; rhoGoal: number; rhoObs: number; rho0: number; fAtt: number[]; fRep: number[]; fTotal: number[]; fMag: number; distToGoal: number; stuck: boolean; scen: string }; return [
      { k: '本步输入', v: st.stage === 'intro' ? `场景 ${st.scenLabel}` : st.stage === 'attractive' ? `机器人 ${JSON.stringify(st.robot)}、目标 ${JSON.stringify(st.goal)}` : st.stage === 'repulsive' ? `到障碍 ρ=${st.rhoObs}、影响半径 ρ0=${st.rho0}` : st.stage === 'total' ? `引力 [${st.fAtt}]、斥力 [${st.fRep}]` : '合力与离目标距离' },
      { k: '判定规则', v: `引力 F_att=k_att·(q_goal−q)；斥力 F_rep(仅 ρ≤ρ0)=k_rep·(1/ρ−1/ρ0)·(1/ρ²)·n̂；合力 F=F_att+F_rep 顺它下山；合力≈0 却离目标远=局部极小。` },
      { k: '本步结果', v: st.stage === 'intro' ? '势场法:引力+斥力顺合力下山' : st.stage === 'attractive' ? `F_att=[${st.fAtt}]（指向目标、正比距离 ${st.rhoGoal}）` : st.stage === 'repulsive' ? (st.rhoObs <= st.rho0 ? `F_rep=[${st.fRep}]（ρ≤ρ0、越近越猛）` : `F_rep=0（ρ>ρ0 影响圈外）`) : st.stage === 'total' ? `合力=[${st.fTotal}]、大小 ${st.fMag}` : st.stuck ? `卡局部极小(合力≈${st.fMag}、离目标还有 ${st.distToGoal})` : `绕过到达(斥力横向分量把机器人带到障碍旁)` },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; stuck: boolean; fMag: number }; return st.stage === 'done' ? '引力+斥力' : st.stage === 'outcome' ? (st.stuck ? '卡局部极小' : '绕过到达') : st.stage === 'total' ? `|F|=${st.fMag}` : st.stage === 'repulsive' ? '斥力' : st.stage === 'attractive' ? '引力' : '势场' },
    try: [{ act: '切「障碍正中」', watch: '引力(+x 5.43)和斥力(−x 5.37)几乎抵消、合力仅 0.06≈0，机器人卡在离目标 5.43 的假谷——局部极小。' }, { act: '切「障碍偏侧」', watch: '斥力有横向分量(y −0.19)，合力 [5.74,−0.19] 把机器人往障碍旁带、绕过到达。' }, { act: '想怎么救', watch: '局部极小靠随机扰动/导航函数/配全局规划(RRT 出全局路、势场只做局部避障)解决。' }], terms: [],
  },
  trapezoid: {
    question: '规划出"走哪条路"之后，电机怎么知道每一刻该走多快？梯形速度曲线怎么算总时间？',
    read: [{ at: 'v(t) 图', is: '速度-时间曲线：梯形或三角。', anchor: '.tz-svg' }, { at: '判形块', is: 'D vs 2·d_a → 梯形/三角。', anchor: '.tz-t' }, { at: '读数', is: '加速段、形态、总时间。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { stage: string; distLabel: string; D: number; vMax: number; aMax: number; tA: number; dA: number; isTrap: boolean; vPeak: number; dCruise: number; tCruise: number; tTotal: number }; return [
      { k: '本步输入', v: st.stage === 'intro' ? `${st.distLabel}、v_max=${st.vMax}、a_max=${st.aMax}` : st.stage === 'accel' ? '约束 v_max、a_max' : st.stage === 'regime' ? `D=${st.D} 与 2·d_a=${Math.round(2 * st.dA * 100) / 100}` : st.stage === 'profile' ? '各段距离' : '各段时间' },
      { k: '判定规则', v: `t_a=v_max/a_max、d_a=v_max²/(2a_max)；D≥2 d_a→梯形(T=2 t_a+t_c)、否则三角(v_peak=√(a_max·D)、T=2√(D/a_max))。` },
      { k: '本步结果', v: st.stage === 'intro' ? '路径→轨迹：算每刻速度' : st.stage === 'accel' ? `t_a=${st.tA}s、d_a=${st.dA}m（减速对称）` : st.stage === 'regime' ? `D=${st.D}${st.isTrap ? '≥' : '<'}${Math.round(2 * st.dA * 100) / 100} → ${st.isTrap ? '梯形（达 v_max）' : `三角（v_peak=${st.vPeak}<${st.vMax}）`}` : st.stage === 'profile' ? (st.isTrap ? `匀速段 d_c=${st.dCruise}m、t_c=${st.tCruise}s` : `加速+减速各 ${Math.round(st.D / 2 * 100) / 100}m、无匀速`) : `T=${st.tTotal}s（时间最优）` },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; tTotal: number; isTrap: boolean }; return st.stage === 'done' ? '时间最优' : st.stage === 'time' ? `T=${st.tTotal}s` : st.stage === 'profile' ? (st.isTrap ? '梯形三段' : '三角两段') : st.stage === 'regime' ? (st.isTrap ? '梯形' : '三角') : st.stage === 'accel' ? '加速段' : '速度曲线' },
    try: [{ act: '切「长距离 D=10」', watch: 'D=10≥2·d_a=4 → 梯形：加速2m+匀速6m+减速2m，T=2·2+3=7s，达到 v_max=2。' }, { act: '切「短距离 D=3」', watch: 'D=3<4 → 三角：还没加到 v_max 就得减速，v_peak=√3≈1.73，T=2√3≈3.46s。' }, { act: '想 S 曲线', watch: '梯形的加速度是阶跃、会激振；S 曲线再限 jerk、更柔更抗振但稍慢。' }], terms: [],
  },
  prm: {
    question: 'RRT 每次朝一个目标长一棵树。要在同一个固定环境里反复规划不同起终点，怎么才不用每次重来？',
    read: [{ at: '路图', is: '障碍+节点+边(灰=路图/红虚=被挡/绿=最短路)。', anchor: '.pm-svg' }, { at: '连边块', is: 'k 近邻+碰撞检测。', anchor: '.pm-r' }, { at: '结局横幅', is: '连通找到路/断开。', anchor: '.pm-out' }],
    step: (s: never) => { const st = s as { stage: string; densLabel: string; nodes: { id: string }[]; edges: { a: string; b: string; blocked: boolean }[]; roadmap: unknown[]; path: string[]; pathLen: number; connected: boolean }; const blk = st.edges.filter(e => e.blocked); return [
      { k: '本步输入', v: st.stage === 'intro' ? `采样密度 ${st.densLabel}` : st.stage === 'sample' ? '自由空间' : st.stage === 'connect' ? `${st.nodes.length} 个节点` : st.stage === 'query' ? '起点 S、终点 G' : '路图连通性' },
      { k: '判定规则', v: `建图:采样节点→连 k 近邻→边碰撞检测(穿障丢掉);查询:起终点接入→Dijkstra 搜最短路;采样太稀路图会断开。` },
      { k: '本步结果', v: st.stage === 'intro' ? 'PRM:建一次路图、答多次查询(多查询)' : st.stage === 'sample' ? `撒 ${st.nodes.length} 个无碰节点` : st.stage === 'connect' ? `${blk.length} 条穿障被挡(${blk.map(e => `${e.a}-${e.b}`).join('、') || '无'})、保留路图 ${st.roadmap.length} 条` : st.stage === 'query' ? (st.connected ? `最短路 ${st.path.join('→')}(长 ${st.pathLen})` : 'S、G 断开、找不到路') : st.connected ? `连通、复用同一路图答多查询` : `断开、要加采样(窄通道问题)` },
    ] },
    verdict: (s: never) => { const st = s as { stage: string; connected: boolean; pathLen: number }; return st.stage === 'done' ? '建图+查询' : st.stage === 'outcome' ? (st.connected ? '连通' : '断开') : st.stage === 'query' ? (st.connected ? `路长${st.pathLen}` : '无路') : st.stage === 'connect' ? '连k近邻' : st.stage === 'sample' ? '采样' : '多查询' },
    try: [{ act: '切「够密」', watch: '6 节点、路图连通；最短的 B-D 被障碍挡 → 绕上方 S-A-C-D-G，长 9.48。' }, { act: '切「太稀」', watch: '少了障碍上方的 C，路图在障碍附近断成两块 → S 到不了 G，要加采样。' }, { act: '想 vs RRT', watch: 'PRM 多查询(建一次路图答多次)；RRT 单查询(每次朝一目标重长树)。' }], terms: [],
  },
  queryplan: {
    question: '同一个查询有好几条路可走，数据库优化器凭什么选其中一条？',
    read: [{ at: '候选路径', is: '每条访问路径的 type + 估扫描行数代价条。', anchor: '.qp-paths' }, { at: 'EXPLAIN', is: '末步选中路径的 type/key/rows。', anchor: '.qp-explain' }],
    step: (s: never) => { const st = s as { op: string; cur: number; paths: { name: string; type: string; rows: number }[]; chosen: number; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '比完三条路径的代价' : st.op === 'intro' ? '一个查询、多条访问路径' : `候选：${st.paths[st.cur].name}` },
      { k: '判定规则', v: '基于代价(CBO)：估每条访问路径大概扫多少行(含回表等)，选代价最低的。type=ALL 全表扫、ref 等值索引、range 范围索引；rows 是估扫描行数。' },
      { k: '本步结果', v: st.phase === 'done' ? `选 ${st.paths[st.chosen].name}（${st.paths[st.chosen].rows} 行最少）→ EXPLAIN type=${st.paths[st.chosen].type}` : st.op === 'path' ? `${st.paths[st.cur].name}：type=${st.paths[st.cur].type}，估扫 ${st.paths[st.cur].rows} 行` : `查询有 ${st.paths.length} 条候选路径` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; cur: number; paths: { rows: number }[] }; return st.phase === 'done' ? '选最省路径' : st.op === 'path' ? `${st.paths[st.cur].rows}行` : '看查询' },
    try: [{ act: '比三条路径', watch: '全表扫 10000 行、idx(city) 500 行、idx(age) 6000 行——优化器选行数最少的。' }, { act: '看 EXPLAIN', watch: '选中 idx(city)：type=ref、key=idx_city、rows≈500，这就是 EXPLAIN 输出。' }], terms: [],
  },
  regex: {
    question: '正则的 * 是"零或多个前一字符"，怎么用 DP 表把它讲清楚？',
    read: [{ at: 'DP 表', is: 'dp[i][j]=s前i个配p前j个；绿✓能配、·不能。', anchor: '.rx-table' }, { at: '关键格', is: '本行高亮格用的转移规则。', anchor: '.rx-note' }],
    step: (s: never) => { const st = s as { op: string; curRow: number; s: string; p: string; key: { i: number; j: number; rule: string } | null; matched: boolean; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? `读右下角 dp[${st.s.length}][${st.p.length}]` : st.op === 'intro' ? `s="${st.s}" p="${st.p}"，dp 表` : `填第 ${st.curRow} 行（s 前 ${st.curRow} 个）` },
      { k: '判定规则', v: 'dp[i][j]=s前i配p前j。p这位不是*→看左上dp[i-1][j-1]且字符相配；是*(前一个x)→跳两格dp[i][j-2](匹配0个) 或 s[i-1]配x且正上方dp[i-1][j](多吃一个)。' },
      { k: '本步结果', v: st.phase === 'done' ? `dp[${st.s.length}][${st.p.length}] = ${st.matched ? '真 → 匹配 ✓' : '假 → 不匹配'}` : st.key ? `关键格 dp[${st.key.i}][${st.key.j}] 用「${st.key.rule === 'zero' ? '* 匹配0个' : st.key.rule === 'more' ? '* 多吃一个' : '字符相配·左上'}」` : `填完第 ${st.curRow} 行` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; curRow: number; matched: boolean }; return st.phase === 'done' ? (st.matched ? '匹配✓' : '不匹配') : st.op === 'row' ? `第${st.curRow}行` : '看规则' },
    try: [{ act: '看 c* 匹配 0 个', watch: 'dp[0][2]：空串配 "c*" → c* 匹配 0 个 c → 跳两格看 dp[0][0]=真。' }, { act: '看 a* 吃两个 a', watch: 'dp[1][4]、dp[2][4]：a* 一个个多吃 a，靠"正上方"转移，吃掉两个 a。' }], terms: [],
  },
  blockingqueue: {
    question: '生产者比消费者快，队列满了怎么办？空了消费者又怎么办？',
    read: [{ at: '缓冲槽', is: '有界缓冲的占用/空位。', anchor: '.bq-buffer' }, { at: '两端', is: '生产者/消费者的状态（就绪/阻塞）。', anchor: '.bq-scene' }],
    step: (s: never) => { const st = s as { op: string; queue: string[]; cap: number; item: string; blockedP: boolean; blockedC: boolean; event: string; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '生产者放数据后消费者被唤醒' : st.op === 'intro' ? `容量 ${st.cap} 的有界阻塞队列` : st.event },
      { k: '判定规则', v: 'put：队列满→生产者在 notFull 上阻塞挂起（等空位）；take：队列空→消费者在 notEmpty 上阻塞（等数据）。对方操作腾空位/放数据后 signal 唤醒。锁+两个条件变量。' },
      { k: '本步结果', v: st.phase === 'done' ? `取走 ${st.item} → queue=[${st.queue.join(',')}]` : `queue=[${st.queue.join(',')}]（${st.queue.length}/${st.cap}）${st.blockedP ? '，生产者阻塞' : st.blockedC ? '，消费者阻塞' : ''}` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; item: string }; return st.phase === 'done' ? '唤醒取走' : st.op === 'blockFull' ? '生产者阻塞' : st.op === 'blockEmpty' ? '消费者阻塞' : st.op === 'wakeP' || st.op === 'wakeC' ? '唤醒' : st.op === 'put' ? `put ${st.item}` : st.op === 'take' ? `take ${st.item}` : '就绪' },
    try: [{ act: '看满了阻塞生产者', watch: '队列[A,B]满，put(C) 时生产者挂起；消费者 take 腾出空位才唤醒它。' }, { act: '看空了阻塞消费者', watch: '队列空，take 时消费者挂起；生产者 put(D) 放入数据才唤醒它。' }], terms: [],
  },
  wildcard: {
    question: '通配符 * 能配任意一段，它到底该吃几个字符？怎么不用递归就搞定？',
    read: [{ at: 's / p 两行', is: '双指针位置、* 覆盖的字符(绿)、锚点(黄)。', anchor: '.wc-row' }, { at: '读数', is: '本步、双指针、* 吃了什么。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { op: string; s: string; p: string; si: number; pj: number; star: number; coverFrom: number; coverTo: number; matched: boolean; phase: string }; const eaten = st.coverFrom >= 0 && st.coverTo > st.coverFrom ? st.s.slice(st.coverFrom, st.coverTo) : ''; return [
      { k: '本步输入', v: st.phase === 'done' ? `s 扫到头(si=${st.si})` : st.op === 'intro' ? `s="${st.s}" p="${st.p}"` : st.op === 'match' ? `字符匹配，si→${st.si}、pj→${st.pj}` : st.op === 'star' ? `遇 *(p=${st.star})` : `回溯，* 多吃一个` },
      { k: '判定规则', v: '字符相同或 ? → 两指针都前进。遇 * → 记锚点(位置+此刻 si)、先当匹配 0 个越过。走不通 → 回锚点让 * 多吃一个。贪心+回溯，O(1) 额外空间。' },
      { k: '本步结果', v: st.phase === 'done' ? `${st.matched ? '匹配 ✓' : '不匹配 ✗'}（* 吃了 "${eaten}"）` : st.op === 'match' ? `si=${st.si}, pj=${st.pj}${eaten ? `；* 已吃 "${eaten}"` : ''}` : st.op === 'backtrack' ? `* 吃到 "${eaten}"，si=${st.si} 继续` : st.op === 'star' ? `锚点记在 p=${st.star}，pj=${st.pj}` : '开始匹配' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; matched: boolean }; return st.phase === 'done' ? (st.matched ? '匹配✓' : '不匹配') : st.op === 'match' ? '匹配' : st.op === 'star' ? '记锚点' : st.op === 'backtrack' ? '回溯' : '就绪' },
    try: [{ act: '看遇 * 记锚点', watch: '遇到 * 先记下位置、当匹配 0 个往后走，不急着决定吃几个。' }, { act: '看回溯多吃', watch: 'd≠b 走不通 → 回锚点让 * 多吃一个(b、再 c)，最后 d↔d 匹配 ✓。' }], terms: [],
  },
  bufferpool: {
    question: '一次全表扫描会不会把缓存里的热点页都冲掉？MySQL 怎么防？',
    read: [{ at: 'LRU 两段', is: 'young 热区 / 中点 / old 冷区，新页从中点进。', anchor: '.bfp-lru' }, { at: '读数', is: '本步、young 热区、old 冷区、淘汰。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { op: string; young: string[]; old: string[]; loaded: string; evicted: string; scanned: string[]; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '扫描结束，看热点' : st.op === 'intro' ? '普通 LRU 会被扫描污染' : st.op === 'init' ? 'young=热区、old=冷区' : `全表扫描装载 ${st.loaded}` },
      { k: '判定规则', v: 'LRU 分 young(热)+old(冷)。新页插中点(old 头)、不进链表头；只有在 old 段再次被访问且过时间窗才升 young。扫描页只用一次→不升→从 old 尾淘汰。' },
      { k: '本步结果', v: st.phase === 'done' ? `young[${st.young.join(',')}] 毫发无损，扫描只搅动 old` : st.op === 'scan' ? `${st.loaded} 插中点、淘汰 old 尾 ${st.evicted}；young[${st.young.join(',')}] 没动` : `young[${st.young.join(',')}] old[${st.old.join(',')}]` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; loaded: string }; return st.phase === 'done' ? '热点无损' : st.op === 'scan' ? `装${st.loaded}` : st.op === 'init' ? '初始' : '看问题' },
    try: [{ act: '看新页进中点', watch: '扫描页 S1/S2/S3 都插到 old 头(中点)，不碰 young。' }, { act: '看热点没动', watch: '扫描三个页、淘汰的全是 old 里的，young[A,B,C] 从头到尾没变。' }], terms: [],
  },
  lockstrategy: {
    question: '两个事务同时改一行，怎么防"更新丢失"？乐观锁和悲观锁差在哪？',
    read: [{ at: '数据库行', is: '库存/版本/锁状态。', anchor: '.lk-row' }, { at: '两事务', is: 'T1/T2 各自在做什么。', anchor: '.lk-txns' }],
    step: (s: never) => { const st = s as { act: string; stock: number; version: number; lockedBy: string; event: string; outcome: string; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '对比两种锁' : st.act === 'intro' ? '两事务各扣 1 件库存' : st.act === 'lost' ? '无保护：两事务并发改' : st.act === 'optimistic' ? '乐观锁（版本号）' : '悲观锁（FOR UPDATE）' },
      { k: '判定规则', v: '无保护→都读旧值都写、更新丢失。乐观锁→不加锁，更新时 WHERE version=旧，被改过就失败重试。悲观锁→先加锁 FOR UPDATE，别人阻塞等待、串行。' },
      { k: '本步结果', v: st.phase === 'done' ? '乐观锁重试、悲观锁阻塞，结果都是 8' : `${st.event}（库存 ${st.stock}${st.act === 'optimistic' ? `, v${st.version}` : ''}${st.lockedBy ? `, 🔒${st.lockedBy}` : ''}）` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; act: string; outcome: string }; return st.phase === 'done' ? '两策略对比' : st.outcome === 'fail' ? (st.act === 'lost' ? '更新丢失' : '版本不符') : st.outcome === 'block' ? 'T2阻塞' : st.outcome === 'retry' ? '重试成功' : st.act === 'optimistic' ? '乐观锁' : st.act === 'pessimistic' ? '悲观锁' : '就绪' },
    try: [{ act: '看乐观锁失败重试', watch: 'T1 更新把版本 1→2；T2 的 WHERE version=1 匹配不到、失败，重读重试才成。' }, { act: '看悲观锁阻塞', watch: 'T1 FOR UPDATE 拿锁后，T2 只能阻塞等待，等 T1 放锁才继续。' }], terms: [],
  },
  quickselect: {
    question: '求第 K 大，为什么不用全排序 O(n㏒n)，Quickselect 怎么做到平均 O(n)？',
    read: [{ at: '数组', is: '窗口高亮、pivot 标黄、目标下标标 ◎、丢掉的一半变灰。', anchor: '.qs-arr' }, { at: '读数', is: '窗口、pivot 落位、目标下标、决策。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { op: string; round: number; lo: number; hi: number; pivot: number; pivotIdx: number; target: number; decision: string; answer: number; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '命中，返回第 K 大' : st.op === 'intro' ? `数组，找目标下标 ${st.target}` : `第 ${st.round} 轮 · 窗口 [${st.lo},${st.hi}]，pivot=${st.pivot}` },
      { k: '判定规则', v: 'partition 把 pivot 放到它排序后的最终位置 P。P==目标→就是它；P>目标→只递归左半；P<目标→只递归右半。每轮丢一半，平均 O(n)。' },
      { k: '本步结果', v: st.phase === 'done' ? `pivot 落 idx${st.pivotIdx}=目标 ${st.target} → 第 3 大 = ${st.answer}` : st.op === 'round' ? `pivot ${st.pivot} 落 idx${st.pivotIdx} ${st.pivotIdx > st.target ? `> ${st.target}→递归左半 [${st.lo},${st.pivotIdx - 1}]` : `< ${st.target}→递归右半 [${st.pivotIdx + 1},${st.hi}]`}` : `目标下标 = ${st.target}` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; decision: string; answer: number }; return st.phase === 'done' ? `第3大=${st.answer}` : st.decision === 'left' ? '递归左' : st.decision === 'right' ? '递归右' : '就绪' },
    try: [{ act: '看只递归一侧', watch: 'pivot 落位和目标下标一比，就知道答案在哪半——另一半直接变灰丢掉。' }, { act: '看收敛', watch: '3 轮 partition：右丢→右搜→命中，pivot 落到目标下标 4，第 3 大 = 7。' }], terms: [],
  },
  trie: {
    question: '搜索框输入几个字母就弹候选，这套自动补全是怎么做的？',
    read: [{ at: '前缀树', is: '缩进树=Trie，绿色是前缀路径、✓ 是完整词。', anchor: '.tr-tree' }, { at: '搜索框', is: '输入的前缀，末步弹出 Top-K 建议。', anchor: '.tr-search' }],
    step: (s: never) => { const st = s as { op: string; prefix: string; walked: string; candidates: [string, number][]; suggestions: [string, number][]; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '收集完，排序出建议' : st.op === 'intro' || st.op === 'build' ? `词表建成 Trie` : st.op === 'input' ? `输入前缀「${st.prefix}」` : st.op === 'walk' ? `沿树走到 "${st.walked}"` : '在前缀节点 DFS 收集' },
      { k: '判定规则', v: 'Trie 公共前缀共享节点、末尾标完整词。补全：沿前缀路径走到前缀节点(只跟前缀长度有关) → DFS 收集子树里所有词 → 按热度排序取 Top-K。' },
      { k: '本步结果', v: st.phase === 'done' ? `按热度排 → 建议 ${st.suggestions.map(x => x[0]).join('、')}` : st.op === 'walk' ? `到达前缀 "${st.walked}" 节点` : st.candidates.length ? `子树词：${st.candidates.map(c => `${c[0]}(${c[1]})`).join('、')}` : `准备沿 "${st.prefix}" 走查` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; walked: string; candidates: unknown[] }; return st.phase === 'done' ? 'Top-K 建议' : st.op === 'walk' ? `走到${st.walked}` : st.op === 'collect' ? `收${st.candidates.length}个` : st.op === 'build' ? '建树' : '看结构' },
    try: [{ act: '看走查路径', watch: '沿 c→a→r 三步走到前缀节点——只跟前缀长度有关，和词表多大无关。' }, { act: '看收集+排序', watch: '前缀节点 DFS 收 car/card/care，按热度排 care(4)>car(3)>card(2)。' }], terms: [],
  },
  lfucache: {
    question: '缓存满了淘汰谁？LFU 为什么按"用得最少"、而不是"最久没用"？',
    read: [{ at: '缓存卡', is: '每项带 freq 频率徽章，最低频标红。', anchor: '.lfu-cards' }, { at: '读数', is: '本步、缓存(带freq)、结果。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { op: string; opDesc: string; entries: { k: number; v: number; freq: number }[]; result: number; hit: boolean; evicted: number | null; evictReason: string; bumped: number | null; capacity: number; phase: string }; const show = st.entries.map(e => `${e.k}:${e.v}(f${e.freq})`).join(' '); return [
      { k: '本步输入', v: st.phase === 'done' && st.op === 'intro' ? '走完一串操作' : st.opDesc || `容量 ${st.capacity} 的缓存` },
      { k: '判定规则', v: 'get/put 命中让该 key 频率 +1。容量满时淘汰**频率最低**的；若多个并列最低，再按**最久未用**(LRU)打破平手。这是 LFU 和 LRU 的关键差别（频率 vs 时间）。' },
      { k: '本步结果', v: st.op === 'get' ? (st.hit ? `命中返回 ${st.result}，${st.bumped} 频率+1 → ${show}` : `未命中 -1（${show}）`) : st.evicted !== null ? `淘汰 ${st.evicted}（${st.evictReason}）→ ${show}` : `插入，频率=1 → ${show}` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; hit: boolean; result: number; evicted: number | null }; return st.phase === 'done' ? 'O(1) LFU' : st.op === 'get' ? (st.hit ? `命中${st.result}` : '未命中') : st.evicted !== null ? `淘汰${st.evicted}` : '插入' },
    try: [{ act: '看按频率淘汰', watch: 'put(3) 时淘汰 2——因为 2 频率最低(f1)，1 已被 get 过(f2)。' }, { act: '看同频打平手', watch: 'put(4) 时 1 和 3 都是 f2，淘汰更久没用的 1（同频用 LRU）。' }], terms: [],
  },
  lrucache: {
    question: '怎么让缓存的 get 和 put 都是 O(1)，还能淘汰"最久没用"的？',
    read: [{ at: '双向链表', is: '头=最近用、尾=最久没用；移头/淘汰尾看这里。', anchor: '.lru-list' }, { at: 'HashMap', is: '缓存里现有的 key。', anchor: '.lru-map' }],
    step: (s: never) => { const st = s as { op: string; opDesc: string; list: { k: number; v: number }[]; result: number; hit: boolean; evicted: number | null; capacity: number; phase: string }; const show = st.list.map(n => `${n.k}:${n.v}`).join('→'); return [
      { k: '本步输入', v: st.phase === 'done' && st.op === 'intro' ? '走完一串操作' : st.opDesc || '容量 ' + st.capacity + ' 的缓存' },
      { k: '判定规则', v: 'HashMap 定位 O(1)、双向链表维序 O(1)。get 命中→移到头部；put 已存在→更新移头，不存在→插头、若超容量淘汰尾部（最久没用）。头=最近、尾=最久。' },
      { k: '本步结果', v: st.op === 'get' ? (st.hit ? `命中返回 ${st.result}，${st.opDesc.match(/\d+/)?.[0]} 移到头 → [${show}]` : `未命中 → -1（链表不变 [${show}]）`) : st.evicted !== null ? `满 ${st.capacity} → 淘汰尾部 ${st.evicted}，新节点插头 → [${show}]` : `插到头部 → [${show}]` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; hit: boolean; result: number; evicted: number | null }; return st.phase === 'done' ? 'O(1) LRU' : st.op === 'get' ? (st.hit ? `命中${st.result}` : '未命中') : st.evicted !== null ? `淘汰${st.evicted}` : '插入' },
    try: [{ act: '看命中移头', watch: 'get(1) 命中 → 把 1 移到链表头部，它成了最近使用的。' }, { act: '看满了淘汰尾', watch: 'put(3,3) 时容量满 → 淘汰尾部的 2（最久没用），3 插到头。' }], terms: [],
  },
  happensbefore: {
    question: '一个线程写了变量，另一个线程为什么不一定马上、按顺序看得见？',
    read: [{ at: '两线程', is: 'Writer 的两步写、Reader 的读，活动线程高亮。', anchor: '.hb-threads' }, { at: '结果', is: 'reader 第 4 步读到 0（旧值）还是 42。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { act: string; who: string; data: number; ready: boolean; isVolatile: boolean; readerData: number; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? 'volatile 修复完成' : st.act === 'intro' ? '共享 data、ready' : st.who === 'writer' ? `Writer：${st.ready ? 'ready=true' : 'data=42'}` : st.who === 'reader' ? 'Reader 读 data' : '声明 ready 为 volatile' },
      { k: '判定规则', v: '无同步：编译器/CPU 会重排、值滞留缓存 → 写不保证按序及时可见。volatile 写=释放屏障(刷出之前的写)、读=获取屏障(拿最新)，建立 happens-before → 保证可见有序。' },
      { k: '本步结果', v: st.phase === 'done' ? 'happens-before 保证 data=42 先于 reader 读 → 读到 42' : st.readerData === 0 ? 'reader 读到 data=0（旧值！重排/可见性 bug）' : st.readerData === 42 ? 'reader 读到 data=42 ✓' : `data=${st.data}, ready=${st.ready}${st.isVolatile ? '(volatile)' : ''}` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; readerData: number; act: string }; return st.phase === 'done' ? '保证42' : st.readerData === 0 ? '读到旧值0' : st.act === 'plain' ? '无屏障' : st.act === 'volatile' ? 'volatile' : '引入' },
    try: [{ act: '看读到旧值', watch: '无 volatile：reader 见 ready=true 却读到 data=0——顺序/可见性对它不保证。' }, { act: '看 volatile 修复', watch: '声明 volatile 后建立 happens-before，data=42 一定先于 reader 读到 → 必是 42。' }], terms: [],
  },
  aba: {
    question: 'CAS 检查了"值没变"，为什么还会被"变一圈又变回来"骗？',
    read: [{ at: '共享值 / T1 记忆', is: '当前值与 T1 读到的旧值（fixed 阶段还带版本）。', anchor: '.ab-lane' }, { at: '判定', is: 'CAS 步的期望 vs 当前，成功还是失败。', anchor: '.ab-verdict' }],
    step: (s: never) => { const st = s as { act: string; op: string; value: number; version: number; t1Read: number; t1Ver: number; casOk: boolean | null; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '版本号修复完成' : st.act === 'intro' ? 'CAS 靠"值没变"判断' : st.op === 'read' ? `T1 读到 ${st.t1Read}${st.act === 'fixed' ? `/v${st.t1Ver}` : ''}` : st.op === 'change' ? `T2 改值 → ${st.value}${st.act === 'fixed' ? `/v${st.version}` : ''}` : `T1 恢复做 CAS` },
      { k: '判定规则', v: 'CAS 只比"当前值==读到的旧值"。值 A→B→A 绕回来，只比值就以为没人动过（ABA）。修复：配单调递增版本号，比 (值,版本)，版本回不去就能识破。' },
      { k: '本步结果', v: st.phase === 'done' ? `期望(100,v1)≠当前(100,v3) → CAS 正确失败` : st.op === 'cas' ? (st.casOk ? `期望100=当前100 → 误判成功✗（其实变过两次）` : `值同但版本 v${st.t1Ver}≠v${st.version} → 正确失败✓`) : `共享值=${st.value}${st.act === 'fixed' ? `/v${st.version}` : ''}` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; casOk: boolean | null; act: string }; return st.phase === 'done' ? '版本号识破' : st.casOk === true ? 'ABA 误判' : st.casOk === false ? '正确失败' : st.act === 'buggy' ? '无版本' : st.act === 'fixed' ? '有版本' : 'CAS' },
    try: [{ act: '看无版本被骗', watch: '值 100→200→100 绕回，T1 的 CAS 期望 100、当前 100 → 误判成功。' }, { act: '看版本号识破', watch: '加版本后值虽同(100)但 v1≠v3，CAS 正确失败——AtomicStampedReference 就这么干。' }], terms: [],
  },
  rwlock: {
    question: '读操作互不干扰，为什么还要用一把锁串起来？读写锁怎么放宽？',
    read: [{ at: '锁持有区', is: '当前持读锁的读者们，或独占的写者。', anchor: '.rw-lock' }, { at: '等待队列', is: '进不来、在排队的请求。', anchor: '.rw-queue' }],
    step: (s: never) => { const st = s as { op: string; who: string; readers: string[]; writer: string | null; waitQ: { who: string; type: string }[]; event: string; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '看完流转，收结论' : st.op === 'intro' ? '一串加/解锁请求' : st.event },
      { k: '判定规则', v: '读读共享：无写者时读者随便进、可多个同时持有。写者独占：有任何读者或写者在，写请求就阻塞排队；写者持锁时所有人都进不来。锁一释放按队首条件唤醒。' },
      { k: '本步结果', v: st.phase === 'done' ? '读多写少吞吐高，但要防写饥饿' : `持有者=${st.writer ? `写者 ${st.writer}(独占)` : st.readers.length ? `读者 {${st.readers.join(',')}}(共享)` : '空闲'}；等待队列 [${st.waitQ.map(w => w.who).join(',') || '空'}]` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string }; return st.phase === 'done' ? '读共享写独占' : st.op === 'grantR' ? '读获准' : st.op === 'grantW' ? '写独占' : st.op === 'block' ? '阻塞排队' : st.op === 'release' ? '释放' : '就绪' },
    try: [{ act: '看读读共享', watch: 'R1、R2 都拿到读锁、同时持有——读并发不互相阻塞。' }, { act: '看写者等读者', watch: 'W1 请求写时有读者在 → 排队；等 R1、R2 都释放，W1 才独占进入。' }], terms: [],
  },
  compositeindex: {
    question: '有复合索引 idx(a,b,c)，哪些查询能用上它、哪些还要回表？',
    read: [{ at: '索引三列', is: 'a/b/c，绿色是本查询能用的最左前缀。', anchor: '.ci-index' }, { at: '结果表', is: '每条查询用到的前缀 + 是否回表。', anchor: '.ci-hist' }],
    step: (s: never) => { const st = s as { op: string; qi: number; where: string[]; select: string[]; prefix: string[]; usesIndex: boolean; covering: boolean; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '两条规则总结' : st.op === 'query' ? `Q${st.qi + 1}: WHERE ${st.where.map(c => `${c}=?`).join(' AND ')} · SELECT ${st.select.join(',')}` : '复合索引 idx(a,b,c)' },
      { k: '判定规则', v: '最左前缀：从最左列 a 起、连续命中的等值条件才能定位（跳列/断层后面就用不上）。覆盖索引：SELECT 的列全在索引里就不用回表。' },
      { k: '本步结果', v: st.phase === 'done' ? '列顺序决定能不能用；SELECT 列决定回不回表' : st.op === 'query' ? (st.usesIndex ? `走索引 (${st.prefix.join(',')})${st.covering ? '，覆盖不回表' : '，非覆盖要回表'}` : '违反最左前缀 → 全表扫描') : 'idx 按 (a,b,c) 排序' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; usesIndex: boolean; covering: boolean }; return st.phase === 'done' ? '两规则' : st.op === 'query' ? (st.usesIndex ? (st.covering ? '走索引·不回表' : '走索引·回表') : '全表扫') : 'idx' },
    try: [{ act: '看跳列失效', watch: 'WHERE b=?（跳过最左列 a）→ 整个索引用不上，走全表扫。' }, { act: '看回表', watch: 'SELECT 里出现索引外的列 d → 得回主键树捞整行（回表），比覆盖索引慢。' }], terms: [],
  },
  joins: {
    question: '同一个 JOIN，数据库为什么有时走 Hash、有时走 Nested Loop？',
    read: [{ at: '两表', is: 'Users.id 与 Orders.uid，当前算法怎么配对。', anchor: '.jn-tables' }, { at: '代价', is: '末步三算法的比较次数对比。', anchor: '.jn-costs' }],
    step: (s: never) => { const st = s as { algo: string; op: string; cost: number; matches: unknown[]; costs: { nlj: number; hash: number; smj: number }; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '三算法代价对比' : st.algo === 'nlj' ? 'Nested Loop：外表每行×内表每行' : st.op === 'build' ? 'Hash：对小表建哈希表' : st.op === 'probe' ? 'Hash：大表逐行探测' : st.op === 'sort' ? 'Sort-Merge：两表排序' : st.op === 'merge' ? 'Sort-Merge：双指针归并' : '同一对表，三种算法' },
      { k: '判定规则', v: 'NLJ 比较 |N|×|M| 次(任意条件但会平方爆炸)；Hash 建小表+探大表 O(N+M)(等值主力、吃内存)；Sort-Merge 排序+归并(已排序/要有序/范围连接最好)。优化器按数据估代价选。' },
      { k: '本步结果', v: st.phase === 'done' ? `NLJ ${st.costs.nlj} / Hash ${st.costs.hash} / SMJ ${st.costs.smj}(+排序)` : st.cost > 0 ? `本算法代价 ${st.cost} 次/步，${st.matches.length} 个匹配` : st.op === 'build' ? '哈希表建好 {1,2,3}' : st.op === 'sort' ? '两表按连接键排好' : '同一个 JOIN 的三条路' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; algo: string; op: string }; return st.phase === 'done' ? 'Hash/SMJ 更省' : st.algo === 'nlj' ? 'NLJ' : st.algo === 'hash' ? (st.op === 'build' ? 'build' : 'probe') : st.algo === 'smj' ? (st.op === 'sort' ? '排序' : '归并') : '就绪' },
    try: [{ act: '数 NLJ 的比较', watch: '外表 3 行 × 内表 4 行 = 12 次比较，表一大就平方爆炸。' }, { act: '看 Hash 省在哪', watch: '建表 3 + 探测 4 = 7 次，O(N+M)——大表等值连接就靠它。' }], terms: [],
  },
  circuitbreaker: {
    question: '下游服务挂了，怎么不让它把上游一起拖垮、还能自动探测恢复？',
    read: [{ at: '三态', is: 'Closed / Open / Half-Open，当前态高亮。', anchor: '.cb-states' }, { at: '读数', is: '状态、失败计数/阈值、本步结果。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { op: string; cstate: string; fails: number; threshold: number; outcome: string; phase: string }; const nm = st.cstate === 'closed' ? 'Closed' : st.cstate === 'open' ? 'Open' : 'Half-Open'; return [
      { k: '本步输入', v: st.phase === 'done' ? '探测成功，收结论' : st.op === 'intro' ? '三态机：Closed/Open/Half-Open' : st.op === 'timeout' ? 'Open 冷却超时到' : st.op === 'probe' ? 'Half-Open 放探测请求' : `[${nm}] 一个请求` },
      { k: '判定规则', v: 'Closed：放行+累计失败，失败≥阈值→跳 Open；Open：请求快速失败(不打下游)，超时→Half-Open；Half-Open：探测成功→Closed(清零)、失败→退回 Open。' },
      { k: '本步结果', v: st.phase === 'done' ? '→ Closed，失败计数清零，恢复正常' : st.op === 'trip' ? `失败 ${st.fails}≥阈值${st.threshold} → 跳闸到 Open` : st.op === 'reject' ? 'Open：快速失败，未调用下游' : st.op === 'timeout' ? '→ Half-Open，放探测' : st.op === 'probe' ? '探测成功，下游像是恢复了' : `[${nm}] ${st.outcome}（失败计数 ${st.fails}/${st.threshold}）` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; cstate: string; fails: number; threshold: number }; return st.phase === 'done' ? '恢复 Closed' : st.op === 'trip' ? '跳闸熔断' : st.op === 'reject' ? '快速失败' : st.op === 'timeout' || st.op === 'probe' ? '试探' : st.cstate === 'closed' ? `失败${st.fails}/${st.threshold}` : '就绪' },
    try: [{ act: '看攒够失败跳闸', watch: 'Closed 里连续失败到 3（阈值）→ 立刻跳 Open，从此不打下游。' }, { act: '看试探恢复', watch: 'Open 超时→Half-Open 放探测，成功就回 Closed、计数清零；失败会退回 Open。' }], terms: [],
  },
  quorum: {
    question: '数据存多份副本，写几份、读几份，才能保证读到的一定是最新写的？',
    read: [{ at: '副本行', is: '5 份副本的版本；写份/读份/重叠各有标记。', anchor: '.qm-reps' }, { at: '不等式', is: 'W+R vs N，>N 才保证重叠。', anchor: '.qm-ineq' }],
    step: (s: never) => { const st = s as { op: string; N: number; W: number; R: number; overlap: number[]; readVer: number; readVal: string; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '反例：R 调小到 2' : st.op === 'intro' ? `N=${st.N} 份副本，写 W=${st.W}、读 R=${st.R}` : st.op === 'init' ? '5 份都是 v1(A)' : st.op === 'write' ? `写 W=${st.W} 份 → {R0,R1,R2} 升 v2(B)` : st.op === 'read' ? `读 R=${st.R} 份 → {R2,R3,R4}` : '判定重叠' },
      { k: '判定规则', v: '写只等 W 份确认、读只取 R 份里版本最新的。W+R>N 时，读集与写集在 N 份里必有重叠(鸽巢)，重叠那份带最新写→读一定不漏；W+R≤N 则可能零重叠、读到旧值。' },
      { k: '本步结果', v: st.phase === 'done' ? '读集{R3,R4}零重叠 → 读到旧 v1(A)，漏掉新写' : st.op === 'verdict' ? `W+R=${st.W + st.R}>${st.N}→重叠 R${st.overlap.join(',')}→读到 v${st.readVer}(${st.readVal})` : st.op === 'write' ? '{R0,R1,R2}=v2、R3/R4 还是 v1' : st.op === 'read' ? '读集含 R2(v2) 和 R3/R4(v1)' : `N/W/R = ${st.N}/${st.W}/${st.R}` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; overlap: number[] }; return st.phase === 'done' ? '反例:读旧值' : st.op === 'verdict' ? '读到最新' : st.op === 'write' ? '写W份' : st.op === 'read' ? '读R份' : '就绪' },
    try: [{ act: '看重叠副本', watch: '写集{R0,R1,R2}、读集{R2,R3,R4}——W+R=6>5，必然在 R2 重叠，那份带最新 v2。' }, { act: '看反例', watch: 'R 调到 2、读集{R3,R4}时，和写集零重叠→读到旧 v1，这就是 W+R≤N 的坑。' }], terms: [],
  },
  vectorclock: {
    question: '没有全局时钟，怎么判断两个分布式事件谁先谁后、还是根本没关系（并发）？',
    read: [{ at: '三进程', is: '每个进程当前的向量 [P0,P1,P2]，活动进程高亮。', anchor: '.vc-procs' }, { at: '判定', is: '末步两对事件的因果/并发结论。', anchor: '.vc-cmp' }],
    step: (s: never) => { const st = s as { op: string; proc: number; label: string; clocks: number[][]; msg: number[] | null; phase: string }; const P = ['P0', 'P1', 'P2']; return [
      { k: '本步输入', v: st.phase === 'done' ? '比两对事件的向量' : st.op === 'intro' ? '三进程各从 [0,0,0] 开始' : `事件 ${st.label}（${P[st.proc]} ${st.op === 'local' ? '本地' : st.op === 'send' ? '发消息' : '收消息'}）` },
      { k: '判定规则', v: '本地事件→自己那位+1；发消息→自己+1、向量随消息带走；收消息→逐位取max(本地,收到)再自己+1。判先后：每位≤且不全等=因果先行，互不≤=并发。' },
      { k: '本步结果', v: st.phase === 'done' ? 'a→e 因果（每位≤）；f 与 e 并发（互不≤）' : st.op === 'intro' ? '三个 [0,0,0]' : `${P[st.proc]} 向量 = [${st.clocks[st.proc]!.join(',')}]${st.msg && st.op !== 'local' ? `，消息带 [${st.msg.join(',')}]` : ''}` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; label: string; proc: number }; return st.phase === 'done' ? '因果/并发已判' : st.op === 'recv' ? `${['P0', 'P1', 'P2'][st.proc]} max` : st.label ? `事件${st.label}` : '就绪' },
    try: [{ act: '看收消息取 max', watch: 'P1 收到 [2,0,0] → 逐位 max 再自增 → [2,1,0]，把 P0 的进度并了进来。' }, { act: '看末步判定', watch: 'a 每位≤e→因果；f 和 e 互相都不≤→并发（各干各的）。' }], terms: [],
  },
  snowflake: {
    question: '分布式下每台机器都要发 ID，怎么做到全局唯一、还大致按时间递增、又不互相协调？',
    read: [{ at: '位布局', is: '64 位切三段：时间戳 / 机器码 / 序号。', anchor: '.sf-layout' }, { at: '已发 ID', is: '同毫秒 ID 只 +1、跨毫秒跳一大截。', anchor: '.sf-hist' }],
    step: (s: never) => { const st = s as { op: string; t: number; machine: number; seq: number; id: number; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '看完生成，收结论' : st.op === 'intro' ? '64 位布局：1符号+41时间戳+10机器+12序号' : `t=${st.t}ms，序号 ${st.seq}` },
      { k: '判定规则', v: 'ID = (时间戳<<22)|(机器码<<12)|序号。时间戳在高位→趋势递增；机器码不同→不同机不撞；同毫秒序号自增、跨毫秒归零。全本地生成，不问中心。' },
      { k: '本步结果', v: st.phase === 'done' ? '全局唯一+趋势递增+零协调（注意时钟回拨）' : st.op === 'intro' ? `本机机器码 = ${st.machine}` : `ID = ${st.id}（时间${st.t}|机器${st.machine}|序号${st.seq}）` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; seq: number }; return st.phase === 'done' ? '唯一+递增' : st.op === 'same' ? `序号${st.seq}` : st.op === 'next' ? '新毫秒' : st.op === 'gen' ? '首个ID' : '看布局' },
    try: [{ act: '看同毫秒 +1', watch: 't=1000ms 连发 3 个，ID 只 +1（序号自增），同毫秒也不撞。' }, { act: '看跨毫秒', watch: 't 进到 1001ms，序号归零、ID 跳一大截——时间戳在高位，所以整体递增。' }], terms: [],
  },
  totp: {
    question: '手机验证器那个每 30 秒变的 6 位码，是怎么和服务器对上的？',
    read: [{ at: '管线', is: '时间 → ⌊÷30⌋ 窗口 → HMAC → 截断 → 6 位码。', anchor: '.tp-pipe' }, { at: '读数', is: '当前时间、时间窗 T、6 位码。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { op: string; t: number; T: number; code: string; prevCode: string; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '服务器验证' : st.op === 'intro' ? 'TOTP 目标：离线算出同一个码' : `当前时间 t=${st.t}s` },
      { k: '判定规则', v: '码 = 截断(HMAC(K, T))，T=⌊t/30⌋。同一 30 秒窗口 T 不变 → 码不变；跨窗口 T+1 → HMAC 全变 → 新码。手机和服务器共享 K，各自看时间算，不用通信。' },
      { k: '本步结果', v: st.phase === 'done' ? `服务器用同 K 算 T=${st.T} 得 ${st.code}，一致→放行（容 ±1 窗口时钟差）` : st.op === 'code' ? `T=${st.T} → 码 ${st.code}` : st.op === 'same' ? `还在窗口 ${st.T}，码不变 ${st.code}` : st.op === 'next' ? `跳到窗口 ${st.T}，换新码 ${st.code}（旧 ${st.prevCode} 作废）` : '共享密钥 + 当前时间' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; code: string }; return st.phase === 'done' ? '验证通过' : st.op === 'next' ? '换新码' : st.op === 'same' ? '码不变' : st.op === 'code' ? st.code : '看目标' },
    try: [{ act: '看同窗不变', watch: 't=0/15/29s 都在窗口 0，码一直是 790815——给你 30 秒时间输入。' }, { act: '看换窗翻码', watch: 't=30s 进窗口 1，HMAC 全变 → 新码 094198，旧码作废。' }], terms: [],
  },
  hmac: {
    question: '怎么给消息盖一个"只有持密钥者算得出、改一字节就露馅"的标签？',
    read: [{ at: '两条泳道', is: '内层 K⊕ipad‖m→H，外层 K⊕opad‖inner→H。', anchor: '.hm-pipe' }, { at: '读数', is: '内层 inner、HMAC 标签、篡改后。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { op: string; ki: number[]; inner: number; mac: number; tamperMac: number; phase: string }; const hx = (n: number) => n < 0 ? '—' : n.toString(16).padStart(2, '0'); return [
      { k: '本步输入', v: st.phase === 'done' ? '四步算完，做篡改验证' : st.op === 'intro' ? 'MAC 目标：带密钥的防篡改标签' : st.op === 'ipad' ? 'K ⊕ ipad(0x36)' : st.op === 'inner' ? '内层 H(K⊕ipad ‖ m)' : st.op === 'opad' ? 'K ⊕ opad(0x5c)' : '外层 H(K⊕opad ‖ inner)' },
      { k: '判定规则', v: 'HMAC=H((K⊕opad)‖H((K⊕ipad)‖m))。密钥在内外两层各揉一次，堵住 H(K‖m) 的长度扩展攻击；标签的计算离不开 K，所以没密钥算不出、改消息必对不上。' },
      { k: '本步结果', v: st.phase === 'done' ? `篡改后重算 ${hx(st.tamperMac)} ≠ 原 ${hx(st.mac)} → 拒收` : st.op === 'ipad' ? `K⊕ipad = ${st.ki.map(x => x.toString(16).padStart(2, '0')).join(' ')}` : st.op === 'inner' ? `inner = ${hx(st.inner)}` : st.op === 'outer' ? `HMAC = ${hx(st.mac)}` : st.op === 'opad' ? 'K⊕opad 算好，进外层' : '直接 H(m) 无密钥、H(K‖m) 有隐患' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string; mac: number }; return st.phase === 'done' ? '防篡改' : st.op === 'intro' ? '看目标' : st.op === 'ipad' || st.op === 'opad' ? '异或' : st.op === 'inner' ? '内层H' : '外层H' },
    try: [{ act: '看密钥揉两次', watch: 'K⊕ipad 进内层、K⊕opad 进外层——密钥内外各一次，是它比 H(K‖m) 稳的关键。' }, { act: '看篡改验证', watch: "改 'Hi'→'Hj'，重算标签 06≠原 05，收方一比对就拒收。" }], terms: [],
  },
  aesround: {
    question: 'AES 把明文摆成 4×4 矩阵，一轮里对它做了哪四件事？',
    read: [{ at: '矩阵', is: '4×4 状态，本步改动的格子高亮。', anchor: '.aes-stage' }, { at: '四步条', is: '当前走到 Sub/Shift/Mix/AddKey 哪步。', anchor: '.aes-flow' }],
    step: (s: never) => { const st = s as { op: string; mat: number[]; phase: string }; const first = st.mat.length ? st.mat[0]!.toString(16).padStart(2, '0') : '—'; return [
      { k: '本步输入', v: st.phase === 'done' ? '四步走完' : st.op === 'intro' ? '16 字节明文摆成 4×4 矩阵' : st.op === 'addkey0' ? '轮开始：状态 ⊕ 初始密钥' : st.op === 'sub' ? 'SubBytes：逐字节查 S-盒' : st.op === 'shift' ? 'ShiftRows：每行循环左移' : st.op === 'mix' ? 'MixColumns：每列 GF 混合' : 'AddRoundKey：⊕ 本轮密钥' },
      { k: '判定规则', v: 'SubBytes=非线性混淆(查S盒)；ShiftRows(行移位)+MixColumns(列GF混合)=扩散；AddRoundKey=把密钥异或进来。混淆+扩散反复叠加，几轮后每个密文位都依赖所有明文位和密钥位。' },
      { k: '本步结果', v: st.phase === 'done' ? '一轮完成，状态首字节 a4（对标 FIPS-197）' : `状态首字节 ${first}${st.op === 'sub' ? '（每格都因查表而变）' : st.op === 'shift' ? '（只搬位置）' : st.op === 'mix' ? '（整列重算）' : ''}` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; op: string }; return st.phase === 'done' ? '一轮完成' : st.op === 'intro' ? '摆矩阵' : st.op === 'sub' ? 'SubBytes' : st.op === 'shift' ? 'ShiftRows' : st.op === 'mix' ? 'MixColumns' : 'AddRoundKey' },
    try: [{ act: '盯高亮格子', watch: 'SubBytes 每格都变(查表)、ShiftRows 只搬位置、MixColumns 整列重算、AddRoundKey 逐字节异或密钥。' }, { act: '分清混淆/扩散', watch: 'SubBytes 混淆(唯一非线性)，ShiftRows/MixColumns 扩散，AddRoundKey 混入密钥。' }], terms: [],
  },
  birthday: {
    question: '一屋子多少人就有过半概率两人同天生日？为什么这关系到哈希安全？',
    read: [{ at: '量表', is: '碰撞概率随人数涨，50% 是那条虚线。', anchor: '.bd-gauge' }, { at: '读数', is: '人数、可撞对数 C(k,2)、碰撞概率。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { k: number; pairs: number; pColl: number; crossed50: boolean; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '看完概率飙升，收结论' : st.k === 0 ? '空屋，问要多少人' : `屋里 ${st.k} 个人` },
      { k: '判定规则', v: '比的是"任意一对"是否相同，对数 C(k,2)≈k²/2 随人数平方涨。概率 P = 1 − ∏(N−i)/N，在约 √N(≈23) 处就过半。哈希同理：n 位输出找碰撞只要约 2^(n/2) 次。' },
      { k: '本步结果', v: st.phase === 'done' ? 'n 位哈希碰撞约 2^(n/2) 次 → 抗碰撞位数要翻倍(用 SHA-256)' : st.k === 0 ? '直觉说 183，其实远不用' : `可撞 ${st.pairs} 对，碰撞概率 ${(st.pColl * 100).toFixed(1)}%${st.crossed50 ? '（已过半）' : ''}` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; crossed50: boolean; pColl: number }; return st.phase === 'done' ? '√N 规律' : st.crossed50 ? `${Math.round(st.pColl * 100)}% 过半` : '概率涨' },
    try: [{ act: '盯 50% 那条线', watch: '概率在第 23 人处越过 50%——远不用 183 人。' }, { act: '想哈希', watch: 'N=2ⁿ 时碰撞约 2^(n/2) 次：256 位才有 2¹²⁸ 的碰撞难度。' }], terms: [],
  },
  ecbcbc: {
    question: '同样一批明文，为什么用 ECB 加密会「泄露」而 CBC 不会？',
    read: [{ at: '三行', is: '明文 / ECB 密文 / CBC 密文，颜色相同=值相同。', anchor: '.ec-rows' }, { at: '读数', is: '当前模式、ECB/CBC 的重复块结论。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { mode: string; blockIdx: number; ecbC: number[]; cbcC: number[]; ecbLeak: boolean; cbcSafe: boolean; expr: string; phase: string }; const bin = (n: number) => n.toString(2).padStart(4, '0'); return [
      { k: '本步输入', v: st.phase === 'done' ? '两种模式都加密完' : st.mode === 'intro' ? '明文 P，其中 P1=P3=1010(重复块)' : st.blockIdx >= 0 ? `${st.mode.toUpperCase()} 加密第 ${st.blockIdx + 1} 块` : `${st.mode.toUpperCase()} 小结` },
      { k: '判定规则', v: 'ECB：每块独立 C=E(P)，相同明文块→相同密文块。CBC：每块先和上一块密文异或再加密 C=E(P⊕C₋₁)，链接把重复打散。这里 E(x)=x⊕K 便于手算。' },
      { k: '本步结果', v: st.phase === 'done' ? `ECB C1=C3(泄露)、CBC C1≠C3(打散)` : st.expr ? st.expr : st.mode === 'ecb' && st.ecbC.length === 4 ? `ECB=[${st.ecbC.map(bin).join(' ')}]，C1=C3=${bin(st.ecbC[0]!)}` : st.mode === 'cbc' && st.cbcC.length === 4 ? `CBC=[${st.cbcC.map(bin).join(' ')}]，C1≠C3` : '明文 P1=P3=1010' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; mode: string; ecbLeak: boolean }; return st.phase === 'done' ? 'CBC 打散' : st.mode === 'ecb' && st.ecbLeak ? 'ECB 泄露' : st.mode === 'intro' ? '看明文' : st.mode.toUpperCase() },
    try: [{ act: '盯第 1、3 块', watch: 'ECB 行里 C1、C3 颜色一样(值相同=泄露)；CBC 行里两块颜色不同。' }, { act: '想为什么', watch: 'ECB 块独立→重复必现；CBC 靠前一块密文参与异或，把相同明文块打散。' }], terms: [],
  },
  otpreuse: {
    question: '一次一密理论不可破，为什么密钥绝不能重复用？',
    read: [{ at: '三行', is: '两段密文与它们的异或；红=已揭示的 m1⊕m2。', anchor: '.cx-rows' }, { at: '读数', is: '本位异或、泄露的 m1⊕m2。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { pos: number; c1: number[]; c2: number[]; xorbit: number; m1xm2: number[]; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '8 位异或完' : `第 ${st.pos + 1} 位：c1=${st.c1[st.pos]}、c2=${st.c2[st.pos]}` },
      { k: '判定规则', v: 'c1=m1⊕k、c2=m2⊕k。把两段密文异或：c1⊕c2 = m1⊕m2⊕(k⊕k) = m1⊕m2——**密钥被抵消**。' },
      { k: '本步结果', v: st.phase === 'done' ? `泄露 m1⊕m2 = **${st.m1xm2.join('')}**` : `c1⊕c2 = **${st.xorbit}** (= m1⊕m2 这一位)` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; m1xm2: number[]; xorbit: number }; return st.phase === 'done' ? '密钥泄露' : `${st.xorbit >= 0 ? st.xorbit : '?'}` },
    try: [{ act: '按「下一步」异或两密文', watch: '每位 k⊕k 抵消，剩下的正是 m1⊕m2。' }, { act: '想后果', watch: '拿到 m1⊕m2，若知道一条明文，另一条直接还原。' }], terms: [],
  },
  wal: {
    question: '已提交的写，怎么保证宕机也不丢？',
    read: [{ at: '日志/数据', is: '左=WAL 日志(先落盘)、右=数据页。', anchor: '.wal-cols' }, { at: '读数', is: '本步、数据页、日志/已应用。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { data: number; wal: string[]; applied: number; act: string; crashed: boolean; phase: string }; return [
      { k: '本步输入', v: st.crashed ? '宕机发生' : st.act === 'log' ? '要改数据，先写日志' : st.act === 'apply' ? '日志已落盘' : st.act === 'replay' ? '重启恢复' : '完成' },
      { k: '判定规则', v: '铁律「先日志后数据」：任何修改先顺序追加到日志并 fsync 落盘，再改数据页。崩溃后扫日志，重放"记了没应用"的操作。' },
      { k: '本步结果', v: st.crashed ? `数据页停在 x=${st.data}，但日志里记着后续写` : st.act === 'replay' ? `重放 → 数据页 x=${st.data}，没丢` : st.act === 'log' ? `日志 +1 条(数据页仍 ${st.data})` : `数据页 x=${st.data}` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; data: number; crashed: boolean }; return st.crashed ? '宕机' : st.phase === 'done' ? `恢复 x=${st.data}` : `x=${st.data}` },
    try: [{ act: '按「下一步」走一遍', watch: '先写日志、再改数据；宕机后重放日志恢复。' }, { act: '想为什么', watch: '日志是顺序写(快)，只要它落盘，数据页没刷也能补回来。' }], terms: [],
  },
  lsm: {
    question: 'LevelDB/RocksDB 写为什么这么快？',
    read: [{ at: 'memtable', is: '内存里的有序缓冲(满格=容量)。', anchor: '.lsm-mem' }, { at: 'SSTable', is: '磁盘上不可变的有序文件。', anchor: '.lsm-disk' }],
    step: (s: never) => { const st = s as { cap: number; memtable: string[]; sstables: string[][]; cur: string; act: string; phase: string }; return [
      { k: '本步输入', v: st.act === 'write' ? `写入 "${st.cur}"` : st.act === 'flush' ? `memtable 满(${st.cap})` : '完成' },
      { k: '判定规则', v: '写入直接进内存表 memtable(不改磁盘 B+树那种随机写)；memtable 满了就整块顺序写成一个不可变 SSTable，然后清空。' },
      { k: '本步结果', v: st.act === 'flush' ? `刷成 SSTable${st.sstables.length}，memtable 清空(0/${st.cap})` : st.act === 'write' ? `memtable=[${st.memtable.join(',')}]，${st.memtable.length}/${st.cap} 满` : `${st.sstables.length} 个 SSTable + memtable [${st.memtable.join(',')}]` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; sstables: string[][]; act: string }; return st.phase === 'done' ? `${st.sstables.length}个SST` : st.act },
    try: [{ act: '按「下一步」写入', watch: '写进内存表，满 3 个就整块刷成 SSTable。' }, { act: '想为什么快', watch: '把随机写换成内存收集+顺序刷盘，写吞吐暴涨。' }], terms: [],
  },
  tokenbucket: {
    question: '既想限住平均速率、又想容忍短时突发，怎么做？',
    read: [{ at: '桶', is: '桶里当前令牌数（满格数=容量）。', anchor: '.tb-bucket' }, { at: '读数', is: '桶中令牌、这刻放行/拒绝、累计。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { rate: number; tick: number; tokens: number; arrived: number; allowed: number; rejected: number; totalAllowed: number; totalRejected: number; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '所有时刻处理完' : `t=${st.tick}：桶剩 ${st.tokens} 令牌，来了 ${st.arrived} 个请求` },
      { k: '判定规则', v: `每刻先匀速补 ${st.rate} 个令牌(满了溢出)，再处理请求：有令牌就放行并消耗一个，没令牌就拒绝。桶容量=允许的突发量。` },
      { k: '本步结果', v: st.phase === 'done' ? `共放行 ${st.totalAllowed}、拒绝 ${st.totalRejected}` : `放行 ${st.allowed}、拒绝 ${st.rejected}` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; totalAllowed: number; allowed: number }; return st.phase === 'done' ? `放行${st.totalAllowed}` : `放${st.allowed}` },
    try: [{ act: '按「下一步」看每刻', watch: '开局突发 3 个全放行（桶满），之后被限到约每 tick 1 个。' }, { act: '想突发', watch: '桶里攒的令牌=突发额度；对比漏桶恒定速率、不容突发。' }], terms: [],
  },
  consistenthash: {
    question: '扩容加一台缓存机，为什么不能用 hash(key)%N？',
    read: [{ at: '环', is: '环 0..99 上的节点(蓝点)和键(方块→归属)。', anchor: '.ch-ring' }, { at: '读数', is: '节点数、本步、键归属。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { nodes: unknown[]; keys: { id: string; node: string }[]; cur: string; act: string; remapped: string; phase: string }; return [
      { k: '本步输入', v: st.act === 'nodes' ? '布置 3 个节点' : st.act === 'assign' ? `分配键 ${st.cur}` : st.act === 'addnode' ? '新增节点 D@60' : st.act === 'remap' ? '重新归属' : '完成' },
      { k: '判定规则', v: '节点和键都哈希到环上；每个键归给**顺时针方向第一个节点**（超过最后一个就绕回环首）。加节点只影响它到前一节点之间的键。' },
      { k: '本步结果', v: st.act === 'assign' ? `${st.cur} 归给最近节点` : st.act === 'remap' ? `只有 ${st.remapped} 从 C 搬到 D` : st.act === 'addnode' ? '只需搬一小段键' : st.phase === 'done' ? '4 键只搬 1 个' : '布置完成' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; remapped: string; act: string }; return st.phase === 'done' ? '只搬1键' : (st.remapped || st.act) },
    try: [{ act: '按「下一步」布节点分键', watch: '每个键归给顺时针最近的节点。' }, { act: '看加节点', watch: '加 D 后只有 k2 搬家，其它不动——扩容抖动极小。' }], terms: [],
  },
  skiplist: {
    question: '有序链表查一个数要 O(n)，怎么加速到 O(log n)？',
    read: [{ at: '层', is: '多层链表；蓝框=当前、浅色=走过的路。', anchor: '.sl-levels' }, { at: '读数', is: '目标、当前位置、比较次数。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { target: number; levels: number[][]; level: number; val: number; act: string; compares: number; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? `找到 ${st.target}` : `在 L${st.levels.length - 1 - st.level} 层、节点 ${st.val}，找 ${st.target}` },
      { k: '判定规则', v: '从最高层最左出发：本层下一个 ≤ 目标就往右；否则下沉一层。高层"快车道"跳过大段节点。' },
      { k: '本步结果', v: st.act === 'right' ? `往右走` : st.act === 'down' ? `下沉一层` : st.act === 'found' ? `命中 ${st.target}(比较 ${st.compares} 次)` : `从顶层出发` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; compares: number; act: string }; return st.phase === 'done' ? `${st.compares}次` : st.act },
    try: [{ act: '按「下一步」查找', watch: '能右就右、右不动就下沉，层层逼近 7。' }, { act: '数比较', watch: '4 次就命中，单层链表要走更多——O(log n)。' }], terms: [],
  },
  twopc: {
    question: '一个事务跨多个库，怎么保证要么全成、要么全败？',
    read: [{ at: '参与者', is: '3 个参与者的状态（空闲/已准备/已提交）。', anchor: '.pc-parts' }, { at: '读数', is: '协调者阶段、Yes 票、决定。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { coord: string; cur: string; yesVotes: number; decision: string; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '事务提交完成' : st.coord },
      { k: '判定规则', v: '阶段一(投票)：协调者发 Prepare，参与者干到就差落盘、锁资源，回 Yes/No。阶段二：**全 Yes 才 Commit，一个 No 或超时就全体 Abort**。' },
      { k: '本步结果', v: st.decision === 'commit' && st.cur ? `${st.cur} 落盘提交` : st.decision === 'commit' ? `全 Yes → 决定 Commit` : st.cur ? `${st.cur} 回 Yes(${st.yesVotes}/3)` : '广播 Prepare' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; decision: string; yesVotes: number }; return st.phase === 'done' ? '全提交' : (st.decision || `${st.yesVotes}/3票`) },
    try: [{ act: '按「下一步」走两阶段', watch: '先收集投票，全 Yes 才广播提交。' }, { act: '想硬伤', watch: '参与者投 Yes 后锁着资源等；协调者阶段二宕机就一直阻塞。' }], terms: [],
  },
  crt: {
    question: '除 3 余 2、除 5 余 3、除 7 余 2 的数，怎么系统地求出来？',
    read: [{ at: '条件盒', is: '几个余数条件与最终解 x。', anchor: '.cx-kv' }, { at: '读数', is: '总模、累加和、解 x。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { ns: number[]; as: number[]; N: number; idx: number; Ni: number; yi: number; term: number; acc: number; x: number; phase: string }; return [
      { k: '本步输入', v: st.idx < 0 && st.phase !== 'done' ? `${st.ns.length} 个条件、总模 N=${st.N}` : st.phase === 'done' ? '全部条件已合并' : `第 ${st.idx + 1} 条：x mod ${st.ns[st.idx]} = ${st.as[st.idx]}` },
      { k: '判定规则', v: '模两两互质则唯一解。对每条算 N_i=N/n_i、它模 n_i 的逆 y_i，x = Σ a_i·N_i·y_i mod N——每项只在自己模下生效。' },
      { k: '本步结果', v: st.phase === 'done' ? `x = **${st.x}**` : st.idx >= 0 ? `贡献项 ${st.as[st.idx]}×${st.Ni}×${st.yi}=${st.term}，累加 ${st.acc}` : `准备构造` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; x: number; idx: number }; return st.phase === 'done' ? `x=${st.x}` : `第${st.idx + 1}条` },
    try: [{ act: '按「下一步」逐条合并', watch: '每条算出一个贡献项，累加起来。' }, { act: '验证', watch: 'x=23：÷3余2、÷5余3、÷7余2，全对。' }], terms: [],
  },
  fermat: {
    question: '几百位的数怎么快速判断是不是素数？',
    read: [{ at: '数值盒', is: '测试对象 n、底 a、a^(n-1) mod n。', anchor: '.cx-kv' }, { at: '读数', is: '测试对象、要算的式子、结果、判定。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { n: number; a: number; bitPos: number; bit: number; result: number; verdict: string; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? `算完 ${st.a}^${st.n - 1} mod ${st.n}` : st.bitPos < 0 ? `测 n=${st.n}、底 a=${st.a}` : `指数第 ${st.bitPos} 位=${st.bit}` },
      { k: '判定规则', v: '费马小定理：素数 p 有 a^(p-1)≡1 (mod p)。反过来：算 a^(n-1) mod n，≠1 铁证是合数；=1 只是"很可能素数"。' },
      { k: '本步结果', v: st.phase === 'done' ? `= ${st.result} → **${st.verdict}**` : st.bit >= 0 ? `当前结果 ${st.result}` : '开始模幂' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; verdict: string; result: number }; return st.phase === 'done' ? st.verdict : `${st.result}` },
    try: [{ act: '按「下一步」算模幂', watch: '用快速模幂算 2^14 mod 15。' }, { act: '看判定', watch: '结果=4≠1 → 15 一定是合数，当场揪出。' }], terms: [],
  },
  salt: {
    question: '密码存哈希还不够——为什么一定要「加盐」？',
    read: [{ at: '哈希盒', is: '两个用户不加盐/加盐后存的哈希。', anchor: '.cx-kv' }, { at: '读数', is: '密码、不加盐、加盐。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { pw: string; noSaltA: number; saltedA: number; saltedB: number; stage: string; phase: string }; return [
      { k: '本步输入', v: st.stage === 'pw' ? `两人同用密码 "${st.pw}"` : st.stage === 'nosalt' ? '不加盐直接哈希' : st.stage === 'salted' ? '每人配随机盐再哈希' : '完成' },
      { k: '判定规则', v: '不加盐：hash(密码)——同密码同哈希，彩虹表可批量破。加盐：hash(盐+密码)——同密码因盐不同而哈希不同，彩虹表失效。' },
      { k: '本步结果', v: st.stage === 'nosalt' ? `两人哈希都是 ${st.noSaltA}(**相同**)` : st.stage === 'salted' || st.phase === 'done' ? `加盐后 ${st.saltedA} ≠ ${st.saltedB}(**不同**)` : '两人密码相同' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; stage: string }; return st.phase === 'done' ? '加盐即不同' : st.stage },
    try: [{ act: '按「下一步」对比', watch: '不加盐两人哈希一样，加盐就不一样了。' }, { act: '想意义', watch: '盐打散哈希，让彩虹表和批量破解失效。' }], terms: [],
  },
  extgcd: {
    question: 'RSA 求私钥 d 那一步——怎么求 e 关于模 m 的逆元？',
    read: [{ at: '数值盒', is: '余数 r、商 q、系数 t，迭代更新。', anchor: '.cx-kv' }, { at: '读数', is: '要求什么、本步商、逆元。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { e: number; m: number; q: number; r: number; newr: number; t: number; newt: number; result: number; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? `辗转相除结束` : `余数 ${st.r}、${st.newr}` },
      { k: '判定规则', v: '一边辗转相除求 gcd，一边回带系数 t：q=⌊r/newr⌋，同步更新余数和系数。gcd=1 才有逆。' },
      { k: '本步结果', v: st.phase === 'done' ? `逆元 **d=${st.result}**（${st.e}×${st.result}≡1 mod ${st.m}）` : `商 q=${st.q}，系数更新为 ${st.t - st.q * st.newt}` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; result: number; q: number }; return st.phase === 'done' ? `d=${st.result}` : `q=${st.q}` },
    try: [{ act: '按「下一步」迭代', watch: '每步一个商，系数跟着回带。' }, { act: '看结果', watch: 'gcd=1，系数取模就是逆元 d=7——RSA 私钥就这么来。' }], terms: [],
  },
  signature: {
    question: '怎么证明消息没被改、且确实是你发的？',
    read: [{ at: '数值盒', is: '哈希 h、签名 s、验证结果。', anchor: '.cx-kv' }, { at: '读数', is: '哈希、签名、验证。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { hash: number; sig: number; recvHash: number; verified: number; ok: boolean; stage: string; phase: string }; return [
      { k: '本步输入', v: st.stage === 'hash' ? '对消息算哈希' : st.stage === 'sign' ? '用私钥签名' : st.stage === 'verify' ? '接收方重算哈希' : st.stage === 'check' ? '用公钥验证' : '完成' },
      { k: '判定规则', v: '加密是公钥加/私钥解；签名反过来——**私钥签名 s=h^d mod n、公钥验证 s^e mod n**，等于哈希就通过。' },
      { k: '本步结果', v: st.stage === 'sign' ? `签名 s=**${st.sig}**` : st.stage === 'check' ? `验证=${st.verified}，${st.ok ? '通过✓' : '失败'}` : st.stage === 'hash' ? `h=${st.hash}` : st.stage === 'verify' ? `h'=${st.recvHash}` : `验证${st.ok ? '通过' : '失败'}` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; ok: boolean; stage: string }; return st.phase === 'done' ? (st.ok ? '验证通过' : '验证失败') : st.stage },
    try: [{ act: '按「下一步」签名+验证', watch: '私钥签出 s，公钥验证 s^e=哈希。' }, { act: '想篡改', watch: '消息一改，重算的 h′ 变，而验证仍得原 h，对不上就露馅。' }], terms: [],
  },
  hashaval: {
    question: '好的哈希函数，输入改一点点，输出会怎样？',
    read: [{ at: '两行', is: '两个哈希的二进制；红=翻转、绿=相同。', anchor: '.cx-rows' }, { at: '读数', is: '对比对象、两个哈希、翻转位数。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { a: string; b: string; bitsA: number[]; bitsB: number[]; pos: number; flipped: number; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? `16 位比较完` : `第 ${st.pos + 1} 位：${st.bitsA[st.pos]} vs ${st.bitsB[st.pos]}` },
      { k: '判定规则', v: '好的密码学哈希有**雪崩效应**：输入 1 位之差，输出约一半的位翻转，且不可预测。' },
      { k: '本步结果', v: st.phase === 'done' ? `共翻转 **${st.flipped}/16** 位(≈一半)` : `${st.bitsA[st.pos] !== st.bitsB[st.pos] ? '翻转' : '相同'}，累计 ${st.flipped}` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; flipped: number }; return st.phase === 'done' ? `翻转 ${st.flipped}/16` : `翻 ${st.flipped}` },
    try: [{ act: '按「下一步」逐位比', watch: '"cat"→"cot" 一个字母，哈希翻了 8/16 位。' }, { act: '想意义', watch: '改一点就面目全非，攻击者没法一点点凑出想要的哈希——防篡改根基。' }], terms: [],
  },
  merkle: {
    question: '怎么用一个小哈希，守住一大堆数据没被改？',
    read: [{ at: '树', is: '叶子→父→根，自底向上；亮=已算。', anchor: '.mk-tree' }, { at: '读数', is: '本步、叶子/父/根哈希。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { data: number[]; leaves: number[]; parents: number[]; root: number; act: string; focus: number; phase: string }; return [
      { k: '本步输入', v: st.act === 'leaf' ? `数据块 ${st.data[st.focus]}` : st.act === 'parent' ? `两个子哈希 L${st.focus * 2}、L${st.focus * 2 + 1}` : st.act === 'root' ? '两个父 P0、P1' : '完成' },
      { k: '判定规则', v: '每块先算叶子哈希；相邻两哈希拼起来再哈希成父；层层向上汇成一个根哈希。' },
      { k: '本步结果', v: st.act === 'leaf' ? `L${st.focus}=${st.leaves[st.focus]}` : st.act === 'parent' ? `P${st.focus}=${st.parents[st.focus]}` : st.act === 'root' ? `Root=**${st.root}**` : `根=${st.root}` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; root: number; act: string }; return st.phase === 'done' ? `根 ${st.root}` : st.act },
    try: [{ act: '按「下一步」自底向上', watch: '4 叶子→2 父→1 根，一层层哈希上去。' }, { act: '想篡改', watch: '改任何一块，它的叶子→父→根都变，根一对就露馅。' }], terms: [],
  },
  caesar: {
    question: '每个字母后移固定几位，怎么把明文变成密文？',
    read: [{ at: '对照', is: '明文/密文逐字母对照，绿=已加密、蓝框=当前。', anchor: '.cx-rows' }, { at: '变换', is: '当前字母 code→+k mod26→新字母。', anchor: '.cx-calc' }],
    step: (s: never) => { const st = s as { pos: number; ch: string; code: number; key: number; shifted: number; out: string; cipher: string; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? `明文全部加密完` : `第 ${st.pos + 1} 个字母 ${st.ch}(=${st.code})` },
      { k: '判定规则', v: `字母转数字(A=0..Z=25)，加密钥 k=${st.key}，对 26 取模(越过 Z 绕回 A)，再转回字母。` },
      { k: '本步结果', v: st.phase === 'done' ? `密文 = **${st.cipher}**` : `(${st.code}+${st.key})mod26=${st.shifted} → **${st.out}**` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; cipher: string; out: string }; return st.phase === 'done' ? st.cipher : (st.out || '—') },
    try: [{ act: '按「下一步」逐字母移位', watch: 'A→D、越过 Z 就绕回；HELLO 变 KHOOR。' }, { act: '想想怎么破', watch: '只有 26 种密钥，暴力试一遍就出；字母频率也没变。' }], terms: [],
  },
  vigenere: {
    question: '用一个关键词而不是固定位移，能挡住频率分析吗？',
    read: [{ at: '三行', is: '明文/密钥(关键词循环)/密文对照。', anchor: '.cx-rows' }, { at: '变换', is: '(明文码+关键词码)mod26。', anchor: '.cx-calc' }],
    step: (s: never) => { const st = s as { pos: number; ch: string; chCode: number; keyCh: string; keyCode: number; shifted: number; out: string; cipher: string; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '全部加密完' : `第 ${st.pos + 1} 位：明文 ${st.ch}、关键词 ${st.keyCh}` },
      { k: '判定规则', v: '位移不再固定，而是**当前关键词字母的值**；关键词循环套在明文上。' },
      { k: '本步结果', v: st.phase === 'done' ? `密文 = **${st.cipher}**(两个 L 变成不同字母)` : `(${st.chCode}+${st.keyCode})mod26=${st.shifted} → **${st.out}**` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; cipher: string; out: string }; return st.phase === 'done' ? st.cipher : (st.out || '—') },
    try: [{ act: '按「下一步」看多表替换', watch: '同一个字母 L 在不同位置加密成不同字母。' }, { act: '想弱点', watch: '关键词周期重复——找出周期就能拆成几个凯撒破。' }], terms: [],
  },
  xor: {
    question: '最基础的加密原语——异或，凭什么加解密同一套？',
    read: [{ at: '三行', is: '明文位/密钥位/密文位。', anchor: '.cx-rows' }, { at: '本位', is: 'm XOR k = c。', anchor: '.cx-calc' }],
    step: (s: never) => { const st = s as { pos: number; mBit: number; kBit: number; cBit: number; cBits: number[]; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? '全部位加密完' : `第 ${st.pos + 1} 位：明文 ${st.mBit}、密钥 ${st.kBit}` },
      { k: '判定规则', v: '异或：相同得 0、不同得 1。它**自反**——再异或一次同一个密钥就抵消。' },
      { k: '本步结果', v: st.phase === 'done' ? `密文 = **${st.cBits.join('')}**` : `${st.mBit} ⊕ ${st.kBit} = **${st.cBit}**` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; cBits: number[]; cBit: number }; return st.phase === 'done' ? st.cBits.join('') : (st.cBit >= 0 ? String(st.cBit) : '—') },
    try: [{ act: '按「下一步」逐位异或', watch: '相同得 0、不同得 1。' }, { act: '想解密', watch: '密文再 XOR 同一密钥就还原——加解密同一套代码。' }], terms: [],
  },
  modpow: {
    question: '指数上千位的 a^b mod n，怎么算得动？',
    read: [{ at: '数值盒', is: '当前底数、结果，都对 n 取模。', anchor: '.cx-kv' }, { at: '读数', is: '要算什么、指数位、结果。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { a: number; b: number; n: number; bitPos: number; bit: number; baseNow: number; result: number; phase: string }; return [
      { k: '本步输入', v: st.phase === 'done' ? `算完 ${st.a}^${st.b} mod ${st.n}` : `指数第 ${st.bitPos} 位 = ${st.bit}` },
      { k: '判定规则', v: '把指数拆二进制；底数每步平方(a→a²→a⁴…)，这一位是 1 就把当前底数乘进结果，全程对 n 取模。' },
      { k: '本步结果', v: st.phase === 'done' ? `= **${st.result}**` : st.bit === 1 ? `位是 1 → 乘进结果 → **${st.result}**` : `位是 0 → 跳过` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; result: number; bit: number }; return st.phase === 'done' ? `=${st.result}` : `位${st.bit >= 0 ? st.bit : '?'}` },
    try: [{ act: '按「下一步」平方-乘', watch: '底数逐步平方，指数位是 1 才乘进结果。' }, { act: '数乘法次数', watch: '13 位的指数只要几次乘法，不是连乘 13 次——这才跑得动 RSA。' }], terms: [],
  },
  diffiehellman: {
    question: '所有人都能偷听的信道上，怎么商量出只有你俩知道的密钥？',
    read: [{ at: 'Alice', is: '私钥 a、公钥 A、算出的共享。', anchor: '.cx-kv' }, { at: '读数', is: '公开参数、公钥 A/B、共享密钥。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { p: number; g: number; A: number; B: number; aliceShared: number; stage: string; phase: string }; return [
      { k: '本步输入', v: st.stage === 'setup' ? `公开 p=${st.p}、g=${st.g}` : st.stage === 'pubA' ? 'Alice 公布公钥' : st.stage === 'pubB' ? 'Bob 公布公钥' : st.stage.startsWith('shared') ? '各自算共享' : '完成' },
      { k: '判定规则', v: '私钥保密、公钥=g^私钥 mod p 公开；共享=**对方公钥^自己私钥 mod p**，双方都等于 g^(ab) mod p。' },
      { k: '本步结果', v: st.stage === 'pubA' ? `A=${st.A}` : st.stage === 'pubB' ? `B=${st.B}` : st.aliceShared >= 0 ? `共享密钥 = **${st.aliceShared}**` : '公开参数已定' },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; aliceShared: number }; return st.phase === 'done' ? `共享 ${st.aliceShared}` : '协商中' },
    try: [{ act: '按「下一步」看协商', watch: 'A、B 都公开，但共享密钥双方各自算、从不上信道。' }, { act: '想安全根基', watch: '偷听者要从 A=g^a 反推 a=解离散对数，大数下算不动。' }], terms: [],
  },
  rsa: {
    question: '加密的人不知道解密的钥，公钥体制怎么做到？',
    read: [{ at: '密钥盒', is: 'p/q/n/φ/e/d 的生成关系。', anchor: '.cx-kv' }, { at: '读数', is: '模数、公私钥、密文、解密。', anchor: '.scdim' }],
    step: (s: never) => { const st = s as { p: number; q: number; n: number; phi: number; e: number; d: number; m: number; c: number; dec: number; stage: string; phase: string }; return [
      { k: '本步输入', v: st.stage === 'keygen' ? `选素数 p=${st.p}、q=${st.q}` : st.stage === 'pub' ? '定公钥 e' : st.stage === 'priv' ? '求私钥 d' : st.stage === 'encrypt' ? `加密明文 ${st.m}` : st.stage === 'decrypt' ? '私钥解密' : '完成' },
      { k: '判定规则', v: 'n=pq、φ=(p-1)(q-1)；e 与 φ 互质(公钥)；d 满足 e·d≡1(mod φ)(私钥)；加密 c=m^e mod n、解密 m=c^d mod n。' },
      { k: '本步结果', v: st.stage === 'keygen' ? `n=${st.n}、φ=${st.phi}` : st.stage === 'priv' ? `d=**${st.d}**` : st.stage === 'encrypt' ? `c=**${st.c}**` : st.stage === 'decrypt' ? `解回 **${st.dec}**` : `${st.m}→${st.c}→${st.dec}` },
    ] },
    verdict: (s: never) => { const st = s as { phase: string; c: number; dec: number; stage: string }; return st.phase === 'done' ? `解回 ${st.dec}` : st.stage },
    try: [{ act: '按「下一步」走完 RSA', watch: '生成密钥→公钥加密 4→31→私钥解密回 4。' }, { act: '想安全', watch: '公开 n，但反推 p、q=大数分解，几百位就算不动，所以 d 算不出。' }], terms: [],
  },
  mvcc: {
    question: '别人改了 x 并提交，先前已开始的事务为什么还读到旧值？',
    read: [
      { at: '版本链', is: 'x 的历史版本；绿=已提交、灰虚线=未提交、高亮=本次读命中的版本。', anchor: '.mvcc-chain' },
      { at: '事务', is: '两个事务各自的快照(read-view)与状态。', anchor: '.mvcc-txns' },
    ],
    step: (s: never) => {
      const st = s as { op: string; curTx: number; readValue: number; versions: unknown[]; phase: string }
      return [
        { k: '本步输入', v: st.op === 'begin' ? `T${st.curTx} 开始事务` : st.op === 'read' ? `T${st.curTx} 读 x` : st.op === 'write' ? `T${st.curTx} 写 x` : st.op === 'commit' ? `T${st.curTx} 提交` : '调度结束' },
        { k: '判定规则', v: '读=按事务**开始时的快照**，从新到旧挑第一个「已提交且创建者在快照里」的版本；写=**追加**新版本(未提交)；提交=让新版本对**之后**开始的事务才可见。' },
        { k: '本步结果', v: st.op === 'read' ? `读到 x=**${st.readValue}**` : st.op === 'write' ? '追加了一个未提交版本(只有自己看得见)' : st.op === 'commit' ? '该事务的版本已提交(但先前拿了快照的看不到)' : st.op === 'begin' ? '拍下当前快照' : `x 共 ${st.versions.length} 个版本；T1 两次都读到 100` },
      ]
    },
    verdict: (s: never) => { const st = s as { phase: string; readValue: number }; return st.phase === 'done' ? 'T1 两次读 100' : (st.readValue >= 0 ? `读到 ${st.readValue}` : '—') },
    try: [
      { act: '按「下一步」走完调度', watch: 'T1 前后两次读 x 都是 100——尽管中间 T2 已把它改成 200 并提交。' },
      { act: '盯住版本链', watch: '写 x 追加未提交版本(灰)，提交后变绿；T1 读的始终是它快照里那个旧版本。' },
    ],
    terms: [],
  },
  iso: {
    question: '同一段并发调度，切隔离级别，T1 三次读到的会怎么变？',
    read: [
      { at: 'T1 读序列', is: 'T1 依次读到的值；红=脏读/不可重复读，绿=一致。', anchor: '.iso-reads' },
      { at: 'x 状态', is: 'x 的已提交值与未提交值。', anchor: '.iso-x' },
    ],
    step: (s: never) => {
      const st = s as { level: string; op: string; curTx: number; readValue: number; anomaly: string; phase: string }
      return [
        { k: '本步输入', v: st.op === 'read' ? `T${st.curTx} 读 x（级别：${st.level}）` : st.op === 'write' ? `T${st.curTx} 写 x` : st.op === 'commit' ? `T${st.curTx} 提交` : st.op === 'begin' ? `T${st.curTx} 开始` : '调度结束' },
        { k: '判定规则', v: '读未提交=读最新值(含未提交)；读已提交=读最新已提交值；可重复读/串行化=读事务开始时的快照。读到的值≠第一次读→若读的是未提交值=**脏读**，否则=**不可重复读**。' },
        { k: '本步结果', v: st.op === 'read' ? `读到 **${st.readValue}**${st.anomaly && st.anomaly !== '首次读' && st.anomaly !== '正常' ? `——${st.anomaly}!` : st.anomaly === '正常' ? '(一致)' : '(基准)'}` : st.op === 'write' ? 'T2 写了未提交的 200' : st.op === 'commit' ? 'x 的已提交值更新' : st.op === 'begin' ? '事务开始' : `${st.level} 下的读现象已定` },
      ]
    },
    verdict: (s: never) => { const st = s as { level: string; anomaly: string }; return st.anomaly === '脏读' || st.anomaly === '不可重复读' ? st.anomaly : st.level },
    try: [
      { act: '把「隔离级别」调到读未提交，走一遍', watch: 'T1 第二次读到 200(脏读)、第三次也不一致(不可重复读)。', param: '隔离级别' },
      { act: '再调到可重复读', watch: 'T1 三次读全是 100——现象消失了。', param: '隔离级别' },
    ],
    terms: [],
  },
  cas: {
    question: '两个线程同时读到 0 都想 +1，为什么最后不会丢更新？',
    read: [
      { at: '共享 x', is: '内存里 x 的当前值。', anchor: '.cas-shared' },
      { at: '线程', is: '每个线程读到的本地值与状态；绿=写入成功、红=被抢先重试。', anchor: '.cas-threads' },
    ],
    step: (s: never) => {
      const st = s as { op: string; cur: number; x: number; expected: number; next: number; casOk: boolean; fails: number; phase: string }
      return [
        { k: '本步输入', v: st.op === 'read' ? `T${st.cur} 读 x` : st.op === 'cas' ? `T${st.cur} CAS(期望 ${st.expected}→${st.next})` : '完成' },
        { k: '判定规则', v: 'CAS(地址, 期望值, 新值)：**当且仅当**内存仍等于期望值时才写入、返回成功；否则说明被别人抢先改了、返回失败，调用者自旋重试。' },
        { k: '本步结果', v: st.op === 'read' ? `读到本地 = ${st.x}` : st.op === 'cas' ? (st.casOk ? `x 仍是期望值 → **成功**，x=${st.x}` : `x 已是 ${st.x}≠期望 → **失败**，重读再来`) : `x=${st.x}，一个没丢；失败重试 ${st.fails} 次` },
      ]
    },
    verdict: (s: never) => { const st = s as { phase: string; x: number; op: string; casOk: boolean }; return st.phase === 'done' ? `x=${st.x}` : st.op === 'cas' ? (st.casOk ? '成功' : '重试') : `x=${st.x}` },
    try: [
      { act: '按「下一步」看竞争', watch: 'T1、T2 都读到 0，T1 先 CAS 成功，T2 CAS 就失败了。' },
      { act: '数失败次数', watch: '每次被抢先就重读再 CAS，最终三个 ++ 一个不丢、x=3。' },
    ],
    terms: [],
  },
  mesi: {
    question: '一个核改了 x，另一个核为什么不会自动看见？',
    read: [
      { at: '缓存行', is: '每个核的状态 M/E/S/I 与值；M=红脏、E=独占、S=共享、I=虚线失效。', anchor: '.mesi-cores' },
      { at: '总线', is: '本步的总线消息(BusRd / Invalidate / 回写)。', anchor: '.mesi-bus' },
    ],
    step: (s: never) => {
      const st = s as { op: string; cur: number; bus: string; invalidated: number; phase: string }
      return [
        { k: '本步输入', v: st.op === 'read' ? `C${st.cur} 读 x` : st.op === 'write' ? `C${st.cur} 写 x` : '完成' },
        { k: '判定规则', v: '读未命中→上总线找(别人有 M 先回写、大家降 S；没人有则我独占 E)；**写之前把其它核的副本全失效(I)、自己升 M**。' },
        { k: '本步结果', v: st.op === 'write' ? `其它核副本被置 **I(失效)**，本核升 M(脏)` : st.op === 'read' ? `总线：${st.bus}` : `全程失效 ${st.invalidated} 次——这就是 volatile 存在的理由` },
      ]
    },
    verdict: (s: never) => { const st = s as { phase: string; invalidated: number; op: string }; return st.phase === 'done' ? `失效 ${st.invalidated} 次` : st.op === 'write' ? '失效别人' : '读' },
    try: [
      { act: '按「下一步」看两核读写', watch: 'C1 独占→C2 来读变共享→C1 一写就把 C2 的副本置为 I。' },
      { act: '盯 I 状态', watch: '被失效的核下次读只能重新加载——一个核的写另一个核不会自动看见。' },
    ],
    terms: [],
  },
  deadlock: {
    question: '几个线程交叉加锁，怎么判断它们死锁了没有？',
    read: [
      { at: '线程', is: '各线程持有/等待的锁；红=在死锁环上。', anchor: '.dl-threads' },
      { at: '等待图', is: '边 Ti→Tj = Ti 等 Tj 攥着的锁；成环即死锁。', anchor: '.dl-graph' },
    ],
    step: (s: never) => {
      const st = s as { op: string; cur: number; lock: string; deadlock: boolean; cycle: number[]; phase: string }
      return [
        { k: '本步输入', v: st.op === 'acquire' ? `T${st.cur} 申请锁 ${st.lock}` : st.op === 'request' ? `T${st.cur} 申请被占的锁 ${st.lock}` : '完成' },
        { k: '判定规则', v: '锁空闲→拿到；锁被别人攥着→阻塞，在等待图上加一条边 T申请→T持有。等待图**成环**=循环等待=死锁。' },
        { k: '本步结果', v: st.op === 'acquire' ? `拿到 ${st.lock}` : st.deadlock ? `等待图成环 T${[...st.cycle, st.cycle[0]].join('→')} → **死锁!**` : st.op === 'request' ? `阻塞，加一条等待边` : '检出死锁' },
      ]
    },
    verdict: (s: never) => { const st = s as { deadlock: boolean; cycle: number[] }; return st.deadlock ? `死锁(环长 ${st.cycle.length})` : '正常' },
    try: [
      { act: '按「下一步」逐个加锁', watch: 'T1/T2/T3 各拿一把、又都去要下一把，等待边一条条加。' },
      { act: '看环闭合那一刻', watch: '最后一条边 3→1 补上，等待图成环，当场判死锁。' },
    ],
    terms: [],
  },
  raft: {
    question: 'Raft 靠什么选出唯一的主、又保证日志不丢？',
    read: [
      { at: '节点', is: '每个节点的角色(Follower/Candidate/Leader)、任期、日志；绿✓=已提交。', anchor: '.raft-nodes' },
      { at: '读数', is: '当前任期、候选人票数、已提交日志数。', anchor: '.scdim' },
    ],
    step: (s: never) => {
      const st = s as { op: string; cur: number; term: number; votes: number; majority: number; committed: number; phase: string }
      return [
        { k: '本步输入', v: st.op === 'timeout' ? `N${st.cur} 选举超时` : st.op === 'requestVote' ? `N${st.cur} 拉票` : st.op === 'grantVote' ? `N${st.cur} 投票` : st.op === 'becomeLeader' ? `N${st.cur} 计票` : st.op === 'clientCmd' ? '客户端提交命令' : st.op === 'append' ? `复制日志到 N${st.cur}` : '完成' },
        { k: '判定规则', v: '选主：超时→Candidate、任期+1、给自己投票、拉票，拿到**过半票**当选 Leader。日志：客户端命令只发 Leader，Leader 复制给 Follower，**复制到过半**即提交。' },
        { k: '本步结果', v: st.op === 'becomeLeader' ? `拿 ${st.votes}/${st.majority} 票 → **当选 Leader**` : st.op === 'grantVote' ? `候选人 ${st.votes}/${st.majority} 票${st.votes >= st.majority ? '(过半!)' : ''}` : st.op === 'append' && st.committed ? `已复制到过半 → **提交**` : st.op === 'clientCmd' ? 'Leader 追加日志(未提交)' : st.op === 'timeout' ? `变 Candidate(term ${st.term})` : `已提交 ${st.committed} 条` },
      ]
    },
    verdict: (s: never) => { const st = s as { phase: string; committed: number; op: string; cur: number }; return st.phase === 'done' ? `已提交 ${st.committed} 条` : st.op === 'becomeLeader' ? `N${st.cur} 当选` : '共识中' },
    try: [
      { act: '按「下一步」看选主', watch: 'N1 超时参选→拿到 2/2 票→当选 Leader。' },
      { act: '看日志复制', watch: '客户端命令由 Leader 复制到过半节点，就打勾提交了。' },
    ],
    terms: [],
  },
  cache: {
    question: '同一串内存地址，Cache 怎么摆能少跑几趟内存？',
    /*
     * 固定四段：当前输入 → 本步规则 → 状态怎么变 → 该在画面哪里看。
     * 先让人跟完一次具体的推演，「组相联」那个正式名字放到后面的名词卡里 ——
     * 定义式的说法要求读者先在脑子里建一个整体图景，
     * 而他此刻正盯着一个具体地址在找它去哪儿。
     */
    basics: [
      {
        title: '先分清三个词：内存块 / 组 / 路',
        body: '**内存块** —— 主存按块大小（此处 16B）划分为等长的块，调入调出均以块为单位：'
          + '访问 0x210 将把 0x210~0x21F 整块调入。地址 ÷ 块大小即该地址所属的**块号**。'
          + '　**组**（set） —— Cache 划分为若干组，图中一行即一组。内存块映射到哪一组'
          + '由块号对组数取模**唯一确定**，不可选择。'
          + '　**路**（way） —— 同一组内并列的若干存储位置，每一路存放一个内存块，'
          + '表头「路 0」「路 1」即由此而来（路号从 0 起数）。'
          + '"2 路"即每组有两个位置；实际处理器中常见 4 路、8 路。',
      },
      {
        title: 'tag / index / offset 各管一件事',
        body: '地址划分为三段：**Index 决定去哪组，Tag 决定是不是它，Offset 决定取块里的哪个字节**。'
          + '　`index` 唯一确定检索的组，其余组不参与比较；'
          + '`offset` 指出块内的字节位置；剩余高位为 `tag`，随块一同存入该路。'
          + '　tag 的必要性在于：**多个不同的内存块会映射到同一组**'
          + '（0x10、0x110、0x210 的组号均为 1）。它们共用同一组的若干路，'
          + '只能依据 tag 判定某一路当前存放的是否为目标块。'
          + '　**tag 是编号而非地址**，故界面上不加 0x 前缀。',
      },
    ],
    step: (s: never, doc) => {
      const st = s as {
        address: number; tag: number; setIndex: number; offset: number
        outcome: 'hit' | 'miss'; wayUsed: number; evictedTag: number | null
      }
      const hex = (n: number) => '0x' + n.toString(16).toUpperCase()
      const ways = Number(doc.params.associativity) || 1
      const hit = st.outcome === 'hit'
      /*  ⚠️ 用词跟舞台对齐：**组**（一行）· **路**（行里的一个格子）·
          **内存块**（格子里装的东西）。tag 印十进制 —— 它是编号不是地址。
          用户原话：「块-》tag，组-》组/index，这些文字没统一」。 */
      /*
       * ⚠️ 这三段是照**右栏那一列**（约 300px、一行二十来个汉字）写的，
       * 不是照原来那条横带子（约 1300px、四段并排）。同一句话在两种宽度下
       * 的成本差着三倍：横带子里两行说完的话，竖栏里要五行。
       * 措辞仍是书面陈述 —— 短不等于口语，砍掉的是**重复的主语和铺垫**，
       * 不是把「判定为缺失」写成「没接住」。
       */
      const policy = String(doc.params.replacement ?? 'LRU')
      return [
        { k: '本步输入',
          v: `内存地址 **${hex(st.address)}**` },
        { k: '判定规则',
          v: `由 index = **${st.setIndex}**，只检查组 ${st.setIndex} 的 ${ways} 路。` },
        { k: '本步结果',
          v: hit
            ? `路 ${st.wayUsed} 的 tag = ${st.tag}，**命中**，不访问主存。`
            : st.evictedTag === null
              ? `${ways} 路的 tag 均 ≠ ${st.tag}，**缺失**；装入空闲的路 ${st.wayUsed}。`
              : `${ways} 路的 tag 均 ≠ ${st.tag}，**缺失**；按 ${policy} 淘汰路 ${st.wayUsed}（原 tag ${st.evictedTag}），装入新块。` },
        /*
         * ⚠️ **这一屏没有「对应画面」那一段。**
         *
         * 四段骨架（本步输入 / 判定规则 / 本步结果 / 对应画面）里，第四段的活是
         * 「这段话对应屏幕上哪一块」—— 那是给"文字在一处、图在另一处"准备的。
         * 而 Cache 这一屏改版之后，推演就贴在图旁边的右栏里，
         * 因果链末端、状态列、本步结果带三处已经把结论写在图上了；
         * 再写一段话去描述读者正盯着的那张图，是同一件事说第四遍。
         *
         * 骨架仍然成立：段名的顺序和含义没变，只是这一屏用不上最后一段。
         * 冒烟因此不再写死"必须四段"，改成验"是骨架的前缀、且至少三段"。
         */
      ]
    },
    /*  ⚠️ 新条目一律**追加在末尾**：卡片 id 是 `read${i}`，按位置生成的。
        往前插一条，read0/read1 的含义整体错位，而冒烟里按 id 认卡的判据会一起红 ——
        「拿位置当键」在这个仓里已经栽过八次。 */
    verdict: (s: never) => {
      const st = s as { setIndex: number; wayUsed: number; outcome: 'hit' | 'miss'; evictedTag: number | null }
      return st.outcome === 'hit'
        ? `命中 · 组 ${st.setIndex} 路 ${st.wayUsed}`
        : `缺失 · 装入组 ${st.setIndex} 路 ${st.wayUsed}`
    },
    read: [
      { at: '左边那三个彩色方块', is: '当前地址被切成三段：**tag / index / offset**。每段下面写着它管什么、以及位宽是怎么算出来的；再往下是同一件事的除法写法（考场上手算用的那一版）。', anchor: '.bitrow' },
      { at: '右边那张表', is: '这就是 Cache 本身。**一行是一个组，行里并排的几格就是几条路**，格子里写着它装的那一块的 tag 和对应的主存地址区间。最右边一列是这一步对这一组的判定 —— 只有被检索的那一组有话说。', anchor: '.sets' },
      { at: '轴上的柱子', is: '到这一步为止的滚动命中率 —— 绿格命中、红格缺失。', anchor: '.axis' },
      { at: '最上面那条链', is: '这一步的完整推理：**地址 → index 定组 → 检索该组 → 比对 tag → 命中还是缺失**。末端那个词就是本步的结论，别处不再重复写一遍。', anchor: '.chain' },
    ],
    try: [
      { act: '把相联度从 2 调到 1', watch: '表从 8 行、每行 2 个方框，变成 16 行、每行 1 个，地址里中间那段变长、tag 段变短。**先看命中率变没变** —— 这串地址上它可能一点不动；想看出差别，换下面那串「同组冲突」。', param: '相联度' },
      { act: '换成「同组冲突」预置序列', watch: '这串地址全落在同一组 —— 相联度 1 时几乎全红，调到 4 就几乎全绿。', preset: '同组冲突' },
      { act: '把块大小从 16 调到 64', watch: '块内偏移占的位变多、组号变少；顺序访问会因为"搬一块就带进来好几个"而变好。', param: '块大小' },
    ],
    terms: ['hit', 'blockway', 'setassoc', 'direct', 'fullassoc', 'tagidx', 'lru', 'locality'],
  },
  scheduler: {
    question: '同一批进程，换个调度算法，谁先跑完、平均等多久？',
    step: (s: never, doc) => {
      const st = s as { t: number; running: string | null; readyQueue: string[]
                        remaining: Record<string, number>; completed: string[]; sliceLeft: number }
      const algo = String(doc.params.algorithm)
      const q = Number(doc.params.quantum) || 0
      const wait = st.readyQueue.length
      const RULE: Record<string, string> = {
        FCFS: '**先来先服务**：谁先到谁先跑，跑完为止，中途不换人。',
        SJF: '**短作业优先**：每次从就绪队列里挑**服务时间最短**的那个，一旦开跑不抢占。',
        SRTF: '**最短剩余时间优先**：每来一个新进程都比一次 —— 它的服务时间比当前进程**剩下的**还短，就当场抢占。',
        RR: `**时间片轮转**：每个进程最多连跑 ${q} 个时刻，时间片一到就排到队尾，轮下一个。`,
        Priority: '**优先级调度**：每次挑优先级最高的那个（数字小的优先）。',
      }
      return [
        { k: '本步输入', v: `时刻 **${st.t}**；就绪队列里排着 ${wait} 个${wait ? `（${st.readyQueue.join('、')}）` : ''}` },
        { k: '判定规则', v: RULE[algo] ?? `按 ${algo} 挑下一个该跑的进程。` },
        { k: '本步结果',
          v: st.running
            ? `本时刻 CPU 上跑的是 **${st.running}**，它还剩 ${st.remaining[st.running] ?? 0} 个时刻`
              /*  ⚠️ 时间片**只有 RR 有**。`quantum` 这个参数在别的算法下照样有默认值，
                  拿 `q > 0` 判断就会在 SRTF 上印出「当前时间片还剩 1 个时刻」——
                  一句听着很专业的假话。 */
              + (algo === 'RR' ? `，当前时间片还剩 ${st.sliceLeft} 个时刻。` : '。')
              + (st.completed.length ? `已完成 ${st.completed.length} 个。` : '')
            : `本时刻 CPU **空闲**：没有已到达且未完成的进程。已完成 ${st.completed.length} 个。` },
      ]
    },
    read: [
      { at: '甘特图每一行', is: '一个进程。深色格是它在 CPU 上跑，浅色是就绪等待。', anchor: '.gantt' },
      { at: '进程表', is: '题面数据：到达时刻和服务时间。可以直接改，也可以加一行。', anchor: '.enttab' },
      { at: '右边读数', is: '当前时刻在跑谁、就绪队列里排着谁、还剩多少。', anchor: '.readouts' },
    ],
    try: [
      { act: '装上「护航效应」预置，在 FCFS 和 SJF 之间切', watch: '长作业排在前面时 FCFS 的平均周转明显吃亏 —— 后面一串短作业全被它堵着。', param: '调度算法', preset: '护航效应' },
      { act: '选 RR，再把时间片从 2 调到 1', watch: '切换次数翻倍，甘特图变碎；时间片越小越"公平"，但切换开销也越大。', param: '时间片' },
      { act: '选 SRTF', watch: '每来一个更短的作业就抢占，甘特图上会看到正在跑的被打断。', param: '调度算法' },
    ],
    terms: ['turnaround', 'preempt'],
  },
  tcp: {
    question: '一条 TCP 连接遇到丢包，发送窗口是怎么涨、怎么砍的？',
    step: (s: never, doc) => {
      const st = s as { round: number; cwnd: number; ssthresh: number
                        phase: 'slowStart' | 'congestionAvoidance' | 'fastRecovery'
                        event: 'none' | 'timeout' | 'tripleDup'; nextCwnd: number }
      const variant = String(doc.params.variant)
      const PHASE = { slowStart: '慢启动', congestionAvoidance: '拥塞避免', fastRecovery: '快恢复' }
      const ev = st.event === 'timeout' ? '**超时**'
        : st.event === 'tripleDup' ? '**三次重复 ACK**' : '没有丢包'
      const rule = st.event === 'timeout'
        ? '超时表示连重复 ACK 都未收到，无法判断链路仍可达。'
          + '两个版本处置相同：ssthresh 置为当前 cwnd 的一半，cwnd 置为 1，重新进入慢启动。'
        : st.event === 'tripleDup'
          ? variant === 'Reno'
            ? '收到三个重复 ACK，说明后续报文仍在到达，链路未中断。'
              + 'Reno 据此只做减半：ssthresh 取当前 cwnd 的一半，cwnd 同时降至该值，直接进入拥塞避免（快恢复）。'
            : 'Tahoe **不区分**两类丢包：无论超时还是重复 ACK，一律将 cwnd 置为 1 并重新慢启动。'
          : st.phase === 'slowStart'
            ? '慢启动阶段：每经过一个 RTT，cwnd **加倍**；达到 ssthresh 后转入拥塞避免。'
            : '拥塞避免阶段：每个 RTT 仅 **加 1**，以线性方式试探可用带宽。'
      return [
        { k: '本步输入', v: `第 **${st.round}** 个 RTT；本轮事件：${ev}` },
        { k: '判定规则', v: rule },
        { k: '本步结果',
          v: `cwnd ${st.cwnd} → **${st.nextCwnd}** MSS，ssthresh ${st.ssthresh}，`
            + `当前阶段为**${PHASE[st.phase]}**。` },
        { k: '对应画面',
          v: `曲线第 ${st.round} 个数据点（实线为 cwnd，虚线为 ssthresh）`
            + `${st.event === 'none' ? '' : '；本轮的丢包事件以红色竖虚线标出'}。` },
      ]
    },
    read: [
      { at: '锯齿曲线', is: '实线是 cwnd，虚线是 ssthresh。竖的红虚线是丢包事件。', anchor: '.curve' },
      { at: '状态机页签', is: '当前处在慢启动、拥塞避免还是快恢复，以及这一档的涨法。', anchor: '.tabs' },
    ],
    try: [
      { act: '把丢包事件表里的类型改成 timeout', watch: 'cwnd 直接掉回 1、回到慢启动 —— 比三次重复 ACK 惨得多。' },
      { act: '把丢包时刻往后挪', watch: 'ssthresh 被砍成"当时 cwnd 的一半"，所以砍在越高处，之后线性段的起点越高。' },
    ],
    terms: ['cwnd', 'ssthresh', 'phases'],
  },
  page: {
    question: '同一串页面引用，哪种置换算法缺页少？多给物理块一定更好吗？',
    step: (s: never, doc) => {
      const st = s as { i: number; page: number; outcome: 'hit' | 'fault'
                        frameUsed: number; evictedPage: number | null
                        faults: number; hits: number; hand: number
                        frames: ({ page: number } | null)[] }
      const algo = String(doc.params.algorithm)
      const n = Number(doc.params.frames)
      const hit = st.outcome === 'hit'
      const RULE: Record<string, string> = {
        FIFO: '**先进先出**：物理块满了就换出**最早装进来**的那一页，不管它刚刚有没有被用过。',
        LRU: '**最近最少使用**：换出**最久没被访问**的那一页。',
        OPT: '**最佳置换**：换出**将来最久不会用到**的那一页 —— 需要预知未来，只能当理论下界。',
        CLOCK: '**时钟算法**：指针转着圈找使用位为 0 的页；碰到 1 就清零并继续转。它是 LRU 的近似。',
      }
      return [
        { k: '本步输入', v: `第 **${st.i + 1}** 次引用，访问页 **${st.page}**；共 ${n} 个物理块` },
        { k: '判定规则',
          v: `先看这一页在不在物理块里：在就是命中，不必调页。`
            + `不在则要调入，物理块满了就得换出一页 —— ${RULE[algo] ?? algo}` },
        { k: '本步结果',
          v: hit
            ? `页 ${st.page} 已在物理块 ${st.frameUsed} 里，判定为**命中**，不发生调页。`
              + `累计命中 ${st.hits} 次、缺页 ${st.faults} 次。`
            : st.evictedPage === null
              ? `页 ${st.page} 不在，判定为**缺页**：装入空闲的物理块 ${st.frameUsed}。累计缺页 ${st.faults} 次。`
              : `页 ${st.page} 不在，判定为**缺页**；物理块已满，按 ${algo} 换出页 ${st.evictedPage}，`
                + `新页占用物理块 ${st.frameUsed}。累计缺页 ${st.faults} 次。` },
      ]
    },
    read: [
      { at: '置换表', is: '每一列是一次引用，格子里是当时各物理块装着谁，红色表示这次缺页。', anchor: '.ptable' },
      { at: '引用串输入框', is: '题面数据，可以直接改。', anchor: '.seqin' },
    ],
    try: [
      { act: '选 FIFO，把物理块数从 3 调到 4，用「Belady 经典串」那条预置', watch: '缺页次数不降反升 —— 这就是 Belady 异常，LRU 和 OPT 换过去就不会。', param: '物理块数', preset: 'Belady 经典串' },
      { act: '同一串分别跑 OPT 和 LRU', watch: 'OPT 是理论下界，LRU 通常最接近它；差多少就是"预知未来"值多少。', param: '置换算法' },
    ],
    terms: ['pagefault', 'belady', 'opt', 'lru'],
  },
  disk: {
    question: '一队磁道请求，磁头按什么顺序走最省？',
    step: (s: never, doc) => {
      const st = s as { i: number; from: number; head: number; served: number
                        moved: number; total: number; pending: number[]
                        dir: number; sweep: boolean; via: number[] }
      const algo = String(doc.params.algorithm)
      const RULE: Record<string, string> = {
        FCFS: '**先来先服务**：严格按请求到达的顺序走，不管磁头此刻在哪儿。',
        SSTF: '**最短寻道优先**：每次挑离磁头**当前位置最近**的那个请求 —— 近端密集时远端会饿死。',
        SCAN: '**电梯算法**：朝一个方向一路服务到**磁盘边界**再掉头。',
        LOOK: '**LOOK**：朝一个方向服务到**那个方向上最远的请求**就掉头，不走到边界。',
        'C-SCAN': '**C-SCAN**：单向服务，走到边界后**直接回到另一端**重新开始，不在回程上服务。',
      }
      /*  ⚠️ `dir` 这个字段**每种算法都填**（初值就是 ±1），可"方向"这个概念
          只对 SCAN 这一系成立 —— FCFS/SSTF 是按请求挑的，说它"当前方向向大磁道"
          是句假话。所以按算法过滤，不按字段有没有值过滤。 */
      const scanLike = ['SCAN', 'LOOK', 'C-SCAN', 'C-LOOK'].includes(algo)
      const dir = scanLike ? (st.dir > 0 ? '向大磁道' : st.dir < 0 ? '向小磁道' : '') : ''
      return [
        { k: '本步输入', v: `磁头在磁道 **${st.from}**；还有 ${st.pending.length} 个请求没服务${dir ? `；当前方向${dir}` : ''}` },
        { k: '判定规则', v: RULE[algo] ?? `按 ${algo} 决定下一个去哪个磁道。` },
        /*  ⚠️ `served` 存的是**本步服务的那个磁道号**，不是"已服务几个"。
            按后者写出来就是「已服务 14 个请求」而实际只服务了 4 个 ——
            字段名像计数，值却是编号，这种谎判据抓不到（非空、也跟着变）。 */
        { k: '本步结果',
          v: st.sweep
            ? `这一步是**空跑**：走到 ${st.head} 只为掉头/回绕，途中没有请求可服务。`
              + `移动 ${st.moved} 个磁道，累计 ${st.total}。`
            : `磁头移到磁道 **${st.head}**${st.via.length ? `（途经 ${st.via.join(' → ')}）` : ''}，`
              + `本步移动 **${st.moved}** 个磁道，累计寻道 **${st.total}**。还剩 ${st.pending.length} 个请求。` },
      ]
    },
    read: [
      { at: '轨迹图', is: '横轴是磁道号，折线是磁头走过的路。空心虚线圈是"只是路过或掉头"的折返点。', anchor: '.dplot' },
      { at: '右边读数', is: '这一步移动了多少磁道、累计多少。', anchor: '.readouts' },
    ],
    try: [
      { act: '在 SCAN 和 LOOK 之间切', watch: '差别只在最后：SCAN 会一直走到磁盘边界才掉头，LOOK 走到最远的那个请求就掉头。', param: '调度算法' },
      { act: '选 SSTF，看请求集中在磁头一侧时', watch: '总是就近取，远端的请求可能一直排不上 —— 饥饿。', param: '调度算法' },
      { act: '改初始方向', watch: 'SCAN / C-SCAN 的总路程随方向变化很大，题目里这个条件不能漏读。', param: '初始方向' },
    ],
    terms: ['seek', 'scan'],
  },
  sort: {
    question: '七种排序，每一趟之后数组长什么样？哪些位置是真定了？',
    step: (s: never, doc) => {
      const st = s as { i: number; arr: number[]; hole: number; held: number | null
                        compare: number[]; changed: number[]; pass: number; passEnd: boolean
                        settled: number[]; sorted: number[]; comparisons: number; moves: number }
      const algo = String(doc.params.algorithm)
      /*  ⚠️ 键要跟**参数的实际取值**对上：注册表里写的是「冒泡」不是「冒泡排序」。
          对不上时会静静落到兜底那句「按 快速 决定这一步比谁、动谁」——
          非空、也跟着变，判据一条都抓不到，只有人念一遍才看得出这是句废话。 */
      const RULE: Record<string, string> = {
        冒泡: '**冒泡**：相邻两个比一次，大的往后挪。每趟结束，最大的那个**沉到位**，之后再也不动。',
        直接插入: '**直接插入**：把当前这个数往前面已排好的那段里插。注意前缀只是**暂时有序**，后面还会被挤动。',
        简单选择: '**简单选择**：每趟在未排序区里找最小的，跟区首交换 —— 每趟**确定一个**最终位置。',
        快速: '**快排**：选一个基准，比它小的甩左边、大的甩右边；基准归位后**它的位置就定了**。',
        堆: '**堆排序**：先建大顶堆，然后反复"堆顶跟末尾交换、堆长度减一、重新下沉" —— 每次**定一个**。',
        希尔: '**希尔**：按增量分组做插入排序，增量逐轮减半。中途每一段都只是**暂时有序**。',
        归并: '**归并**：两两归并有序段。中途的有序段是**局部的**，最后一次归并完才全局有序。',
      }
      const held = st.hole >= 0 ? `手里正端着 **${st.held}**，下标 ${st.hole} 那格是旧副本（挖坑法）。` : ''
      return [
        { k: '本步输入',
          v: `第 **${st.pass || 1}** 趟；数组 ${st.arr.join(' ')}`
            + (st.compare.length ? `；本步比较下标 ${st.compare.join(' 与 ')}` : '') },
        { k: '判定规则', v: RULE[algo] ?? `按 ${algo} 决定这一步比谁、动谁。` },
        { k: '本步结果',
          v: (st.changed.length ? `下标 ${st.changed.join('、')} 发生了写入。` : '本步只比较，没有写入。')
            + held
            + `累计比较 ${st.comparisons} 次、移动 ${st.moves} 次。`
            + (st.settled.length
                ? `已**确定最终位置**的有 ${st.settled.length} 个。`
                : st.sorted.length
                  ? `下标 ${st.sorted[0]}~${st.sorted[st.sorted.length - 1]} 这一段**暂时有序**，后面还会动。`
                  : '')
            + (st.passEnd ? ' 本步是这一趟的末尾。' : '') },
      ]
    },
    read: [
      { at: '柱状数组', is: '当前状态。深色是**已确定最终位置**，浅色只是**暂时有序、后面还会动**。', anchor: '.sbars' },
      { at: '空出来的那一格', is: '挖坑法：手里正端着一个值，坑还没填上 —— 所以数组看起来会"少一个"。', anchor: '.sbars' },
      { at: '逐趟结果页签', is: '每一趟结束时的快照，考试问的常常就是这个。', anchor: '.tabs' },
    ],
    try: [
      { act: '切到直接插入，再切到冒泡', watch: '插入的前缀只是"暂时有序"，冒泡的后缀才是"真的定了" —— 两者在图上颜色不同。', param: '排序算法' },
      { act: '把序列改成已经有序的', watch: '插入排序几乎不动，快排反而退化 —— 划分次数最多。' },
    ],
    terms: ['stable', 'pass', 'settled'],
  },
  dijkstra: {
    question: '从一个点出发，到每个点的最短路是怎么一步步定下来的？',
    step: (s: never, doc) => {
      const st = s as { act: 'pick' | 'relax' | 'skip' | 'done'; at: string; to: string
                        dist: Record<string, number>; prev: Record<string, string | null>
                        settled: string[]; improved: boolean }
      const src = String(doc.params.source)
      const d = (v: string) => (st.dist[v] === undefined || st.dist[v] === Infinity ? '∞' : String(st.dist[v]))
      const open = Object.keys(st.dist).filter(v => !st.settled.includes(v))
      return [
        { k: '本步输入',
          v: st.act === 'pick'
            ? `未确定的点还有 ${open.length} 个，各自的当前距离：${open.map(v => `${v}=${d(v)}`).join('、')}`
            : st.act === 'done'
              ? `全部 ${st.settled.length} 个点都已确定`
              : `刚确定的点是 **${st.at}**（距离 ${d(st.at)}），正在看它的邻边 ${st.at}→${st.to}` },
        { k: '判定规则',
          v: st.act === 'pick'
            ? `从**未确定**的点里挑当前距离最小的那个，把它**定下来** —— `
              + `之后再也不会更短，因为边权非负，绕远路只会更长。`
            : st.act === 'done'
              ? `没有可挑的点了：要么全部确定，要么剩下的从 ${src} 根本走不到。`
              : `**松弛**：如果"经过 ${st.at} 再到 ${st.to}"比 ${st.to} 现在记的距离更短，就改小它。` },
        { k: '本步结果',
          v: st.act === 'pick'
            ? `确定 **${st.at}**，距离 ${d(st.at)}；已确定 ${st.settled.length} 个点。`
            : st.act === 'done'
              ? `结束。从 ${src} 出发的最短距离：${Object.keys(st.dist).map(v => `${v}=${d(v)}`).join('、')}。`
              : st.improved
                ? `更短，改小：**${st.to}** 的距离变成 ${d(st.to)}，前驱记成 ${st.prev[st.to] ?? '—'}。`
                : `不更短，**不改**：${st.to} 保持 ${d(st.to)}。` },
      ]
    },
    read: [
      { at: '图', is: '结点上的数字是当前记录的最短距离，加粗的边是最短路径树。', anchor: '.gvwrap' },
      { at: '逐轮距离表', is: '每一轮：选中谁、松弛了谁、哪些距离被改小了。', anchor: '.tabs' },
    ],
    try: [
      { act: '换源点', watch: '最短路径树整棵变样 —— 它是"从这个源点看"的树，不是图的固有属性。', param: '源点' },
      { act: '把某条边的权改大', watch: '如果它在树上，树会改道；如果不在，多半什么也不变。' },
    ],
    terms: ['relax', 'sptree'],
  },
  banker: {
    question: '现在把资源分出去，会不会走进死锁？',
    step: (s: never, doc) => {
      const st = s as { act: 'init' | 'try' | 'accept' | 'reject' | 'safe' | 'unsafe'
                        pid: string; work: Record<string, number>
                        finish: Record<string, boolean>; sequence: string[]
                        need: Record<string, Record<string, number>> }
      const res = String(doc.params.resources).split(/[\s,，]+/).filter(Boolean)
      const w = res.map(r => `${r}=${st.work[r] ?? 0}`).join(' ')
      const left = Object.keys(st.finish).filter(p => !st.finish[p])
      const need = st.pid && st.need[st.pid]
        ? res.map(r => `${r}=${st.need[st.pid]![r] ?? 0}`).join(' ')
        : ''
      return [
        { k: '本步输入',
          v: st.act === 'init'
            ? `可用资源 Work = ${w}；${left.length} 个进程还没跑完`
            /*  ⚠️ 末帧（safe / unsafe）**没有"正在试"的对象** —— `pid` 是空的。
                照通用模板走会吐出「正在试 **—**」这种破句（体验师在第 14 步抓到）。
                收尾这一帧要说的是"推演结束、结果如何"，不是"正在试谁"。 */
            : st.act === 'safe' || st.act === 'unsafe'
            ? `推演结束：Work = ${w}；`
              + (st.act === 'safe'
                ? `${Object.keys(st.finish).length} 个进程全部排得进来`
                : `还剩 ${left.length} 个进程谁都满足不了`)
            : `Work = ${w}；正在试 **${st.pid || '—'}**${need ? `，它还差 Need = ${need}` : ''}` },
        { k: '判定规则',
          v: `安全性检查：反复找一个**还没跑完、且 Need ≤ Work** 的进程。`
            + `找到就**假设**它跑完并把 Allocation 全还回来（Work 增大），继续找下一个。`
            + `注意这只是"推演"，不真的分配。` },
        /*  ⚠️ **两帧的分工要看清楚**：`accept` 那一帧只是"判定它能满足"，
            此时 `work` 还没加回来、`sequence` 也还没 push；真正的归还在下一帧
            （`act:'try'`）。照 accept 那一帧去写"还回来之后 Work = …"，
            印出来的是**归还前**的数，而且安全序列是空的。 */
        { k: '本步结果',
          v: st.act === 'accept'
            ? `${st.pid} 的 Need ≤ Work，**可以满足** —— 假设把它排进去让它跑完。`
              + `（资源要到下一步才归还，所以此刻 Work 还是 ${w}。）`
            : st.act === 'try'
              ? `${st.pid} 跑完并归还了它已占的资源，Work 增大到 ${w}。`
                + `当前安全序列：${st.sequence.join(' → ') || '（刚开始）'}。`
            : st.act === 'reject'
              ? `${st.pid} 的 Need 有一项大于 Work，这一轮**跳过它**，接着试别的。`
              : st.act === 'safe'
                ? `每个进程都排得进来 —— 当前状态**安全**，安全序列：${st.sequence.join(' → ')}。`
                : st.act === 'unsafe'
                  ? `剩下的 ${left.join('、')} 谁都满足不了，找不出全排列 —— 当前状态**不安全**。`
                  : `初始：Work = ${w}，还没有进程被排进序列。` },
      ]
    },
    read: [
      { at: '资源矩阵', is: 'Max 是声明的最大需求，Allocation 是已经给的，Need 是还差的（自动算，不用填）。', anchor: '.enttab' },
      { at: '安全性检查页签', is: '逐轮找"Need 能被当前可用量满足"的进程，找到就假设它跑完并归还。', anchor: '.tabs' },
      { at: '最后一步', is: '找得到全排列就是安全，并给出安全序列；卡住就是不安全。', anchor: '.card.log' },
    ],
    try: [
      { act: '把某个进程的 Max 调大', watch: 'Need 跟着变大，可能就再也凑不出安全序列了 —— 结论从"安全"翻成"不安全"。' },
      { act: '把资源总量调小', watch: '可用量变少，安全序列的顺序会跟着换。' },
    ],
    terms: ['safeseq', 'needmax', 'deadlock'],
  },
  arq: {
    question: '帧丢了之后，回退 N 和选择重传各要重发多少个？',
    step: (s: never, doc) => {
      const st = s as { i: number; base: number; next: number; expected: number
                        delivered: number; transmissions: number
                        event: 'send' | 'resend' | 'recv' | 'ack' | 'drop' | 'timeout' | 'idle' | 'done' }
      const proto = String(doc.params.protocol)
      const NAME = { GBN: '回退 N', SR: '选择重传', SW: '停止等待' }[proto] ?? proto
      const EV = { send: '发出一帧', resend: '重发', recv: '接收方收到一帧', ack: '发送方收到 ACK',
                   drop: '有东西在路上丢了', timeout: '定时器超时', idle: '窗口满了，只能等', done: '全部送达' }
      const rule = st.event === 'timeout'
        ? proto === 'SR'
          ? '选择重传：仅重发超时的该帧；其余帧各自维护独立定时器，不受影响。'
          : '回退 N：接收方仅接受按序到达的帧，故该帧之后已到达的帧均被丢弃，发送方**自该帧起整段重发**。'
        : st.event === 'recv'
          ? proto === 'SR'
            ? '选择重传的接收方**缓存乱序帧**：非期待序号的帧先行缓存，待缺失帧补齐后按序交付。'
            : '回退 N 的接收方仅接收**序号恰为期待值**的帧，其余一律丢弃，不设缓存。'
          : st.event === 'idle'
            ? `已发送未确认的帧数达到窗口上限 ${doc.params.windowSize}，发送方停止发送、等待 ACK：窗口在此起流量限制作用。`
            : '每发出一帧即启动其定时器；收到 ACK 后窗口前移，前移后腾出的位置才可用于发送新帧。'
      return [
        { k: '本步输入', v: `第 **${st.i}** 个时隙 · ${NAME} · ${EV[st.event] ?? st.event}` },
        { k: '判定规则', v: rule },
        { k: '本步结果',
          v: `发送窗口 [${st.base}, ${st.next - 1}]，接收方期待 **${st.expected}** 号，`
            + `已交付 ${st.delivered} 帧，累计传输 **${st.transmissions}** 次。` },
        { k: '对应画面',
          /*  ⚠️ 编号必须跟上面那段一致。第一版这里写 `i + 1`、上面写 `i`，
              同一条带子里两个数打架，读的人只会以为自己看错了行。 */
          v: `时空图第 ${st.i} 个时隙所在行：左侧为发送方，右侧为接收方；`
            + `斜线表示一帧，红色斜线表示该帧在传输中丢失。` },
      ]
    },
    read: [
      { at: '时空图', is: '左边是发送方、右边是接收方。斜线是帧，红色是丢掉的。', anchor: '.aplot' },
      { at: '窗口状态页签', is: '发送窗口此刻滑到哪儿、哪些已确认。', anchor: '.tabs' },
    ],
    try: [
      { act: '在 GBN 和 SR 之间切（同一组丢包事件）', watch: 'GBN 把丢的那个后面全部重发一遍，SR 只补那一个 —— 传输次数差出来的就是代价。' },
      { act: '把窗口调大', watch: 'GBN 的代价随窗口变大而变大，因为一丢就要回退更多。' },
    ],
    terms: ['gbnsr', 'cumack'],
  },
  float: {
    question: '一个十进制小数，怎么变成 32 位里的那一串 0 和 1？',
    step: (s: never, doc) => {
      const st = s as { phase: string; bits: string; detail: Record<string, string> }
      const fmt = String(doc.params.format)
      const op = String(doc.params.operation)
      const kv = Object.entries(st.detail)
      const RULE: Record<string, string> = {
        sign: '符号位单独拿出来：**0 正 1 负**，它不参与后面的数值换算。',
        int: '整数部分**除 2 取余**，余数倒着读就是二进制。',
        frac: '小数部分**乘 2 取整**，取出的整数位正着读 —— 它可能永远除不尽，那就是浮点误差的来源。',
        normalize: '**规格化**：把尾数挪成 `1.xxx` 的形式，小数点挪几位，阶码就加减几。',
        /*  ⚠️ `format` 的实际取值是 `single` / `double`，不是 `binary32`。
            写错的那版一路走进双精度分支，规则里印「偏置 1023」，
            而下一行的结果印「3 + 127 = 130」—— **同一屏上自相矛盾**。
            判据抓不到：两段都非空、都跟着步数变。只有念一遍才看得出来。 */
        exponent: `**阶码存移码**：真值加偏置（${fmt === 'double' ? '1023' : '127'}）。这样全 0 最小、全 1 最大，比大小可以直接按无符号比。`,
        mantissa: '**隐含位不存**：规格化之后整数位恒为 1，那个 1 不占位置，只存小数点后面那串。',
        assemble: '把符号、阶码、尾数按位拼起来，就是最终的机器数。',
        align: '**对阶**：两个数的阶码不同不能直接加减 —— 小阶向大阶看齐，尾数右移，右移几位就丢几位精度。',
        addsub: '对阶之后尾数才能直接加减。',
        round: '**舍入**：结果尾数超出位数就要舍入，这一步会引入误差。',
        special: '落到特殊值：阶码全 0 或全 1 有专门的含义（非规格化数 / 无穷 / NaN）。',
        done: '拼装完成。',
      }
      return [
        { k: '本步输入', v: `${fmt} · ${op}；当前位串 \`${st.bits || '（还没拼）'}\`` },
        { k: '判定规则', v: RULE[st.phase] ?? `进入「${st.phase}」这一步。` },
        { k: '本步结果',
          v: kv.length
            ? kv.map(([k2, v2]) => `**${k2}** ${v2}`).join('；') + '。'
            : `位串更新为 \`${st.bits}\`。` },
      ]
    },
    read: [
      { at: '位域拆解', is: '符号 1 位 / 阶码 8 位 / 尾数 23 位（单精度）。鼠标停在某段能看到它的值。', anchor: '.bfrow' },
      { at: '推导链页签', is: '七步：定符号、转二进制、规格化、算阶码、取尾数、拼起来、验证。', anchor: '.tabs' },
    ],
    try: [
      { act: '把数改成 0.1', watch: '二进制是无限循环的，尾数只能截断 —— 这就是浮点误差的来源，验证那一步会显示回读的真实值。' },
      { act: '切到 double', watch: '阶码 11 位、尾数 52 位，偏置从 127 变成 1023。', param: '精度' },
      { act: '切到 add', watch: '四步：对阶（小阶向大阶看齐）、尾数相加、规格化、舍入。', param: '做什么' },
    ],
    terms: ['exp', 'mant', 'bias', 'normal'],
  },
  pipeline: {
    question: '有数据冒险的时候，五段流水线要停几拍？前递能省下几拍？',
    step: (s: never, doc) => {
      const st = s as { cycle: number; at: Record<string, string>; stalled: string[]
                        flushed: string[]; forwards: Record<string, string>; done: number }
      const fw = Number(doc.params.forwarding) >= 1
      const busy = Object.entries(st.at).filter(([, seg]) => seg && seg !== '-')
      const fwList = Object.entries(st.forwards)
      return [
        { k: '本步输入',
          v: `第 **${st.cycle}** 周期；流水线上有 ${busy.length} 条指令在跑`
            + (busy.length ? `（${busy.map(([ins2, seg]) => `${ins2}@${seg}`).join('、')}）` : '') },
        { k: '判定规则',
          v: `五段流水：取指 → 译码 → 执行 → 访存 → 写回，不同指令的不同段同一周期并行。`
            + `**数据冒险**是后一条要用的值前一条还没写回 —— `
            + (fw
                ? `已开**前递**：结果从上一段直接送到下一段的输入，能消掉大部分停顿。`
                : `**没开前递**：只能等前一条写回，中间插气泡。`) },
        { k: '本步结果',
          v: (st.stalled.length ? `**停顿**：${st.stalled.join('、')} 这一拍走不动（气泡）。` : '本周期没有停顿。')
            + (st.flushed.length ? ` 分支导致 ${st.flushed.join('、')} 被清空。` : '')
            + (fwList.length ? ` 前递：${fwList.map(([k2, v2]) => `${v2} → ${k2}`).join('、')}。` : '')
            + ` 已完成 ${st.done} 条指令。` },
      ]
    },
    read: [
      { at: '时空图', is: '横轴是周期，每一行是一条指令，格子里是它这个周期在哪一段。', anchor: '.ptab.pipe' },
      { at: '带斜纹的格子', is: '停顿（气泡）。它后面的指令跟着一起停。', anchor: '.pipe' },
    ],
    try: [
      { act: '把数据前递从 0 切到 1', watch: '停顿的格子少掉一批，总周期数明显下降 —— 省下来的就是前递的价值。', param: '数据前递' },
      { act: '数一数总周期', watch: '理想情况是「段数 + 指令数 − 1」，多出来的每一拍都能在图上找到对应的那个气泡。' },
    ],
    terms: ['pipeline', 'hazard', 'forward'],
  },
  vm: {
    question: '一个虚地址，要走几步、访问几次内存，才变成物理地址？',
    step: (s: never, doc) => {
      const st = s as { vaddr: number; vpn: number; offset: number
                        outcome: 'tlbHit' | 'ptHit' | 'fault'
                        paddr: number | null; frame: number | null
                        evicted: number | null; tlbHits: number; ptHits: number; faults: number }
      const hex = (n: number) => '0x' + n.toString(16).toUpperCase()
      const pageSize = Number(doc.params.pageSizeBytes)
      const offBits = Math.log2(pageSize)
      const cap = Number(doc.params.tlbEntries)
      return [
        { k: '本步输入', v: `虚地址 **${hex(st.vaddr)}**；页大小 ${pageSize}B` },
        { k: '判定规则',
          v: `地址低 ${offBits} 位是**页内偏移**，原样搬到物理地址上；高位是**页号**，只有它要翻译。`
            + `先查 TLB（${cap} 项），没有再查页表；页表里也没有就是缺页。` },
        { k: '本步结果',
          v: st.outcome === 'tlbHit'
            ? `页号 ${st.vpn} 在 **TLB** 里命中 → 页框 ${st.frame}，物理地址 ${st.paddr === null ? '—' : hex(st.paddr)}；`
              + `本次只访存一次。累计 TLB 命中 ${st.tlbHits} 次。`
            : st.outcome === 'ptHit'
              ? `TLB 未命中，查**页表**找到页号 ${st.vpn} → 页框 ${st.frame}，物理地址 ${st.paddr === null ? '—' : hex(st.paddr)}；`
                + `本次多访存一次，结果回填 TLB`
                + (st.evicted === null ? '。' : `，按 LRU 换出了页 ${st.evicted}。`)
                + `累计页表命中 ${st.ptHits} 次。`
              : `页表里也没有页号 ${st.vpn} —— **缺页**，要从磁盘调入。累计缺页 ${st.faults} 次。` },
      ]
    },
    read: [
      { at: '转换链', is: '拆地址 → 查 TLB →（没中就）查页表 → 拼物理地址。', anchor: '.vmchain' },
      { at: '位域', is: '低位是页内偏移，高位是页号。偏移原样搬过去，只有页号被翻译。', anchor: '.bfrow' },
    ],
    try: [
      { act: '把页大小从 4096 改成 1024', watch: '偏移从 12 位缩到 10 位，页号变长 —— 页表项也就更多。', param: '页大小' },
      { act: '把 TLB 项数调小', watch: 'TLB 命中率掉下来，访存次数上去。', param: 'TLB 项数' },
    ],
    terms: ['page', 'tlb', 'vaddr'],
  },
  multiply: {
    question: '乘法和除法在硬件里是怎么一位一位做出来的？',
    step: (s: never, doc) => {
      const st = s as { round: number; hi: string; lo: string; extra: string
                        act: string; judge: string; q: number | null; rem: number | null }
      const algo = String(doc.params.algorithm)
      //  ⚠️ 键对齐注册表里的实际取值：'原码一位乘' / 'Booth' / '加减交替'
      const RULE: Record<string, string> = {
        原码一位乘: '**原码一位乘**：符号位单独算，数值部分按乘数末位决定"加被乘数还是加 0"，然后右移一位。',
        Booth: '**Booth（补码一位乘）**：看乘数末位与它右边那个附加位这**两位**的组合 —— `01` 加、`10` 减、`00`/`11` 只移位。它能直接算带符号数，不用先取绝对值。',
        加减交替: '**加减交替法（不恢复余数法）**：余数为负就不退回去，下一步改成加法补偿 —— 省掉一次"恢复余数"的操作。',
      }
      return [
        { k: '本步输入',
          v: `第 **${st.round}** 轮；高位 \`${st.hi}\`、低位 \`${st.lo}\``
            + (st.extra ? `、附加位 \`${st.extra}\`` : '')
            + (st.judge ? `；${algo === 'Booth' ? '末两位' : '判断位'} **${st.judge}**` : '') },
        { k: '判定规则', v: RULE[algo] ?? `按 ${algo} 逐位处理。` },
        { k: '本步结果',
          v: (st.act === 'add' ? '本步**加**上被乘数/除数。'
            : st.act === 'sub' ? '本步**减**去被乘数/除数。'
            : st.act === 'shift' ? '本步只**移位**，不加不减。'
            : st.act === 'correct' ? '最后一步**校正**：补码乘除的最高位要单独处理，不校正符号就是错的。'
            : st.act === 'done' ? '算完了。'
            : '本步不作加减。')
            + ` 结果 \`${st.hi}\` \`${st.lo}\``
            + (st.q !== null ? `；商 ${st.q}` : '')
            + (st.rem !== null ? `、余数 ${st.rem}` : '')
            + '。' },
      ]
    },
    read: [
      { at: '寄存器视图', is: '每一轮之后各寄存器的值，加粗的是这一轮变了的。', anchor: '.mregs' },
      { at: '逐轮表', is: '每一轮判断了什么、做了加还是减、移了几位。', anchor: '.tabs' },
    ],
    try: [
      { act: '在三种算法之间切', watch: '原码一位乘要先取绝对值最后再定符号；Booth 直接处理带符号数；加减交替是除法。', param: '算法' },
      { act: '把位数从 4 调到 8', watch: '轮数跟着变成 8 —— 一位乘每轮处理一位，轮数就等于位数。', param: '位数' },
    ],
    terms: ['booth', 'restore'],
  },
  addsub: {
    question: '补码加减为什么符号位能一起算？什么时候会溢出？',
    step: (s: never) => {
      const st = s as {
        act: string; op: 'add' | 'sub'; aVal: number; bVal: number
        bits: number; pos: number; carryIn: number; sum: string
        cInSign: number; cOutSign: number; overflow: boolean; addend: string; bBits: string
      }
      const done = st.act === 'overflow' || st.act === 'done'
      return [
        { k: '本步输入',
          v: st.act === 'setup'
            ? `A = ${st.aVal}，B = ${st.bVal}，先各写成 ${st.bits} 位补码`
            : st.act === 'negate'
              ? `减法要把 B 变成 −B 的补码：[B]补 = ${st.bBits}`
              : st.act === 'addbit'
                ? `正在算第 ${st.bits - st.pos} 列（从低位数），进入这一列的进位是 ${st.carryIn}`
                : `逐列相加已完成，结果补码 ${st.sum}` },
        { k: '判定规则',
          v: st.act === 'negate'
            ? `**(−B)补 = [B]补按位取反再 + 1**。这样 A − B 就变成 A + (−B)，全用加法器做。`
            : done
              ? `**溢出看双进位**：进入符号位的进位 ⊕ 移出符号位的进位，不相等就溢出 —— `
                + `不是看最高位有没有进位。`
              : `**补码加法符号位一起参与**，逐列从低位往高位加，每列带上一列的进位 —— `
                + `不用像原码那样单独处理符号。` },
        { k: '本步结果',
          v: st.act === 'setup'
            ? `补码写好了，接下来${st.op === 'sub' ? '先求 −B 的补码' : '逐列相加'}。`
            : st.act === 'negate'
              ? `−B 的补码 = ${st.addend}，下面用它和 A 相加。`
              : st.act === 'addbit'
                ? `本列结果 ${st.sum[st.pos]}，产生的进位送往上一列。`
                : done
                  ? (st.overflow
                      ? `${st.cInSign} ⊕ ${st.cOutSign} = 1 → **溢出**，机器数 ${st.sum} 不是真正的和。`
                      : `${st.cInSign} ⊕ ${st.cOutSign} = 0 → **无溢出**，结果 ${st.sum} 有效。`)
                  : '' },
      ]
    },
    verdict: (s: never) => {
      const st = s as { act: string; overflow: boolean; sum: string; op: 'add' | 'sub'; aVal: number; bVal: number }
      if (st.act !== 'overflow' && st.act !== 'done') return `逐列相加中…`
      const real = st.op === 'sub' ? st.aVal - st.bVal : st.aVal + st.bVal
      return st.overflow ? `溢出 · 真正的和是 ${real}` : `无溢出 · 结果 = ${real}`
    },
    read: [
      { at: '竖式', is: '两个补码上下对齐，从最低位往高位逐列相加，当前列高亮。', anchor: '.ascol' },
      { at: '进位那一行', is: '每列产生、送往上一列的进位 —— 溢出就藏在符号位那两个进位里。', anchor: '.ascarry' },
      { at: '溢出判定页签', is: '双进位异或、符号看变化两种等价判法。', anchor: '.tabs' },
    ],
    try: [
      { act: '把操作数换成 100 和 50（都是正数）', watch: '两个正数相加得到负数 —— 结果符号翻了，就是溢出。', preset: '正 + 正（溢出）' },
      { act: '在「加 / 减」之间切', watch: '减法会多一步"求 −B 的补码"，之后完全走加法的路子。', param: '运算' },
    ],
    terms: ['complement', 'overflow'],
  },
  crc: {
    question: '发过去的一串位被改了一位，CRC 能不能查出来？',
    step: (s: never, doc) => {
      const st = s as { i: number; dividend: string; at: number; q: string
                        quotient: string; remainder: string
                        phase: 'init' | 'divide' | 'result' | 'verify' }
      const g = String(doc.params.generator)
      const enc = doc.params.operation === 'encode'
      if (st.phase === 'init') return [
        { k: '本步输入', v: `数据 **${st.dividend}**，生成多项式 **${g}**（${g.length} 位）` },
        { k: '判定规则',
          v: enc
            ? `发送端先在数据末尾补 **${g.length - 1} 个 0**（补零位数等于多项式次数，即校验位位数），再作模 2 除法。`
            : '接收端所得为「数据 + 校验位」的完整码字，直接作除法，不再补零。' },
        { k: '本步结果', v: '被除数已就位，自最高位起逐位对齐相除。' },
        { k: '对应画面', v: '竖式首行即为该被除数。' },
      ]
      if (st.phase === 'divide') return [
        { k: '本步输入', v: `被除数对齐到第 **${st.at + 1}** 位，那一位是 **${st.q === '1' ? 1 : 0}**` },
        { k: '判定规则',
          v: st.q === '1'
            ? `对齐位为 1，商取 **1**，将自该位起的 ${g.length} 位与 ${g} **逐位异或**。`
              + '模 2 除法以异或代替减法，**不进位、不借位**，因此是否"够除"仅由对齐位决定。'
            : '对齐位为 0，商取 **0**，本位不作异或，除数右移一位。' },
        { k: '本步结果', v: `当前商为 ${st.quotient}，被除数变为 ${st.dividend}。` },
        { k: '对应画面', v: `竖式中高亮的若干位，即本步参与异或的位置。` },
      ]
      return [
        { k: '本步输入', v: `除法结束，余数为 **${st.remainder || '—'}**` },
        { k: '判定规则',
          v: enc
            ? '发送端：该余数即**校验位**，附于数据之后构成码字发送。'
            : '接收端：对整个码字再作一次除法，**余数为 0 方判定为校验通过**。' },
        { k: '本步结果',
          v: enc
            ? `校验位为 **${st.remainder}**，发送的码字 = 数据 + 校验位。`
            : /^0*$/.test(st.remainder)
              ? `余数是 **${st.remainder}** —— 全 0，这串码字校验通过。`
              : `余数是 **${st.remainder}** —— 不是 0，**路上被改过**。` },
        { k: '对应画面', v: '竖式末行右端的若干位。' },
      ]
    },
    read: [
      { at: '竖式', is: '模 2 除法，每一步都是异或，不进位不借位。', anchor: '.crcdiv' },
      { at: '结果那一行', is: '余数就是校验位，附在数据后面构成码字。', anchor: '.crcdiv .crow:last-of-type' },
    ],
    try: [
      { act: '把码字里任意一位翻转', watch: '收端再除一次，余数不为 0 —— 检出。这个实验对每一位都试过一遍。' },
      { act: '换生成多项式', watch: '校验位的长度 = 多项式次数，检错能力也跟着变。' },
    ],
    terms: ['crc'],
  },
  hamming: {
    question: '海明码怎么做到"算出来的数就是出错的位号"？',
    step: (s: never) => {
      const st = s as { bits: string; touched: number[]; p: number; covers: number[]
                        ok: boolean | null; syndrome: number
                        phase: 'layout' | 'parity' | 'done' | 'inject' | 'check' | 'locate' }
      const cov = st.covers.length ? st.covers.join('、') : '—'
      if (st.phase === 'layout') return [
        { k: '本步输入', v: '若干数据位，需按海明码规则排入码字' },
        { k: '判定规则',
          v: '**位号是 2 的幂**（1、2、4、8…）的位置留给校验位，其余位置按顺序放数据位。'
            + '这个摆法不是约定俗成 —— 它是让"校验子等于位号"成立的前提。' },
        { k: '本步结果', v: `码字长度为 ${st.bits.length} 位。` },
        { k: '对应画面', v: '位序表中灰底为校验位，白底为数据位。' },
      ]
      if (st.phase === 'parity' || st.phase === 'check') return [
        { k: '本步输入', v: `校验位 **P${st.p}**，它覆盖位号 ${cov}` },
        { k: '判定规则',
          v: `P${st.p} 管的是**位号的二进制里"${st.p}"那一位为 1** 的所有位 —— `
            + `所以覆盖范围不用背，看位号就知道。`
            + (st.phase === 'parity' ? '编码时取值使这些位（含该校验位自身）中 1 的个数为偶数。'
                                     : '接收端重新计算，检验其奇偶性是否仍然成立。') },
        { k: '本步结果',
          v: st.phase === 'parity'
            ? `P${st.p} 取使其覆盖范围内 1 的个数为偶数的值。`
            : st.ok === false
              ? `**没通过** —— 错位一定在它覆盖的范围里，校验子加上 ${st.p}，现在是 **${st.syndrome}**。`
              : `通过 —— 错位不在它的覆盖范围里，校验子不加，仍是 **${st.syndrome}**。` },
        { k: '对应画面', v: `位序表中高亮的若干格（位号 ${cov}）即其覆盖范围。` },
      ]
      if (st.phase === 'inject') {
        //  内核把翻掉那一位的下标放在 touched 里（下标 0 对应位号 1）
        const at = st.touched.length ? st.touched[0]! + 1 : null
        return [
          { k: '本步输入',
            v: at === null ? '本次未注入差错，码字原样到达接收端'
                           : `传输中**第 ${at} 位**发生翻转，接收端收到的码字为 ${st.bits}` },
          { k: '判定规则',
            v: '**接收端并不知道哪一位出错**，它只看到一串位。可行的做法只有一种：'
              + '按原覆盖规则逐个重算校验位，找出其中不成立的那些。' },
          { k: '本步结果',
            v: at === null ? '接下来逐个重算校验位，各项均应成立。'
                           : `接下来逐个重算校验位：凡覆盖第 ${at} 位的校验均不成立。` },
          { k: '对应画面',
            v: at === null ? '位序表所示即接收端收到的码字。'
                           : `位序表中标红的那一格（位号 ${at}）。` },
        ]
      }
      return [
        { k: '本步输入', v: `全部校验位计算完毕，校验子为 **${st.syndrome}**` },
        { k: '判定规则',
          v: '将未通过的各校验位的位号相加，所得之值**即出错位的位号**，无需查表。' },
        { k: '本步结果',
          v: st.syndrome === 0
            ? '校验子为 0，各位均无差错。'
            : `第 **${st.syndrome}** 位出错，将其取反即可纠正；这正是海明码相较 CRC 多用若干校验位所换来的能力。` },
        { k: '对应画面', v: '位序表中被指出的那一格。' },
      ]
    },
    read: [
      { at: '位序表', is: '2 的幂次位（1、2、4、8…）放校验位，其余放数据位。', anchor: '.hgrid' },
      { at: '每个校验位那一行', is: '它负责哪些位 —— 规律是"位号的二进制里那一位是 1"。', anchor: '.hrow' },
    ],
    try: [
      { act: '翻转任意一个数据位', watch: '收端算出的校验子（二进制）恰好等于出错位的位号，直接指出来。' },
      { act: '翻转一个校验位', watch: '同样指得出来 —— 校验位自己出错也在覆盖范围内。' },
    ],
    terms: ['hamming'],
  },
  subnet: {
    question: '给一个网段和掩码，能划几个子网、每个能放多少台机器？',
    step: (s: never) => {
      const st = s as { prefix: number; best: string; entry: string; hit: boolean
                        detail: Record<string, string>
                        phase: 'addr' | 'mask' | 'network' | 'broadcast' | 'hosts' | 'split' | 'match' | 'pick' }
      const host = 32 - st.prefix
      const D = (k: string) => st.detail[k] ?? '—'
      const M = {
        addr: ['一个 IPv4 地址', '先摊成 32 位二进制 —— 十进制点分只是给人看的，机器眼里就是这 32 位。',
               `地址摆好了。`, '位域第一行。'],
        mask: [`前缀 **/${st.prefix}**`, `掩码就是**前 ${st.prefix} 位全 1、后 ${host} 位全 0**。1 盖住的是网络号，0 露出来的是主机号。`,
               `网络号 ${st.prefix} 位，主机号 ${host} 位。`, '位域第二行，跟上面那行对齐着看。'],
        network: ['地址与掩码', '把主机位**全部置 0**，得到的就是这个网段的网络地址 —— 它代表整个网段，不能分给任何一台机器。',
                  `网络地址 = ${D('网络地址')}`, '位域里主机位被清零的那一行。'],
        broadcast: ['地址与掩码', '把主机位**全部置 1**，得到广播地址 —— 发给它等于发给网段里所有机器，同样不能分配。',
                    `广播地址 = ${D('广播地址')}`, '位域里主机位被拉满的那一行。'],
        hosts: [`主机位 ${host} 位`, `地址总数是 2^${host}，但**要减 2** —— 全 0 是网络地址、全 1 是广播地址，都不能给主机。`,
                `地址总数 ${D('地址总数')}，可用主机 **${D('可用主机数')}**`, '右边读数栏里那两个数。'],
        split: ['再借几位划子网', '从主机位里再借几位当子网号：借 n 位就分出 2^n 个子网，每个子网的主机数除以 2^n，而**减 2 要各扣各的**。',
                '子网表列出了每一个。', '子网表那一页。'],
        match: [`路由表里的一条：${st.entry}`, '最长前缀匹配：目的地址跟每条路由的网络号逐位比，**比中的里面选前缀最长的那条**。',
                st.hit ? `匹配上了，当前最优是 ${st.best}` : '这条没匹配上。', '路由表里高亮的那一行。'],
        pick: ['所有路由都比过了', '前缀越长越具体 —— 具体的优先于笼统的，默认路由 0.0.0.0/0 因此永远排最后。',
               `最终走 **${st.best}**`, '路由表里被选中的那一行。'],
      }[st.phase]
      return [
        { k: '本步输入', v: M[0]! },
        { k: '判定规则', v: M[1]! },
        { k: '本步结果', v: M[2]! },
        { k: '对应画面', v: M[3]! },
      ]
    },
    read: [
      { at: '位域', is: '32 位地址里，掩码的 1 划出网络号、0 是主机号。', anchor: '.bfrow' },
      { at: '子网表', is: '每个子网的网络地址、可用主机范围、广播地址。', anchor: '.tabs' },
    ],
    try: [
      { act: '把掩码从 /24 改成 /26', watch: '子网数 ×4、每个子网的主机数 ÷4 —— 借几位就翻几倍。' },
      { act: '看可用主机数', watch: '总是 2^主机位 − 2：全 0 是网络地址、全 1 是广播地址，都不能给主机。' },
    ],
    terms: ['mask', 'longest'],
  },
  handshake: {
    question: '建立和断开一条 TCP 连接，两端的状态各自怎么变？',
    step: (s: never) => {
      const st = s as { client: string; server: string; history: unknown[]
                        /*  ⚠️ 照 `src/kernels/handshake.ts` 的 `Seg` 抄，别按印象写：
                            `flags` 是**一个字符串**（"SYN+ACK"），不是数组；
                            方向字段叫 `dir`（'c2s' / 's2c'），不叫 `from`。
                            第一版两处都写错，`flags.join` 在真实状态上直接抛，
                            握手实验有两步的带子整条消失。 */
                        seg: { flags: string; seq: number; ack: number; dir: 'c2s' | 's2c' } | null
                        act: 'send' | 'arrive' | 'lost' | 'timeout' | 'wait' | 'done' }
      /*  ⚠️ 「到达」那一步内核不带 `seg`（它只在发出时挂一次），
          刚到的那个报文段其实是 `history` 的最后一个。不这么取，
          到达那半边就只剩一句"报文到达对端"，标志位和序号全丢了。 */
      const seg = st.seg ?? (st.act === 'arrive'
        ? st.history[st.history.length - 1] as typeof st.seg
        : null)
      const flags = seg?.flags ?? '—'
      const who = seg?.dir === 's2c' ? '服务器' : '客户端'
      const ACT = { send: `${who}发出`, arrive: '报文到达对端', lost: '这个报文丢了',
                    timeout: '等超时了', wait: '在等', done: '走完了' }
      const rule = st.act === 'wait'
        ? '**TIME_WAIT 要等 2MSL**：万一最后那个 ACK 丢了，对方会重发 FIN，这段时间就是留给它的。'
          + '等完之后这条连接的四元组才能被复用。'
        : flags.includes('SYN') && flags.includes('ACK')
          ? '服务器把「我收到你的 SYN 了」和「我也要发」**捎带在同一个报文段**里 —— 建连之所以是三次而不是四次，就差在这一下。'
          : flags.includes('FIN')
            ? '**FIN 只代表"我发完了"**，不代表对方也发完了。所以对方先单独回一个 ACK，等自己发完再发自己的 FIN —— 断连因此多一次。'
            : flags.includes('SYN')
              ? '发起方挑一个初始序号发过去 —— 序号不从 0 开始，是为了避免旧连接的残留报文被认成新连接的。'
              : '确认号 = 期待收到的下一个字节序号，所以它总是对方序号 + 1（SYN 和 FIN 各占一个序号）。'
      return [
        { k: '本步输入',
          v: seg
            ? `第 **${st.history.length}** 个报文段（${ACT[st.act]}）：**${flags}**，`
              + `seq=${seg.seq ?? '—'}、ack=${seg.ack ?? '—'}`
            : ACT[st.act] },
        { k: '判定规则', v: rule },
        { k: '本步结果', v: `客户端 **${st.client}** · 服务器 **${st.server}**` },
        { k: '对应画面', v: `时序图上第 ${Math.max(1, st.history.length)} 条斜箭头，两侧竖线上的状态标签也跟着换了。` },
      ]
    },
    read: [
      { at: '时序图', is: '左右两条竖线是两端，斜箭头是报文，上面标着标志位和序号。', anchor: '.hsplot' },
      { at: '两侧的状态标签', is: '每收发一个报文之后各自处在什么状态。', anchor: '.hsside' },
    ],
    try: [
      { act: '走完四次挥手', watch: '主动关闭方进 TIME_WAIT 要等 2MSL 才真正关掉 —— 这一段在图上是有长度的。' },
      { act: '数一数为什么建连是三次', watch: '两个方向各要一次"我的初始序号"和一次确认，其中两次能合并成一个报文。' },
    ],
    terms: ['handshake', 'timewait'],
  },
  avl: {
    question: '往二叉搜索树里插入，什么时候会失衡？该怎么转？',
    step: (s: never, doc) => {
      const st = s as { key: number; act: string; rotation: string; pivot: number
                        inserted: number; rotations: number; root: number
                        nodes: { key: number; bf?: number }[]; focus: number[] }
      const mode = String(doc.params.mode ?? 'AVL')
      const ROT: Record<string, string> = {
        LL: '**LL**：失衡结点往下两步都是左 —— 同向，右旋一次。',
        RR: '**RR**：往下两步都是右 —— 同向，左旋一次。',
        LR: '**LR**：先左后右 —— 异向，先把下面那段掰成同向，再转，一共两次。',
        RL: '**RL**：先右后左 —— 异向，同样转两次。',
      }
      return [
        { k: '本步输入',
          v: `正在插入 **${st.key}**；树上已有 ${st.nodes.length} 个结点`
            + (st.focus.length ? `，当前看的是第 ${st.focus.join('、')} 号结点` : '') },
        { k: '判定规则',
          v: st.act === 'rotate'
            ? (ROT[st.rotation] ?? '按失衡类型旋转。')
              + ' 旋转的名字按**失衡结点往下两步的方向**取，不是按插入的方向。'
            : `先按二叉搜索树的规矩找位置：比结点小往左、大往右。插完从插入点往上回溯，`
              + `谁的**平衡因子**（左高 − 右高）绝对值超过 1，谁就是失衡结点${mode === 'BST' ? '（本模式不旋转，只看它长歪）' : '，对它做旋转'}。` },
        { k: '本步结果',
          v: st.act === 'rotate'
            ? `对 ${st.pivot} 号结点做 **${st.rotation}** 旋转，树重新平衡。累计旋转 ${st.rotations} 次。`
            : st.act === 'insert'
              ? `${st.key} 插入完成，树上现在 ${st.nodes.length} 个结点，还没发现失衡。`
              : st.act === 'done'
                ? `插完了：${st.nodes.length} 个结点，一共旋转 ${st.rotations} 次。`
                : `继续往下找 ${st.key} 该去的位置。` },
      ]
    },
    read: [
      { at: '树形', is: '结点上的小数字是平衡因子（左高 − 右高）。', anchor: '.tvbox' },
      { at: '标红的结点', is: '失衡点 —— 从插入位置往上找到的第一个 |bf| > 1 的结点。', anchor: '.tvbox' },
    ],
    try: [
      { act: '切到 bst 模式插同一串', watch: '不做旋转，树会长成一条链，查找退化成 O(n)。这就是 AVL 要解决的问题。', param: '模式' },
      { act: '插入一串递增的数', watch: '每插几个就触发一次 RR 旋转，树被反复掰回来。' },
    ],
    terms: ['bf', 'rotate'],
  },
  btree: {
    question: '前中后序只差"根什么时候输出"？中序遍历 BST 为什么是有序的？',
    step: (s: never) => {
      const st = s as {
        order: 'pre' | 'in' | 'post' | 'level'
        nodes: { key: number }[]; cur: number; visited: number[]
        aux: number[]; auxKind: 'stack' | 'queue'; act: string; log: string
      }
      const ORDER_CN: Record<string, string> = { pre: '前序', in: '中序', post: '后序', level: '层序' }
      const RULE: Record<string, string> = {
        pre: '**前序 = 根 → 左 → 右**：每到一个结点，先输出它自己，再去左子树、右子树。',
        in: '**中序 = 左 → 根 → 右**：先把左子树走完，再输出自己，最后走右子树。',
        post: '**后序 = 左 → 右 → 根**：左右子树都走完，最后才输出自己。',
        level: '**层序 = 一层一层**：用队列，出队一个就访问它，再把它的左右孩子入队。',
      }
      const seq = st.visited.map(n => st.nodes[n]?.key).join(' ')
      return [
        { k: '本步输入',
          v: st.act === 'done'
            ? `遍历结束，共输出 ${st.visited.length} 个结点`
            : `正在做 **${ORDER_CN[st.order]}** 遍历；已输出 ${Math.max(0, st.visited.length - 1)} 个`
              + `，${st.auxKind === 'stack' ? '调用栈' : '队列'}里 ${st.aux.length} 个` },
        { k: '判定规则', v: RULE[st.order] },
        { k: '本步结果',
          v: st.act === 'done'
            ? `${ORDER_CN[st.order]}序列：**${seq}**`
              + (st.order === 'in' ? '　—— 中序遍历二叉搜索树，正好从小到大有序。' : '')
            : `输出 **${st.nodes[st.cur]?.key}**，它是第 ${st.visited.length} 个。`
              + (st.auxKind === 'stack'
                ? `此刻调用栈是从根到它的路径（深度 ${st.aux.length}）。`
                : `此刻队列里还排着 ${Math.max(0, st.aux.length)} 个等着出队。`) },
      ]
    },
    verdict: (s: never) => {
      const st = s as { order: string; cur: number; nodes: { key: number }[]; act: string }
      const CN: Record<string, string> = { pre: '前序', in: '中序', post: '后序', level: '层序' }
      return st.act === 'done' ? `${CN[st.order]}遍历完成`
        : `${CN[st.order]} · 输出 ${st.nodes[st.cur]?.key ?? ''}`
    },
    read: [
      { at: '遍历树', is: '结点下方的 #n 是它被输出的次序，当前结点高亮。', anchor: '.tvbox' },
      { at: '调用栈 / 队列', is: '深度优先看栈（根到当前的路径），层序看队列 —— 容器不同，走法就不同。', anchor: '.btaux' },
      { at: '四种次序页签', is: '同一棵树的四条序列摆一起，一眼看出只差"根在什么时候输出"。', anchor: '.tabs' },
    ],
    try: [
      { act: '在前序 / 中序 / 后序之间切', watch: '树不变、只是"根"输出的时机变，三条序列各不相同。', param: '遍历次序' },
      { act: '切到中序', watch: '不管插入序列多乱，中序输出永远是从小到大 —— 这是 BST 的定义性质。', param: '遍历次序' },
      { act: '切到层序', watch: '辅助结构从栈换成队列，访问从"往深钻"变成"一层层铺开"。', param: '遍历次序' },
    ],
    terms: ['inorder', 'stack'],
  },
  hash: {
    question: '冲突了怎么办？四种处理方式的平均查找长度差多少？',
    step: (s: never, doc) => {
      const st = s as { key: number; home: number; probes: number[]; slot: number
                        compares: number; totalCompares: number; count: number; collided: boolean
                        table: number[][] }
      const size = Number(doc.params.size)
      const method = String(doc.params.method)
      const stepN = Number(doc.params.rehashStep) || 1
      const RULE: Record<string, string> = {
        拉链法: '**拉链法**：冲突了就挂到那个槽的链表后面，槽位不变。',
        线性探测: '**线性探测**：冲突了往后一个一个找空位。老毛病是**堆积** —— 冲突的元素挤成一片连续占用，后来的一撞就要探很多次。',
        平方探测: '**平方探测**：按 ±1²、±2²… 往外跳，正是为了打散线性探测那种连片堆积。',
        再散列: `**再散列**：冲突了按第二个散列函数的步长（这里是 ${stepN}）往前跳。`,
      }
      return [
        { k: '本步输入', v: `插入键 **${st.key}**；表长 ${size}，已装 ${st.count} 个` },
        { k: '判定规则',
          v: `先算**基地址** H(${st.key}) = ${st.key} % ${size} = **${st.home}**。`
            + `那个位置空着就直接放；被占了就是冲突 —— ${RULE[method] ?? method}` },
        { k: '本步结果',
          v: (st.collided
                ? `${st.home} 号槽被占，探测了 ${st.probes.join(' → ')}，最终落在 **${st.slot}** 号槽。`
                : `${st.home} 号槽是空的，直接放进 **${st.slot}** 号槽。`)
            + ` 这个键比较了 ${st.compares} 次，全表累计 ${st.totalCompares} 次 —— `
            + `ASL 就是这个累计数除以键的个数。` },
      ]
    },
    read: [
      { at: '槽位表', is: '每个槽装着谁。虚线框是探测路过但没停下的槽。', anchor: '.hslots' },
      { at: 'ASL 页签', is: '每个关键字查到它要比较几次，平均下来就是 ASL。', anchor: '.tabs' },
    ],
    try: [
      { act: '在拉链和线性探测之间切', watch: '拉链的 ASL 只跟链长有关；线性探测会堆积成一片，后来的要探很远。', param: '冲突处理' },
      { act: '把表长调小', watch: '装填因子上去，所有方式的 ASL 都变差 —— 散列表是拿空间换时间。', param: '表长' },
    ],
    terms: ['asl', 'collide', 'clustering'],
  },
  huffman: {
    question: '给一组权值，怎么合并才能让总编码最短？',
    step: (s: never, doc) => {
      const st = s as { forest: number[]; picked: number[]; merged: number; wpl: number
                        codes: Record<string, string>; act: string
                        nodes: { w: number; ch?: string }[] }
      const w = (idx: number) => st.nodes[idx]?.w ?? 0
      const codeList = Object.entries(st.codes)
      void doc
      /*  ⚠️ 两个字段的时点都要看清楚：
          `forest` 在合并帧里已经是**合并之后**的（内核先 filter 再 concat 才 push 帧），
          所以"本步输入"里不能拿它当合并前的棵数 —— 差一棵。
          `wpl` **只在末帧才算**（内核到 done 那一帧才遍历树累加），
          中途恒为 0；照它写"到此累计 WPL = 0"是句假话。 */
      return [
        { k: '本步输入',
          v: st.act === 'init'
            ? `森林里有 ${st.forest.length} 棵单结点树，权值 ${st.forest.map(w).join('、')}`
            : st.act === 'done'
              ? `合并完毕，只剩一棵树`
              : `合并前森林里有 ${st.forest.length + 1} 棵；本步挑中权值最小的两棵：${st.picked.map(w).join(' 和 ')}` },
        { k: '判定规则',
          v: `每次从森林里取**权值最小的两棵**合并，新结点的权值是它俩之和，再放回森林。`
            + `这样权值大的字符离根近、编码短 —— **WPL（带权路径长度）因此最小**。` },
        { k: '本步结果',
          v: st.act === 'merge'
            ? `合成一棵权值 **${w(st.merged)}** 的新树放回森林；森林剩 ${st.forest.length} 棵。`
              + `（WPL 要等树建完才能算 —— 它是"权值 × 层数"的和。）`
            : st.act === 'done'
              ? `WPL = **${st.wpl}**（它恰好等于所有内部结点权值之和）。`
                + (codeList.length ? ` 编码：${codeList.map(([c, b]) => `${c}=${b}`).join('、')} —— 任何一个都不是另一个的前缀，所以码流不用分隔符也能唯一解码。` : '')
              : `初始森林已就绪，共 ${st.forest.length} 棵。` },
      ]
    },
    read: [
      { at: '森林', is: '每一步取最小的两棵合并成一棵，权值相加当新根。', anchor: '.tv' },
      { at: '编码表', is: '左 0 右 1 走到叶子。所有编码都在叶子上，所以互不为前缀。', anchor: '.tabs' },
    ],
    try: [
      { act: '改几个权值', watch: '树形整个变样，但 WPL 始终等于所有内部结点权值之和 —— 可以拿来验算。' },
      { act: '看编码长度', watch: '权值越大的叶子越浅、编码越短 —— 这就是"常用的字用短码"。' },
    ],
    terms: ['wpl', 'prefix'],
  },
  kmp: {
    question: 'next 数组是怎么求的？失配时模式串到底滑多远？',
    step: (s: never, doc) => {
      const st = s as { phase: 'next' | 'match' | 'found' | 'done'
                        next: number[]; j: number; k: number; ti: number; pj: number
                        eq: boolean | null; found: number[]; textAdvances: number }
      const text = String(doc.params.text)
      const pat = String(doc.params.pattern)
      return [
        /*  ⚠️ 末帧（done）的 ti / pj 是 **−1**，照"第 N 位对第 M 位"写就印出
            「主串第 -1 位 `` 对模式串第 -1 位 ``」—— 下标当哨兵用的字段，
            必须先问这一帧有没有"当前位"这回事。 */
        { k: '本步输入',
          v: st.phase === 'next'
            ? `正在算 next 数组：看模式串前 ${st.j + 1} 位 \`${pat.slice(0, st.j + 1)}\``
            : st.phase === 'done'
              ? `主串 ${text.length} 位、模式串 ${pat.length} 位，已经扫完`
              : `主串第 **${st.ti}** 位 \`${text[st.ti] ?? ''}\` 对模式串第 **${st.pj}** 位 \`${pat[st.pj] ?? ''}\`` },
        { k: '判定规则',
          v: st.phase === 'next'
            ? `next[j] 记的是模式串前 j 位里**最长的相等前后缀**有多长。`
              + `失配时靠它决定模式串往右滑多远 —— 已经匹配上的那一截不用重新比。`
            : `**主串指针只往前走，绝不回退** —— 这就是 KMP 相对暴力法的全部好处。`
              + `失配时只挪模式串：j 退到 next[j]，主串原地不动。` },
        { k: '本步结果',
          v: st.phase === 'next'
            ? `next[${st.j}] = **${st.next[st.j] ?? 0}**（当前最长相等前后缀长度 ${st.k}）。`
            : st.phase === 'found'
              ? `模式串走到头 —— 在主串第 **${st.found[st.found.length - 1] ?? st.ti}** 位处**匹配成功**。`
                + `累计找到 ${st.found.length} 处，主串指针一共只前进了 ${st.textAdvances} 次。`
              : st.phase === 'done'
                ? `扫完了，共找到 ${st.found.length} 处；主串指针总共前进 ${st.textAdvances} 次，一次都没回退。`
                : st.eq
                  ? `两位相等，双方各前进一位。`
                  : `失配：模式串的 j 退到 next[${st.pj}] = ${st.next[st.pj] ?? 0}，**主串不动**。` },
      ]
    },
    read: [
      { at: 'next 数组页签', is: '模式串每个位置的"最长相等前后缀"长度。', anchor: '.tabs' },
      { at: '匹配对齐页签', is: '主串和模式串当前怎么对齐的，红色是失配的那一位。', anchor: '.tabs' },
    ],
    try: [
      { act: '把模式串换成 ababaca', watch: 'next 值明显大于 0，失配时能滑好几位 —— 重复越多，KMP 省得越多。', param: '模式串' },
      { act: '盯住主串的下标', watch: '它全程只增不减。这就是 KMP 相对暴力法的全部好处。' },
    ],
    terms: ['next', 'noback'],
  },
  expr: {
    question: '为什么先把中缀式转成后缀，就能用一个栈一遍算出来？',
    step: (s: never) => {
      const st = s as {
        phase: 'toRPN' | 'eval'; act: string; infix: string[]; at: number
        stack: string[]; rpn: string[]; result: number | null
      }
      const tok = st.at >= 0 ? (st.phase === 'eval' ? st.rpn[st.at] : st.infix[st.at]) : ''
      return [
        { k: '本步输入',
          v: st.phase === 'toRPN'
            ? (st.act === 'flush' ? `中缀读完了，运算符栈里还剩 ${st.stack.length} 个` : `读中缀的第 ${st.at + 1} 个：**${tok}**`)
            : (st.act === 'done' ? `后缀扫描完了，栈里剩 ${st.stack.length} 个` : `读后缀的第 ${st.at + 1} 个：**${tok}**`) },
        { k: '判定规则',
          v: st.phase === 'toRPN'
            ? `**中缀转后缀**：数字直接进后缀；运算符要和栈顶比优先级，`
              + `**栈顶不比它低的先弹出去**，再把自己压栈；括号成对地压入 / 弹出。`
            : `**后缀求值**：遇数字压栈；遇运算符**弹出栈顶两个**算完，`
              + `结果再压回 —— 一遍扫描就出答案。` },
        { k: '本步结果',
          v: st.act === 'flush'
            ? `后缀式确定：**${st.rpn.join(' ')}**，接下来用栈求值。`
            : st.act === 'done'
              ? `栈里只剩一个数，就是答案：**${st.result}**`
              : st.act === 'apply'
                ? `弹两个算完、把结果压回，栈变成 [${st.stack.join(' ')}]。`
                : st.act === 'num' || st.act === 'push'
                  ? `**${tok}** 就位，栈现在是 [${st.stack.join(' ') || '空'}]。`
                  : `栈变成 [${st.stack.join(' ') || '空'}]，后缀已产出 ${st.rpn.length} 个。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; act: string; result: number | null; rpn: string[] }
      if (st.act === 'done' && st.result !== null) return `求值完成 · 结果 ${st.result}`
      if (st.act === 'flush') return `后缀式：${st.rpn.join(' ')}`
      return st.phase === 'eval' ? '后缀求值中' : '中缀转后缀中'
    },
    read: [
      { at: '栈', is: '竖着长的那一摞，栈顶在上 —— 转换时装运算符、求值时装数值。', anchor: '.exstack' },
      { at: '中缀 / 后缀带', is: '上面是原式（当前读到的高亮），下面是逐步产出的后缀式。', anchor: '.extoks' },
    ],
    try: [
      { act: '换成带括号的式子，如 (3+4)*2', watch: '括号会先压栈，遇到右括号时一次性弹到左括号 —— 强行改变了运算顺序。', param: '中缀表达式' },
      { act: '对比 3+4*2 和 (3+4)*2', watch: '同样的数字和运算符，后缀式却不同 —— 优先级和括号都写进了后缀的排列里。', param: '中缀表达式' },
    ],
    terms: ['rpn', 'precedence'],
  },
  mst: {
    question: 'Prim 和 Kruskal 挑边的顺序不同，最后的树一样吗？',
    step: (s: never, doc) => {
      const st = s as { chosen: string[]; inTree: string[]; edge: string
                        act: 'consider' | 'take' | 'skip' | 'done'; weight: number }
      const algo = String(doc.params.algorithm)
      const prim = algo.toLowerCase().includes('prim')
      return [
        { k: '本步输入',
          v: st.act === 'done'
            ? `已选 ${st.chosen.length} 条边`
            : `正在考虑边 **${st.edge}**；树里已有 ${st.inTree.length} 个点、${st.chosen.length} 条边` },
        { k: '判定规则',
          v: prim
            ? `**Prim**：从"已经连上的那一堆"往外挑**权值最小的一条**边，把新点拉进来。`
              + `它天然不会成环 —— 每条边都是从树内连到树外。`
            : `**Kruskal**：把所有边按权值从小到大排，逐条问"加了会不会成环"。`
              + `不成环就要，成环就跳过。判环靠并查集。` },
        { k: '本步结果',
          v: st.act === 'take'
            ? `边 ${st.edge} **选中**，累计权值 ${st.weight}；树里现在 ${st.inTree.length} 个点。`
            : st.act === 'skip'
              ? `边 ${st.edge} **跳过**${prim ? '：两端都已在树里' : '：加了会成环'}。累计权值仍是 ${st.weight}。`
              : st.act === 'done'
                ? `选够 ${st.chosen.length} 条边，总权值 **${st.weight}** —— `
                  + `Prim 和 Kruskal 选的边可能不同，但**总权值必然相同**。`
                : `${st.edge} 进入候选 —— 还要跟其余候选边比一比权值，下一步才定要不要。` },
      ]
    },
    read: [
      { at: '图', is: '加粗的是已选进生成树的边，灰的是被否掉的。', anchor: '.gvwrap' },
      { at: '边表页签', is: '每一步考虑了哪条边、为什么要（或不要）。', anchor: '.tabs' },
    ],
    try: [
      { act: '在 Prim 和 Kruskal 之间切', watch: '挑边的顺序完全不同，但**总权值必然相同** —— 树形可能不一样，代价一定一样。', param: '算法' },
      { act: '看 Kruskal 跳过的那些边', watch: '每一条都是"加了会成环"。Prim 则永远只从已连通的那堆往外挑。' },
    ],
    terms: ['mst', 'cycle'],
  },
  topo: {
    question: '这个工程最短要多久？哪些环节拖不得？',
    step: (s: never, doc) => {
      const st = s as { phase: 'topo' | 've' | 'vl' | 'activity' | 'done'
                        indeg: Record<string, number>; order: string[]; at: string
                        ve: Record<string, number>; vl: Record<string, number>
                        ee: Record<string, number>; el: Record<string, number>
                        critical: string[] }
      /*  ⚠️ `indeg` 是**这一步做完之后**的状态：刚取出的那个点入度仍是 0，
          不排掉的话"入度为 0 的还有 3 个"里数着一个已经出队的点。 */
      const zero = Object.keys(st.indeg).filter(v => st.indeg[v] === 0 && !st.order.includes(v))
      const op = String(doc.params.operation)
      const RULE: Record<string, string> = {
        topo: '**拓扑排序**：反复取出一个**入度为 0** 的点，删掉它和它的出边，让后继的入度减一。取不出来就说明有环。',
        ve: '**ve（事件最早发生时刻）正推**：从源点出发，`ve[j] = max(ve[i] + 权)`，取**最大**——所有前置活动都干完了这个事件才能发生。',
        vl: '**vl（事件最迟发生时刻）逆推**：从汇点倒回来，`vl[i] = min(vl[j] − 权)`，取**最小**——晚一点就会拖工期。',
        activity: '**活动的余量**：`ee` 是活动最早开始（= 起点的 ve），`el` 是最迟开始（= 终点的 vl − 权）。两者相等的活动余量为 0。',
        done: '结束。',
      }
      return [
        { k: '本步输入',
          v: st.phase === 'topo'
            ? `入度为 0 的点有 ${zero.length} 个${zero.length ? `（${zero.join('、')}）` : ''}；已排出 ${st.order.length} 个`
            : st.phase === 'done'
              ? `全部算完`
              : `正在处理 **${st.at || '—'}**` },
        { k: '判定规则', v: RULE[st.phase] ?? `进入「${st.phase}」阶段（${op}）。` },
        { k: '本步结果',
          v: st.phase === 'topo'
            ? (st.at
                ? `取出 **${st.at}**，它的后继入度各减一。当前拓扑序：${st.order.join(' → ')}。`
                : `取不出入度为 0 的点了 —— 图里有环，拓扑序不存在。`)
            : st.phase === 've'
              ? `ve[${st.at}] = **${st.ve[st.at] ?? 0}**（取所有前驱里最大的那条路径）。`
              : st.phase === 'vl'
                ? `vl[${st.at}] = **${st.vl[st.at] ?? 0}**（取所有后继里最小的那条限制）。`
                : st.phase === 'activity'
                  ? `活动 ${st.at}：ee = ${st.ee[st.at] ?? 0}、el = ${st.el[st.at] ?? 0}，`
                    + `余量 ${(st.el[st.at] ?? 0) - (st.ee[st.at] ?? 0)}`
                    + `${(st.el[st.at] ?? 0) === (st.ee[st.at] ?? 0) ? ' —— **关键活动**，拖它一天整个工程就晚一天。' : '，有余量，不是关键活动。'}`
                  : `关键路径：${st.critical.join(' → ') || '—'}。` },
      ]
    },
    read: [
      { at: '图', is: '点是事件、边是活动，边上的数字是工期。', anchor: '.gvwrap' },
      { at: '表格页签', is: '每个事件的 ve（最早）和 vl（最迟），以及每个活动的余量。', anchor: '.tabs' },
    ],
    try: [
      { act: '切到 critical', watch: '余量为 0 的活动被标出来，串起来就是关键路径 —— 它决定总工期。', param: '做什么' },
      { act: '把关键路径上某条边的工期改大', watch: '总工期跟着变长。改非关键的边则多半什么也不变。' },
    ],
    terms: ['topo', 'aoe', 'critical'],
  },
  partition: {
    question: '同一串内存请求，四种放置策略会分到哪儿？谁更碎？',
    step: (s: never, doc) => {
      const st = s as { act: 'alloc' | 'free' | 'fail'; job: string; size: number
                        at: number; scanned: number[]; merged: number
                        external: number; freeTotal: number
                        blocks: { start: number; size: number; job?: string | null }[] }
      const algo = String(doc.params.algorithm)
      const total = Number(doc.params.memorySize)
      const RULE: Record<string, string> = {
        首次适应: '**首次适应**：从低地址往上找**第一个**够大的空闲分区。低地址会被切得很碎，但找得快。',
        最佳适应: '**最佳适应**：找**最小的够大**的那块。听着省，其实最容易留下一堆用不上的小碎片。',
        最坏适应: '**最坏适应**：找**最大**的那块切。剩下的那截还比较大，还能再用。',
        邻近适应: '**邻近适应**：从上次停的地方接着往下找，不每次都从头扫。',
      }
      return [
        { k: '本步输入',
          v: st.act === 'free'
            //  ⚠️ free 帧里 `size` 是 0（内核只在分配时填），别拿它当"归还了多少"
            ? `作业 **${st.job}** 释放它占的那块；内存共 ${total}K`
            : `作业 **${st.job}** 请求 **${st.size}K**；当前空闲共 ${st.freeTotal}K，分成 ${st.blocks.filter(b => !b.job).length} 块` },
        { k: '判定规则',
          v: st.act === 'free'
            ? `回收时要看**相邻的空闲块**：上邻、下邻、或者两头都空，都要合并成一块 —— 不合并的话空闲区会越切越碎。`
            : RULE[algo] ?? `按 ${algo} 挑一块空闲分区。` },
        { k: '本步结果',
          v: st.act === 'alloc'
            ? `扫过 ${st.scanned.length} 块，选中起始地址 **${st.at}K** 那一块切给 ${st.job}。`
              + `切剩的部分留作空闲。当前**外碎片** ${st.external}K —— `
              + `指小于 8K、已经小到分不出去的那些空闲块；它们加起来可能够用，但**连不成一块**。`
            : st.act === 'free'
              ? `${st.job} 占的那块变回空闲`
                + (st.merged > 0 ? `，并跟相邻的 ${st.merged} 块合并成一块。` : '，两边都不空，没有可合并的。')
                + ` 空闲总量 ${st.freeTotal}K。`
              : `扫遍了所有空闲块，**没有一块装得下 ${st.size}K** —— 分配失败。`
                + `注意空闲总量还有 ${st.freeTotal}K，装不下是因为它们**连不成一块**，这就是外碎片。` },
      ]
    },
    read: [
      { at: '内存条', is: '横着一整条内存，深色是已分配、浅色是空闲。', anchor: '.membar' },
      { at: '分区表', is: '每块的起址、大小、归谁。', anchor: '.tabs' },
    ],
    try: [
      { act: '装上「四策略全分开」预置，在四种策略之间切', watch: '这串请求被特意挑过：作业 7 在四种策略下落在四个不同的起址。', param: '放置策略', preset: '四策略全分开' },
      { act: '多跑几个请求', watch: '最佳适应会留下一堆很小的空闲块 —— 加起来够用但连不成一片，这就是外碎片。' },
    ],
    terms: ['fragment', 'fitpolicy'],
  },
  inode: {
    question: '读文件某个字节，要先访问几次磁盘？',
    step: (s: never, doc) => {
      const st = s as { lbn: number; level: 'direct' | 'single' | 'double' | 'triple' | 'oob'
                        path: string[]; reads: number
                        ranges: { name: string; from: number; to: number; count: number }[] }
      const bs = Number(doc.params.blockSizeBytes)
      const ps = Number(doc.params.pointerSizeBytes)
      const direct = Number(doc.params.directCount)
      const perBlock = Math.floor(bs / ps)
      const LEVEL: Record<string, string> = {
        direct: '**直接地址**：inode 里就存着这一块的地址，拿来就用。',
        single: '**一级间址**：inode 里那个指针指向一个**索引块**，索引块里才是数据块的地址。',
        double: '**二级间址**：要先读一级索引块，再读二级索引块，才拿到数据块地址。',
        triple: '**三级间址**：三层索引块一层层读下来。',
        oob: '**越界**：这个逻辑块号超出了这套索引结构能表示的最大范围。',
      }
      const r = st.ranges.find(x => x.name.includes(st.level === 'direct' ? '直接' : st.level === 'single' ? '一级' : st.level === 'double' ? '二级' : '三级'))
      return [
        { k: '本步输入', v: `要访问第 **${st.lbn}** 号逻辑块；盘块 ${bs}B、指针 ${ps}B，一个索引块能装 ${perBlock} 个指针` },
        { k: '判定规则',
          v: `inode 里前 ${direct} 个是直接地址，往后依次是一级、二级、三级间址。`
            + `**先按范围判断这一块落在哪一档**，再决定要多绕几层索引 —— ${LEVEL[st.level] ?? ''}` },
        { k: '本步结果',
          v: st.level === 'oob'
            ? `第 ${st.lbn} 号块超出这套结构能表示的范围，取不到。`
            : `落在**${r?.name ?? st.level}**档（${r ? `${r.from}~${r.to}` : ''}）。`
              + `寻址路径：${st.path.join(' → ')}。`
              + `一共要读 **${st.reads}** 次盘：${st.reads - 1} 次索引块 + 1 次数据块 —— `
              + `小文件一次就到，大文件要多绕几层，这就是混合索引的代价。` },
      ]
    },
    read: [
      { at: '寻址链', is: '从逻辑块号开始，判断落在直接、一级间址还是二级间址，一层层往下。', anchor: '.inchain' },
      { at: '分级结构页签', is: '每一级能覆盖多少块 —— 决定了分界点在哪儿。', anchor: '.tabs' },
    ],
    try: [
      { act: '把块大小从 1024 改成 4096', watch: '一个间址块能装的指针数翻两番，直接地址覆盖不到的分界点整个往后挪。', param: '块大小' },
      { act: '把指针大小从 4 改成 8', watch: '每块能装的指针减半，各级容量跟着减 —— 64 位系统的代价。', param: '指针大小' },
    ],
    terms: ['inode'],
  },
  bplus: {
    question: '往 B+ 树里插入，什么时候分裂？提上去的是哪个键？',
    step: (s: never, doc) => {
      const st = s as { key: number; act: 'descend' | 'insert' | 'split' | 'grow' | 'done'
                        upKey: number; splitLeaf: boolean; height: number; splits: number
                        nodes: { keys: number[] }[]; focus: number[] }
      const m = Number(doc.params.order)
      return [
        { k: '本步输入',
          v: `正在插入 **${st.key}**；${m} 阶 B+ 树，当前高度 ${st.height}`
            + (st.focus.length ? `，看的是第 ${st.focus.join('、')} 号结点` : '') },
        { k: '判定规则',
          v: `${m} 阶 B+ 树每个结点最多 ${m - 1} 个键。**所有真数据都在叶子层**，`
            + `内部结点只当路标；叶子之间还串成链表，所以范围查询能顺着链走。`
            + `插满了就**分裂**：从中间劈开，把中间那个键提到父结点`
            + `（叶子分裂时那个键**留一份在右叶子**，内部结点分裂才是真提上去）。` },
        { k: '本步结果',
          v: st.act === 'split'
            ? `结点装不下了，**分裂**${st.splitLeaf ? '（叶子）' : '（内部结点）'}，键 **${st.upKey}** 提到父结点。累计分裂 ${st.splits} 次。`
            : st.act === 'grow'
              ? `根也分裂了，**树长高一层** —— 现在高度 ${st.height}。B+ 树只在根分裂时长高，所以永远是平衡的。`
              : st.act === 'insert'
                ? `${st.key} 放进叶子，没有超出 ${m - 1} 个键的上限，不用分裂。`
                : st.act === 'done'
                  ? `插完了：高度 ${st.height}，一共分裂 ${st.splits} 次。`
                  : `顺着路标往下找 ${st.key} 该去的那片叶子。` },
      ]
    },
    read: [
      { at: '树形', is: '内部结点只当路标，**真正的键全在叶子层**，叶子之间还串成链。', anchor: '.bpt' },
      { at: '标红的结点', is: '这一步装满了、正在分裂。', anchor: '.bpt' },
    ],
    try: [
      { act: '把阶从 3 调到 5', watch: '每个结点能装的键变多，分裂次数下降，树变矮 —— B+ 树就是靠"矮"来省磁盘访问。', param: '阶' },
      { act: '插一串递增的键', watch: '一路往最右边分裂，树高一层一层长上去。' },
    ],
    terms: ['border'],
  },
  traverse: {
    question: 'DFS 和 BFS 的访问顺序为什么不同？辅助结构装着什么？',
    step: (s: never, doc) => {
      const st = s as { order: string[]; pending: string[]; at: string
                        act: 'visit' | 'push' | 'skip' | 'done'; treeEdges: string[] }
      const algo = String(doc.params.algorithm)
      const dfs = algo.toUpperCase().includes('DFS')
      const start = String(doc.params.start)
      return [
        { k: '本步输入',
          /*  ⚠️ `order` 已经含了**本步**访问的那个点。照它写"已访问 N 个（… A）"，
              下一行又说"访问 A"—— 同一个点被数了两遍。访问帧要减掉自己。 */
          v: `已访问 ${Math.max(0, st.order.length - (st.act === 'visit' ? 1 : 0))} 个点`
            + (st.order.length > 1 || st.act !== 'visit'
                ? `（${st.order.slice(0, st.order.length - (st.act === 'visit' ? 1 : 0)).join(' ') || '还没有'}）` : '（还没有）')
            + `；`
            + `${dfs ? '栈' : '队列'}里还有 ${st.pending.length} 个${st.pending.length ? `（${st.pending.join(' ')}）` : ''}` },
        { k: '判定规则',
          v: dfs
            ? `**深度优先**：一条路走到黑，走不动了回退换一条 —— 用**栈**（递归就是隐式的栈）。`
              + `图不连通时，一趟走完还有没访问到的点，就从新的起点再来一趟。`
            : `**广度优先**：一圈一圈往外铺，先访问所有邻居再往深走 —— 用**队列**。`
              + `无权图上它顺带给出从 ${start} 出发的最短边数。` },
        { k: '本步结果',
          v: st.act === 'visit'
            ? `访问 **${st.at}**，记进访问序列（第 ${st.order.length} 个）。`
            : st.act === 'push'
              ? `把 ${st.at} 的未访问邻居放进${dfs ? '栈' : '队列'}，现在里面有 ${st.pending.length} 个。`
              : st.act === 'skip'
                ? `${st.at} 已经访问过，跳过 —— 不跳的话有环的图会绕不出来。`
                : `走完了：访问序列 ${st.order.join(' ')}，生成树用了 ${st.treeEdges.length} 条边。` },
      ]
    },
    read: [
      { at: '图', is: '已访问的结点变色，加粗的边是生成树。', anchor: '.gvwrap' },
      { at: '栈 / 队列页签', is: '当前辅助结构里排着谁 —— DFS 用栈、BFS 用队列，差别全在这儿。', anchor: '.tabs' },
    ],
    try: [
      { act: '在 DFS 和 BFS 之间切', watch: '同一个图、同一个起点，访问顺序完全不同；生成树的形状也不同。' },
      { act: '注意孤立的那个顶点', watch: '一趟走不完时要从新的起点重来 —— 图不连通时两种遍历都要处理这件事。' },
    ],
    terms: ['dfsbfs'],
  },
  semaphore: {
    question: 'P 操作的顺序写反了，到底会怎么死？',
    step: (s: never, doc) => {
      const st = s as { i: number; empty: number; full: number; mutex: number; buffer: number[]
                        pc: Record<string, number>; blocked: Record<string, string>
                        who: string; act: 'P' | 'V' | 'work' | 'block' | 'wake' | 'deadlock' | 'done'
                        sem: string; produced: number; consumed: number }
      const SEM: Record<string, string> = { empty: 'empty（空位）', full: 'full（产品）', mutex: 'mutex（锁）' }
      const semName = SEM[st.sem] ?? st.sem
      const wrong = doc.params.order === 'wrong'
      /*  ⚠️ 初始态的 `act` 也是 `'done'`（见内核的 `initial()`），
          光看 act 会把第一步讲成"调度序列走完了"。
          `initial()` 里那个 `i: -1` 也认不得 —— 它根本不进轨迹：
          `step()` 返回的是 `{ i, ...frames[i] }`，第一帧的 `i` 就是 0。
          「`pc` 为空」同样不行，各线程的程序计数器在第一帧之前就置好了。
          **认轨迹下标**：第 0 帧是内核 put 的那句「初始：empty = …」。 */
      const start = st.i === 0
      const rule = start
        ? '三个信号量各司其职：**empty 记录空位数、full 记录产品数、mutex 保证同一时刻只有一个线程访问缓冲区**。'
          + '以下每一步表示某个线程尝试执行其代码中的下一条语句。'
        : st.act === 'P'
          ? `P(${st.sem}) 看 ${semName}：**大于 0 就减 1 放行，已经是 0 就地挂起**。`
            + '（本仿真不允许信号量取负值；教材中"先减再判负"的写法里，'
            + '负值的绝对值即等待队列长度，两种写法行为等价。）'
          : st.act === 'V'
            ? `V(${st.sem}) 把 ${semName} 加 1，然后**看有没有人正排在它上面**，有就放行队首那个 ——`
              + '被唤醒者直接获得资源，无需重新竞争。'
            : st.act === 'block'
              ? `${semName} 已经是 0，${st.who} 拿不到，就地挂起。`
                + '**而它已持有的资源不会释放**，这正是死锁的成因所在。'
              : st.act === 'wake'
                ? '其他线程对该信号量执行了 V 操作，等待队列的队首线程被唤醒。'
                : st.act === 'deadlock'
                  ? '全部线程均已挂起，而**能够唤醒它们的 V 操作只能由这些线程自身执行**，系统无法继续推进。'
                  : st.act === 'work'
                    ? '进入临界区。读写缓冲区的语句仅此一条，必须置于 mutex 的 P/V 之间。'
                    : '调度序列执行完毕。'
      const input = start
        ? '一个生产者与一个消费者，共用一个缓冲区'
        : st.act === 'deadlock' ? '没有线程能往下走了'
          : st.act === 'done' ? '调度序列走完'
            : st.act === 'block' ? `**${st.who}** 卡在了 P(${st.sem}) 上`
              : st.act === 'wake' ? `**${st.who}** 被唤醒`
                : st.act === 'work' ? `轮到 **${st.who}**，它要动缓冲区了`
                  : `轮到 **${st.who}**，它要执行 **${st.act}(${st.sem})**`
      return [
        { k: '本步输入', v: input },
        { k: '判定规则', v: rule },
        { k: '本步结果',
          v: `empty ${st.empty} · full ${st.full} · mutex ${st.mutex}，`
            + `缓冲区里 ${st.buffer.length} 个，生产 ${st.produced} / 消费 ${st.consumed}。`
            + (Object.keys(st.blocked).length
              ? `**卡住的：${Object.entries(st.blocked).map(([k, v]) => `${k} 等 ${v}`).join('，')}**`
              : '没有人被卡住。') },
        { k: '对应画面',
          v: `右边三个信号量的数字；「两段代码」那一页里${st.who ? ` ${st.who} ` : '各线程'}的箭头停在第几行`
            + `${wrong ? '（现在是**错误顺序**：P(mutex) 排在最前面）' : ''}。` },
      ]
    },
    read: [
      { at: '缓冲区', is: '几个格子，生产者往里放、消费者往外取。', anchor: '.sbuf' },
      { at: '两段代码页签', is: '生产者和消费者的代码，高亮的是当前执行到的那一行。', anchor: '.tabs' },
      { at: '线程状态', is: '谁在跑、谁被阻塞在哪个信号量上。', anchor: '.thrs' },
    ],
    try: [
      { act: '把 P 的顺序切成 wrong', watch: '先 P(mutex) 再 P(empty) —— 抱着锁去睡觉，另一个也进不来，**真的死给你看**。', param: 'P 的顺序' },
      { act: '把缓冲区大小调成 1', watch: '生产一个就必须被消费一个，两个线程严格交替。', param: '缓冲区大小' },
    ],
    terms: ['semaphore', 'pvorder'],
  },
  bitmap: {
    question: '位示图里第几个字第几位，对应哪个盘块？',
    step: (s: never, doc) => {
      const st = s as { act: 'alloc' | 'free' | 'fail'; blocks: number[]
                        word: number; bit: number; freeCount: number
                        bits: number[][] }
      const wb = Number(doc.params.wordBits)
      const words = Number(doc.params.words)
      return [
        { k: '本步输入',
          v: st.act === 'free'
            ? `回收 ${st.blocks.length} 个盘块${st.blocks.length ? `（${st.blocks.join('、')}）` : ''}；位示图 ${words} 字 × ${wb} 位`
            /*  ⚠️ `freeCount` 是内核在**改完位图之后**统计的，不是分配前的余量。
                写成"当前空闲 N 个"再在结果里写"剩余 N 个"，同一个数出现两次，
                读者会以为这次分配没生效。 */
            : `申请 ${st.blocks.length} 个盘块；位示图 ${words} 字 × ${wb} 位` },
        { k: '判定规则',
          v: `位示图里**一位对应一个盘块**：0 空闲、1 已用。分配就是找 0 并置 1，回收就是置 0。`
            + `考点全在换算：位号 (字号 ${st.word}, 位号 ${st.bit}) 与盘块号之间是`
            + ` **盘块号 = 字号 × ${wb} + 位号**（若盘块从 1 开始编号，还要再加 1）。` },
        { k: '本步结果',
          v: st.act === 'alloc'
            ? `分到盘块 ${st.blocks.join('、')}，对应位示图第 ${st.word} 字第 ${st.bit} 位起，`
              + `这些位置 1。剩余空闲 ${st.freeCount} 个。`
            : st.act === 'free'
              ? `盘块 ${st.blocks.join('、')} 对应的位清 0，空闲数回到 ${st.freeCount} 个。`
              : `空闲块不够 —— 分配失败，位示图不变（仍有 ${st.freeCount} 个空闲，但凑不够这次要的连续块）。` },
      ]
    },
    read: [
      { at: '位阵', is: '每一行是一个字，每一格是一位。0 空闲、1 已用。', anchor: '.bmgrid' },
      { at: '换算公式页签', is: '盘块号 ↔ (字号, 位号) 的两个方向，以及为什么是这么算的。', anchor: '.tabs' },
    ],
    try: [
      { act: '把字长从 8 改成 32', watch: '同样的盘块号落到完全不同的 (字号, 位号) —— 考试就爱在这儿设坑。', param: '字长' },
      { act: '分配几块再回收一块', watch: '回收就是把那一位置 0，下次分配会把它再找出来。' },
    ],
    terms: ['bitmap'],
  },
  csma: {
    question: '两台机器同时发，冲突之后各自等多久？',
    step: (s: never, doc) => {
      const st = s as { slot: number; sending: string[]; collision: boolean
                        attempts: Record<string, number>; backoff: Record<string, number>
                        picked: Record<string, string>; done: string[]; aborted: string[] }
      const waiting = Object.entries(st.backoff).filter(([, n]) => n > 0)
      const picks = Object.entries(st.picked).map(([k, v]) => `${k} 取 ${v}`).join('，')
      const rule = st.collision
        ? '两个及以上的站在同一争用期发送，发生**冲突**。各站随即停止发送，'
          + '在 0~2^k−1 中各取一个整数 r，退避 r 个争用期后重发（二进制指数退避：冲突次数越多，取值范围越大）。'
        : st.sending.length === 1
          ? '本争用期内仅一个站发送，无竞争，该站发送成功。'
          : st.aborted.length
            ? `有站撞到了重传上限（${doc.params.maxAttempts} 次）就**放弃**这一帧，交给上层去处理。`
            : '待发送的各站均处于退避计时中，信道空闲。'
      return [
        { k: '本步输入',
          v: `第 **${st.slot}** 个争用期，`
            + (st.sending.length ? `**${st.sending.join('、')}** 要发` : '没有站要发') },
        { k: '判定规则', v: rule },
        { k: '本步结果',
          v: (st.collision ? `冲突次数变成 ${Object.entries(st.attempts).map(([k, v]) => `${k}:${v}`).join(' ')}${picks ? `，${picks}` : ''}。` : '')
            + (waiting.length ? `还在退避：${waiting.map(([k, n]) => `${k} 还要等 ${n}`).join('，')}。` : '')
            + (st.done.length ? `已成功 ${st.done.join('、')}。` : '')
            + (st.aborted.length ? `**已放弃 ${st.aborted.join('、')}**。` : '')
            || '这一拍线上没有变化。' },
        { k: '对应画面', v: `时隙图第 ${st.slot} 列 —— 撞了那一列画成红的；退避取的 r 在「退避表」那一页。` },
      ]
    },
    read: [
      { at: '时间轴', is: '每一行是一个站点，红色格是冲突发生的时刻。', anchor: '.csma' },
      { at: '退避表', is: '第几次冲突、退避区间是多少、随机挑中了几。', anchor: '.ptab' },
    ],
    try: [
      { act: '看退避区间怎么变', watch: '第 k 次冲突从 0..2^k−1 里挑 —— 区间随冲突次数指数变宽，这就是"二进制指数退避"。' },
      { act: '让冲突一直发生', watch: '到 16 次就放弃并报错给上层，不会无限重试。' },
    ],
    terms: ['csma', 'backoff'],
  },
  rip: {
    question: '路由器只跟邻居聊天，怎么就都算出了全网最短路？断了一条链又会怎样？',
    step: (s: never) => {
      const st = s as {
        act: string; round: number; changed: string[]; broken: string
        routers: string[]; dist: Record<string, Record<string, number>>
      }
      const infs = st.routers?.reduce((n, x) => n + st.routers.filter(y => x !== y && (st.dist[x]?.[y] ?? 0) >= 16).length, 0) ?? 0
      return [
        { k: '本步输入',
          v: st.act === 'init'
            ? `每台路由器只知道到直连邻居的代价，其余目的地都是"无穷"（16）`
            : st.act === 'break'
              ? `链路 ${st.broken?.[0]}—${st.broken?.[1]} 刚断，断点两端把这条直连代价设为无穷`
              : `第 ${st.round} 轮，各路由器收到邻居广播来的距离表` },
        { k: '判定规则',
          v: st.act === 'break' || st.act === 'capped'
            ? `**没有水平分割时**，邻居会把"经过你才到得了"的旧路由又广播回来，`
              + `你信了它、加上一跳再传出去 —— 代价就这样一格格虚长，这就是**无穷计数**。`
            : `**距离矢量更新**：到某目的地的代价 = min（到每个邻居的代价 + 邻居声称到目的地的代价）。`
              + `只跟直连邻居交换整张表，一轮一轮把最短路扩散到全网。` },
        { k: '本步结果',
          v: st.act === 'init'
            ? `初始表建好，开始逐轮交换。`
            : st.act === 'converged'
              ? `没有任何表项再变 —— ${infs > 0 ? `收敛，${infs} 个真正不可达的表项停在无穷` : '全网收敛，每台都掌握了到所有目的地的最短代价'}。`
              : st.act === 'break'
                ? `坏消息还没扩散，别的路由器仍以为到得了断点 —— 下面几轮会看到代价往上爬。`
                : `本轮 ${st.changed?.length ?? 0} 个表项更新`
                  + (st.act === 'capped' ? `，通往断点的代价正一格格逼近无穷 16。` : `，最短路又向外扩散了一圈。`) },
      ]
    },
    verdict: (s: never) => {
      const st = s as { act: string; round: number; broken: string; changed: string[] }
      if (st.act === 'converged') return st.broken ? `断链后收敛 · 不可达处停在无穷` : `全网收敛 · 第 ${st.round} 轮`
      if (st.act === 'capped') return `无穷计数中 · 第 ${st.round} 轮`
      if (st.act === 'break') return `链路 ${st.broken?.[0]}—${st.broken?.[1]} 断开`
      return `第 ${st.round} 轮 · ${st.changed?.length ?? 0} 项更新`
    },
    read: [
      { at: '距离矢量矩阵', is: '行是路由器、列是目的地；本轮变的格子高亮，∞ 是不可达。', anchor: '.ripmat' },
      { at: '网络图页签', is: '拓扑长什么样、断了哪条链一眼可见。', anchor: '.tabs' },
    ],
    try: [
      { act: '从「收敛」切到「断链」', watch: '收敛后断掉一条链，看通往断点的代价一格格往上爬到 16 —— 无穷计数。', param: '场景' },
      { act: '换成「带环网络」拓扑', watch: '有备用路径时，断链后很快收敛到新路，不会数到无穷。', preset: '带环网络' },
    ],
    terms: ['distvec', 'counttoinf'],
  },
  radix: {
    question: '多个请求共享前缀，KV 缓存怎么复用、能省下多少 prefill？',
    step: (s: never) => {
      const st = s as {
        act: string; req: number; pos: number; reqTokens: string[]
        hit: number; compute: number; cached: number; budget: number
        savedTotal: number; seenTotal: number
      }
      const tk = st.pos >= 0 ? st.reqTokens?.[st.pos] : ''
      const pctSaved = st.seenTotal ? Math.round((st.savedTotal / st.seenTotal) * 100) : 0
      return [
        { k: '本步输入',
          v: st.act === 'done'
            ? `全部请求处理完，累计 ${st.seenTotal} 个 token`
            : st.act === 'evict'
              ? `缓存已满（${st.budget} token），要腾地方`
              : st.act === 'reqdone'
                ? `请求 ${st.req} 处理完`
                : `请求 ${st.req} 的第 ${st.pos + 1} 个 token「${tk}」，去前缀树上找` },
        { k: '判定规则',
          v: st.act === 'evict'
            ? `**LRU 淘汰**：缓存的 token 总数超预算，挑最久没被命中的**叶子**回收 —— 从叶子往上，不动还在被复用的前缀。`
            : `**能匹配前缀树上已有路径 → 命中**：这段 KV 已经算过，直接复用、跳过 prefill；`
              + `**走到树上没有的 token → 未命中**：计算它的 KV 并把结点挂上去。之后的 token 都算新的。` },
        { k: '本步结果',
          v: st.act === 'match'
            ? `「${tk}」命中，KV 复用 —— 本请求已命中 ${st.hit} 个。`
            : st.act === 'compute'
              ? `「${tk}」未命中，算了它的 KV 挂进树。`
              : st.act === 'evict'
                ? `淘汰一个叶子，缓存降到 ${st.cached} / ${st.budget}。`
                : st.act === 'reqdone'
                  ? `请求 ${st.req}：命中 ${st.hit}、计算 ${st.compute} —— 省下 ${st.hit} 个 token 的 prefill。`
                  : `累计省下 ${st.savedTotal} / ${st.seenTotal} 个 token 的 prefill（**${pctSaved}%**）。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { act: string; hit: number; compute: number; savedTotal: number; seenTotal: number }
      if (st.act === 'done') {
        const p = st.seenTotal ? Math.round((st.savedTotal / st.seenTotal) * 100) : 0
        return `共省下 ${st.savedTotal}/${st.seenTotal} 的 prefill（${p}%）`
      }
      if (st.act === 'match') return `命中 · 复用 KV`
      if (st.act === 'compute') return `未命中 · 计算 KV`
      if (st.act === 'evict') return `LRU 淘汰`
      return `请求处理中`
    },
    read: [
      { at: '前缀树', is: '一条路径 = 一段缓存的前缀；当前 token 高亮，绿色是某请求的终点。', anchor: '.rxgraph' },
      { at: '请求 token 带', is: '绿色是命中（复用 KV）、蓝色是未命中（要计算）。', anchor: '.rxtoks' },
      { at: '省下 prefill 条', is: '命中的 token 占比 —— 共享前缀越多，这条越长。', anchor: '.rxsave' },
    ],
    try: [
      { act: '在「共享 system 前缀」和「各不相同」之间切', watch: '共享前缀的请求集能省下近一半 prefill；毫无共享的省 0 —— 前缀复用的价值全看请求像不像。', param: '请求集' },
      { act: '把缓存预算调到 4', watch: '缓存装不下所有前缀，开始 LRU 淘汰叶子；下一个请求想复用被淘汰的前缀就得重算。', param: '缓存预算' },
    ],
    terms: ['prefixcache', 'prefill'],
  },
  paged: {
    question: 'KV 缓存为什么要分页？物理块不连续，怎么还能对得上？',
    step: (s: never) => {
      const st = s as {
        act: string; req: string; focus: number; freeCount: number
        totalBlocks: number; blockSize: number; tables: Record<string, number[]>
      }
      const aTable = st.tables?.A ?? []
      return [
        { k: '本步输入',
          v: st.act === 'done'
            ? `处理完毕，${st.totalBlocks - st.freeCount} / ${st.totalBlocks} 块在用`
            : st.act === 'free'
              ? `请求 ${st.req} 结束了`
              : `请求 ${st.req} 又生成了一批 token，要放 KV` },
        { k: '判定规则',
          v: st.act === 'free'
            ? `请求结束 → 它的物理块**全部归还空闲池**，别的请求立刻能拿去用（像进程退出释放页框）。`
            : `KV 切成每块 ${st.blockSize} 个 token 的**固定块**。装满当前块就从**空闲池拿一块新的** —— `
              + `**拿到哪块都行，不要求连续**。每个请求一张**块表**记「逻辑块→物理块」，就是页表。` },
        { k: '本步结果',
          v: st.act === 'alloc'
            ? `分配了物理块 ${st.focus}（请求 ${st.req} 的一个逻辑块）—— 物理上可能和上一块隔开，块表照样对上。`
            : st.act === 'append'
              ? `填进已有的块，没占新块。`
              : st.act === 'free'
                ? `归还完毕，空闲块回到 ${st.freeCount} 个。`
                : `A 的块表是 [${aTable.join(' ')}] —— 非连续也毫无问题，这就是分页消灭外碎片的方式。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { act: string; req: string; focus: number; freeCount: number; totalBlocks: number }
      if (st.act === 'done') return `${st.totalBlocks - st.freeCount}/${st.totalBlocks} 块在用 · 零外碎片`
      if (st.act === 'alloc') return `分配物理块 ${st.focus}`
      if (st.act === 'free') return `归还 · 空闲 ${st.freeCount}`
      return `请求 ${st.req} 填入`
    },
    read: [
      { at: '物理块池', is: '每块按属主上色；当前分配的块高亮，灰色是空闲。', anchor: '.pgpool' },
      { at: '块表', is: '每个请求一行：逻辑块号 → 物理块号。物理块跳着走完全正常。', anchor: '.pgtmap' },
    ],
    try: [
      { act: '看请求 A 的块表', watch: '交错生成让 A 拿到物理块 0、2、4 —— 不连续，但块表把它们串成 A 的逻辑序列，一点不乱。', param: '场景' },
      { act: '切到「释放后复用」', watch: '前一个请求结束、块归还后，新请求直接捡起这些块 —— 没有连续分配那种"总量够却拼不出一整块"的外碎片。', param: '场景' },
    ],
    terms: ['paging', 'blocktable', 'fragment'],
  },
  forward: {
    question: '前面学的嵌入、注意力、FFN、归一化、采样，合起来一次推理到底怎么流动？',
    step: (s: never) => {
      const st = s as { phase: string; stageIdx: number; stageName: string; stageLink: string; vec: number[]; attn: number[] | null; predicted: string | null; seq: string[]; probs: number[] | null; detail: string }
      return [
        { k: '本步输入',
          v: st.phase === 'done' ? `序列「${st.seq.join('')}」走完整条前向` : `${st.stageName}` },
        { k: '判定规则',
          v: st.stageLink && st.stageLink !== '—'
            ? `这一段就是**${st.stageLink}**那个实验做的事，用真实向量跑一遍。${st.detail}`
            : `${st.detail || '把上一段的输出接着往下算。'}` },
        { k: '本步结果',
          v: st.phase === 'done'
            ? `预测下一个 token「**${st.predicted}**」。这条 embed→注意力→FFN→norm→采样 的链，就是每步 decode 真正跑的东西 —— 之前所有优化都在加速它。`
            : st.attn ? `注意力权重 [${st.attn.join('、')}]，末向量 [${st.vec.join('、')}]。`
              : st.predicted ? `softmax 后贪心取最大 → 预测「${st.predicted}」。`
                : `末向量 [${st.vec.join('、')}]，进入下一段。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; stageIdx: number; predicted: string | null; stageName: string }
      return st.phase === 'done' ? `一次前向 → 预测「${st.predicted}」`
        : `第 ${st.stageIdx + 1}/10 段 · ${st.stageName.replace(/^[①-⑩]\s*/, '')}`
    },
    read: [
      { at: '顶部序列→预测', is: '输入序列在左，走完流水后右边出现预测的下一个 token。', anchor: '.fwhdr' },
      { at: '流水段带', is: '10 段流水，当前段高亮、已过的变绿。', anchor: '.fwflow' },
      { at: '当前段详情', is: '本段的真实向量；注意力段有权重、末尾有词表概率。', anchor: '.fwdetail' },
    ],
    try: [
      { act: '一步步点"下一步"走完 10 段', watch: '向量在每段被改写：归一化拉尺度、注意力融入上下文、FFN 变换、残差叠加，最后变成 logits。' },
      { act: '走到最后看词表概率', watch: 'logits 过 softmax 成概率，最高的那个词被选中 —— 这就是模型"吐"出下一个字的瞬间。' },
    ],
    terms: ['fwpass', 'softmaxdef', 'contbatch'],
  },
  rmsnorm: {
    question: 'Transformer 每层前都要归一化，RMSNorm 到底做了什么，为什么比 LayerNorm 更受欢迎？',
    step: (s: never) => {
      const st = s as { phase: string; x: number[]; meanSq: number; rms: number; cursor: number; gain: number[]; out: (number|null)[]; outRms: number }
      return [
        { k: '本步输入',
          v: st.phase === 'square' ? `向量 x = [${st.x.join(', ')}]`
            : st.phase === 'rms' ? `均方 = ${st.meanSq}`
              : st.phase === 'done' ? '归一化完成' : `第 ${st.cursor} 维 x=${st.x[st.cursor]}` },
        { k: '判定规则',
          v: `RMSNorm：**RMS = √(各维平方的平均)**，再把每维 **x̂ = x/RMS·g**。关键是**不减均值**（LayerNorm 要减）—— 少一步、少一组偏置，更省。` },
        { k: '本步结果',
          v: st.phase === 'square' ? `各维平方求平均得均方 ${st.meanSq}，下一步开方。`
            : st.phase === 'rms' ? `RMS = √${st.meanSq} = **${st.rms}**，用它把向量缩到单位尺度。`
              : st.phase === 'done' ? `归一化后（未乘增益）向量 RMS = **${st.outRms}**（正好为 1）。增益 g 再逐维缩放。`
                : `x̂ = ${st.x[st.cursor]} ÷ ${st.rms} × g(${st.gain[st.cursor]}) = **${st.out[st.cursor]}**。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; rms: number; outRms: number; cursor: number }
      return st.phase === 'done' ? `归一化后 RMS = ${st.outRms}（单位尺度）`
        : st.phase === 'rms' || st.phase === 'square' ? `RMS = ${st.rms || '?'}` : `第 ${st.cursor} 维`
    },
    read: [
      { at: '输入 / 平方', is: 'x 与各维平方，平方求平均就是均方。', anchor: '.rncell.sq' },
      { at: 'RMS 一行', is: '均方开方得 RMS —— 归一化的除数。', anchor: '.rnrms' },
      { at: '归一化输出', is: 'x/RMS·g，逐维长出；下面是增益 g。', anchor: '.rncell.out' },
      { at: '校验行', is: '归一化后向量 RMS=1，证明尺度被拉齐了。', anchor: '.rncheck' },
    ],
    try: [
      { act: '把增益 g 改成"放大末维"', watch: '前几维不变，最后一维输出翻倍 —— 增益是每维一个的可学习缩放。', param: '可学习增益 g' },
      { act: '盯住校验行', watch: '不管输入什么，归一化后（未乘增益）的 RMS 永远是 1 —— 这就是"归一化"的含义。', param: '可学习增益 g' },
    ],
    terms: ['rmsdef'],
  },
  rope: {
    question: '注意力对词序无感，RoPE 怎么用"旋转"把位置塞进去，还能泛化到更长文本？',
    step: (s: never) => {
      const st = s as { phase: string; pos: number; thetaDeg: number; angleDeg: number; x: number; y: number; norm: number; dotWith0: number }
      return [
        { k: '本步输入',
          v: st.phase === 'done' ? '所有位置旋转完' : `位置 ${st.pos}` },
        { k: '判定规则',
          v: `把一对维度当成 2D 向量，按 **位置 × θ = ${st.angleDeg}°** 旋转它。旋转是正交变换：**只改方向、不改模长**。位置越靠后，转得越多。` },
        { k: '本步结果',
          v: st.phase === 'done'
            ? `模长始终 **${st.norm.toFixed(3)}**（旋转保范，不像"加"位置会改大小）。位置 m 与 n 的点积只依赖 (m−n)·θ —— 只看相对位置，所以能泛化到更长上下文。`
            : `向量到 (${st.x.toFixed(3)}, ${st.y.toFixed(3)})，模长 **${st.norm.toFixed(3)}**。与位置0点积 = cos(${st.pos}·${st.thetaDeg}°) = **${st.dotWith0.toFixed(3)}**。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; norm: number; angleDeg: number; dotWith0: number; pos: number }
      return st.phase === 'done' ? `模长恒 ${st.norm.toFixed(2)} · 点积只看相对位置`
        : `位置 ${st.pos} · 转到 ${st.angleDeg}° · 点积 ${st.dotWith0.toFixed(2)}`
    },
    read: [
      { at: '单位圆', is: '琥珀是当前向量，虚线是位置0参考；圆点是走过的位置轨迹。', anchor: '.ropesvg' },
      { at: '模长 |v|', is: '不管转到哪，模长永远是 1 —— 旋转保范。', anchor: '.ropest.ok' },
      { at: '与位置0点积', is: 'cos(p·θ)，随相对位置差变化，绝对位置无关。', anchor: '.ropestats' },
    ],
    try: [
      { act: '把 θ 从 30° 加到 60°', watch: '每个位置转得更多、向量绕圈更快 —— θ 就是这对维度的旋转频率。', param: '每位旋转角 θ' },
      { act: '盯住模长这一行', watch: '走遍所有位置，模长始终是 1.000 —— 这是旋转（正交变换）的性质，加法位置编码做不到。', param: '每位旋转角 θ' },
    ],
    terms: ['ropepos'],
  },
  moe: {
    question: '听说 MoE 模型总参数几百 B，为什么推理起来反而比稠密模型省算力？',
    step: (s: never) => {
      const st = s as { phase: string; experts: number; topk: number; tokens: string[]; cursor: number; chosen: number[]; chosenGates: number[]; load: number[]; activeFrac: number }
      return [
        { k: '本步输入',
          v: st.phase === 'done' ? `${st.tokens.length} 个 token 全部路由完` : `token「${st.tokens[st.cursor]}」的 router 打分` },
        { k: '判定规则',
          v: `门控 = softmax(router 分数)，取门控最高的 **top-${st.topk}** 个专家，在这 ${st.topk} 个内重新归一化 → 输出 = Σ 门控·专家。只算选中的 ${st.topk}/${st.experts} 个，其余**跳过**。` },
        { k: '本步结果',
          v: st.phase === 'done'
            ? `每个 token 只激活 **${st.topk}/${st.experts}**（活跃参数 ${Math.round(st.activeFrac * 100)}%）。负载 [${st.load.join('、')}]${Math.max(...st.load) === Math.min(...st.load) ? '，正好均衡' : '，忙闲不均，需负载均衡'}。`
            : `选中专家 ${st.chosen.join('、')}，门控 ${st.chosenGates.map(g => Math.round(g * 100) + '%').join('、')}。当前负载 [${st.load.join('、')}]。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; activeFrac: number; topk: number; experts: number; chosen: number[]; tokens: string[]; cursor: number }
      return st.phase === 'done' ? `活跃 ${Math.round(st.activeFrac * 100)}%（${st.topk}/${st.experts} 专家）`
        : `${st.tokens[st.cursor]} → 专家 ${st.chosen.join(',')}`
    },
    read: [
      { at: '专家行', is: '选中的专家高亮并显示门控 %，没选中的标"跳过"。', anchor: '.moeexperts' },
      { at: '门控细条', is: '每个专家的 softmax 门控，top-k 就是最高的那几个。', anchor: '.moeexperts' },
      { at: '负载条', is: '每个专家累计接了几个 token，红色是最忙的 —— 看均不均衡。', anchor: '.moeload' },
    ],
    try: [
      { act: '把 top-k 从 2 调到 1', watch: '活跃参数从 50% 降到 25%，更省算力；但表达力下降，且更容易有专家闲置（负载不均）。', param: '每 token 选几个专家' },
      { act: '看负载条', watch: '有的专家一直被选、有的没人光顾 —— 这就是 MoE 要做负载均衡的原因。', param: '每 token 选几个专家' },
    ],
    terms: ['moeroute', 'params', 'softmaxdef'],
  },
  quant: {
    question: '7B 模型 fp16 要十几 G，换成 int8 / int4 怎么就塞进小显存了？会差多少？',
    step: (s: never) => {
      const st = s as { phase: string; bits: number; qmax: number; scale: number; cursor: number; weights: number[]; ints: (number|null)[]; deq: (number|null)[]; errs: (number|null)[]; maxErr: number; bytesFp32: number; bytesQ: number }
      return [
        { k: '本步输入',
          v: st.phase === 'scale' ? `int${st.bits} 的整数范围 ±${st.qmax}，权重绝对值最大值`
            : st.phase === 'done' ? `${st.weights.length} 个权重全部量化完`
              : `第 ${st.cursor} 个权重 w=${st.weights[st.cursor]}` },
        { k: '判定规则',
          v: st.phase === 'scale'
            ? `**定标**：scale = max|w| ÷ ${st.qmax} = **${st.scale.toFixed(4)}**。整数的每一格代表这么大的实数。`
            : `**量化**：q = round(w ÷ scale) 截断到 ±${st.qmax}，只存这个整数（int${st.bits} 占 ${st.bits/8} 字节）；用时反量化 ŵ = q × scale。` },
        { k: '本步结果',
          v: st.phase === 'done'
            ? `fp32 的 ${st.bytesFp32} 字节压到 int${st.bits} 的 **${st.bytesQ} 字节**（省 ${Math.round((1-st.bytesQ/st.bytesFp32)*100)}%），最大误差 **${st.maxErr.toFixed(3)}**。位越少越省、误差越大。`
            : st.phase === 'scale' ? `定标完成，接下来逐个把权重四舍五入到最近的整数格。`
              : `q=${st.ints[st.cursor]}，反量化 ${(st.deq[st.cursor] ?? 0).toFixed(3)}，误差 ${(st.errs[st.cursor] ?? 0).toFixed(3)}。目前最大误差 ${st.maxErr.toFixed(3)}。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; bits: number; bytesFp32: number; bytesQ: number; maxErr: number; cursor: number }
      return st.phase === 'done' ? `int${st.bits} · 省 ${Math.round((1-st.bytesQ/st.bytesFp32)*100)}% · 最大误差 ${st.maxErr.toFixed(3)}`
        : st.phase === 'scale' ? `int${st.bits} 定标中` : `量化第 ${st.cursor} 个`
    },
    read: [
      { at: 'scale 条', is: '整数范围 ±qmax 与 scale 步长，量化的标尺。', anchor: '.qzscale' },
      { at: '量化表', is: 'w → 整数 q → 反量化 ŵ → 误差，逐行长出。', anchor: '.qztab' },
      { at: '显存对比', is: 'fp32 与 int8/4 的字节数，右边是省下的比例与最大误差。', anchor: '.qzfoot' },
    ],
    try: [
      { act: '在 int8 / int4 之间切', watch: 'int4 显存再省一半，但 scale 变大、整数格变粗，误差明显变大（0.008 → 0.14）。', param: '量化位数' },
      { act: '看绝对值最大的那个权重', watch: '它总被映射到 ±qmax（int8 的 ±127 / int4 的 ±7）—— scale 就是按它定的。', param: '量化位数' },
    ],
    terms: ['quantsym', 'params'],
  },
  specdec: {
    question: '大模型逐字吐太慢，怎么用一个小模型帮它一次多吐几个字还不掉质量？',
    step: (s: never) => {
      const st = s as { phase: string; proposals: string[]; matchLen: number; bonus: boolean; gotThisRound: number; targetPasses: number; tokensOut: number; speedup: number; K: number }
      return [
        { k: '本步输入',
          v: st.phase === 'done' ? `共 ${st.tokensOut} 字生成完` : `草稿模型一次猜 ${st.K} 个：「${st.proposals.join('')}」` },
        { k: '判定规则',
          v: `大模型**一次前向**并行验证这 K+1 个位置：从头比对，接受草稿猜对的**最长前缀**，第一个错处用大模型真值**纠正**，其余作废；全中还**白送 1 个**。落地的字都由大模型定夺 → 输出与逐字生成一致。` },
        { k: '本步结果',
          v: st.phase === 'done'
            ? `${st.tokensOut} 字只花了 **${st.targetPasses}** 次大模型前向（逐字要 ${st.tokensOut} 次）→ 加速 **${st.speedup.toFixed(2)}×**。`
            : `接受前 ${st.matchLen} 个` + (st.bonus ? '（全中，白送 1 个）' : '，纠正 1 个') + `，本轮落地 ${st.gotThisRound} 字。累计 ${st.speedup.toFixed(2)}×。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; speedup: number; targetPasses: number; tokensOut: number; matchLen: number }
      return st.phase === 'done' ? `${st.tokensOut} 字 / ${st.targetPasses} 次前向 = ${st.speedup.toFixed(2)}×`
        : `接受 ${st.matchLen} 个 · 累计 ${st.speedup.toFixed(2)}×`
    },
    read: [
      { at: '已生成序列', is: '锁定的输出，绿色；本轮新落地的高亮。', anchor: '.sdseq' },
      { at: '本轮草稿', is: '✓ 接受 / ✗ 纠正 / 作废，最后一格是大模型的真值或白送。', anchor: '.sdprops' },
      { at: '加速比', is: '出字数 / 大模型前向次数，和逐字条对比。', anchor: '.sdspeed' },
    ],
    try: [
      { act: '把草稿步数 K 从 1 加到 4', watch: 'K 越大一次猜得越多，草稿准时接受越多、加速比越高（本例到 2.67×）。', param: '草稿步数 K' },
      { act: '盯住每轮"接受几个"', watch: '草稿猜对就多吐几个字、只花 1 次大模型前向；猜错处被大模型真值纠正，绝不出错。', param: '草稿步数 K' },
    ],
    terms: ['specdraft'],
  },
  scaledmask: {
    question: '注意力打完分，为什么还要除 √d、还要盖一层掩码？',
    step: (s: never) => {
      const st = s as { phase: string; row: number; tokens: string[]; d: number; scale: number; causal: boolean; peak: number; peakUnscaled: number; raw: number[] }
      return [
        { k: '本步输入',
          v: st.phase === 'done' ? '所有查询行算完' : `第 ${st.row} 行「${st.tokens[st.row]}」的原始 Q·K 分数` },
        { k: '判定规则',
          v: `**除 √${st.d}=${st.scale.toFixed(2)}**：把分数拉回合适量程，防止 softmax 饱和（一个≈1、其余≈0、梯度消失）。` + (st.causal ? `**因果掩码**：把 j>${st.phase === 'done' ? 'i' : st.row} 的未来位设 −∞，softmax 后权重恰为 0 → 矩阵成下三角。` : '（未开掩码 → 双向注意力，矩阵全满）') },
        { k: '本步结果',
          v: st.phase === 'done'
            ? `注意力矩阵${st.causal ? '成下三角，每个词只看自己和前文' : '全满（双向）'}，每行 softmax 和为 1。除 √d 让分布不过尖。`
            : `本行最大权重 ${Math.round(st.peak * 100)}%` + (st.d > 1 ? `；若不除 √d 会到 ${Math.round(st.peakUnscaled * 100)}%（更饱和、更接近独热）。` : '。') },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; causal: boolean; d: number; peak: number; row: number; tokens: string[] }
      return st.phase === 'done' ? `${st.causal ? '下三角' : '双向'} · 除 √${st.d} 后不饱和`
        : `行 ${st.row} · 最大权重 ${Math.round(st.peak * 100)}%`
    },
    read: [
      { at: '注意力矩阵', is: '逐行长出，颜色越深越关注；· 是被掩掉的未来位（权重 0）。', anchor: '.smmgrid' },
      { at: '本行拆解', is: '原始 Q·K → 除 √d → softmax 三行，看数字怎么被压平。', anchor: '.smmbreak' },
      { at: '去饱和对比', is: '左边除 √d 后的最大权重，右边不除会更尖。', anchor: '.smmsat' },
    ],
    try: [
      { act: '把头维度 d 调大（1 → 4 → 64）', watch: '同一行的最大权重越来越低、分布越来越平 —— √d 越大，去饱和越明显。', param: '头维度 d' },
      { act: '关掉因果掩码', watch: '注意力矩阵从下三角变成全满 —— 每个词能看到未来（双向，像 BERT 而非 GPT）。', param: '因果掩码' },
    ],
    terms: ['scaledd', 'causalmask', 'softmaxdef', 'scaleddot'],
  },
  roofline: {
    question: '为什么大模型解码那么慢，GPU 却没跑满？加大 batch 为什么就快了？',
    step: (s: never) => {
      const st = s as { phase: string; batch: number; ai: number; ridge: number; bound: string; attainTFLOPs: number; util: number; peakTFLOPs: number }
      return [
        { k: '本步输入',
          v: st.phase === 'done' ? '批 1 → 128 全部走完' : `批大小 ${st.batch}：算 FLOPs、搬字节` },
        { k: '判定规则',
          v: `**算术强度 AI = FLOPs ÷ 字节**。和**脊点 ${st.ridge}**（峰值算力÷带宽）比：AI < 脊点 → **卡带宽**（搬得慢、算力闲着）；AI ≥ 脊点 → **卡算力**。可达性能 = min(峰值, AI·带宽)。` },
        { k: '本步结果',
          v: st.phase === 'done'
            ? `批越大 AI 越高、越往算力屋顶爬：利用率从 <1% 升到 **${Math.round(st.util * 100)}%**。解码单条 AI≈1 卡死在带宽 —— 这就是"慢在搬权重"。`
            : `AI = **${st.ai.toFixed(1)}** → **${st.bound === 'memory' ? '卡带宽' : '卡算力'}**。可达 ${st.attainTFLOPs} TFLOP/s，只用到峰值算力的 **${Math.round(st.util * 100)}%**。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; batch: number; ai: number; bound: string; util: number }
      return st.phase === 'done' ? `批 1→128 · 利用率 <1% → ${Math.round(st.util * 100)}%`
        : `批 ${st.batch} · AI ${st.ai.toFixed(1)} · ${st.bound === 'memory' ? '卡带宽' : '卡算力'}`
    },
    read: [
      { at: '屋顶线图', is: '红斜坡=带宽屋顶，绿平顶=算力屋顶，交点是脊点。', anchor: '.rfsvg' },
      { at: '点的位置', is: '每个批一个点，AI 越大越往右上爬，越贴近算力屋顶。', anchor: '.rfsvg' },
      { at: '瓶颈', is: 'AI 小于脊点就是带宽瓶颈（红），大于是算力瓶颈（绿）。', anchor: '.rfstats' },
    ],
    try: [
      { act: '一步步加大批（1→128）', watch: 'AI 从 ~1 涨到 ~120，点沿红斜坡往上爬，算力利用率从 0.6% 升到 77%。', param: '模型维度 d' },
      { act: '想想解码 vs 批处理', watch: '单条解码 AI≈1 死死卡在带宽；连续批处理把很多请求凑成大 batch，正是在抬 AI。', param: '模型维度 d' },
    ],
    terms: ['roofmodel'],
  },
  flash: {
    question: '把注意力拆成小块一块块算，结果会变吗？为什么这样能快很多？',
    step: (s: never) => {
      const st = s as { phase: string; block: number[]; m: number; l: number; acc: number; out: number; naive: number; err: number; blockSize: number; scores: number[] }
      return [
        { k: '本步输入',
          v: st.phase === 'done' ? '所有块扫完' : `第 ${st.block.length ? Math.floor(st.block[0] / st.blockSize) + 1 : 1} 块：键 ${st.block.join('、')}（每块 ${st.blockSize} 个）` },
        { k: '判定规则',
          v: '**在线 softmax**：维护滚动的 m（最大分数）、l（exp 之和）、O（加权和）。每来一块，先把旧的 l、O 按 **exp(旧max − 新max)** 缩放对齐，再加本块贡献。softmax 同减常数不变 → 分块累加与一次性完全等价。' },
        { k: '本步结果',
          v: st.phase === 'done'
            ? `在线结果 O=**${st.out.toFixed(4)}**、真值 **${st.naive.toFixed(4)}**，相对误差 ${(st.err * 1e9).toFixed(2)}e-9 —— 分毫不差。那条长度 ${st.scores.length} 的分数向量全程没落 HBM。`
            : `更新 m=${st.m.toFixed(2)}、l=${st.l.toFixed(2)}，当前 O=${st.out.toFixed(2)}（真值 ${st.naive.toFixed(2)}，还差 ${(st.err * 100).toFixed(1)}%）。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; out: number; naive: number; err: number; block: number[] }
      return st.phase === 'done' ? `O ${st.out.toFixed(2)} = 真值 ${st.naive.toFixed(2)} · 误差 ~0`
        : `扫块 ${st.block.join('')} · O→${st.out.toFixed(1)}`
    },
    read: [
      { at: '分数行', is: '琥珀块是本步在扫的 K/V 块，绿色是已扫过的。', anchor: '.flscores' },
      { at: '滚动 m / l / O', is: '三个累加量，随每块更新 —— 从不需要完整分数向量。', anchor: '.flacc' },
      { at: '收敛对照', is: '当前 O/l 一路逼近一次性 softmax 的真值，末步完全相等。', anchor: '.flconv' },
      { at: 'HBM 流量', is: '朴素把分数向量在 HBM 搬 ~3N 趟，flash 是 0。', anchor: '.flio' },
    ],
    try: [
      { act: '改块大小（1 / 2 / 3）', watch: '扫的步数变了，但最终 O 分毫不变 —— 分块只影响怎么算，不影响算什么。', param: '块大小' },
      { act: '盯住 O/l 的收敛', watch: '每扫一块，当前输出就朝真值挪一步，末步相对误差降到 ~1e-9。', param: '块大小' },
    ],
    terms: ['onlinesoftmax', 'hbmsram', 'softmaxdef'],
  },
  kvcache: {
    question: '每生成一个 token 都要重看前文，为什么不会越来越慢到不可用？',
    step: (s: never) => {
      const st = s as { phase: string; seq: string[]; computed: number; recomputed: number; cacheSize: number; cumCached: number; cumNaive: number; savedPct: number }
      return [
        { k: '本步输入',
          v: st.phase === 'prefill' ? `提示词 ${st.cacheSize} 个 token，一次性预填充`
            : st.phase === 'done' ? `${st.seq.length} 个 token 全部生成完`
              : `生成第 ${st.seq.length} 个 token「${st.seq[st.seq.length - 1]}」，前面已有 ${st.cacheSize - 1} 个` },
        { k: '判定规则',
          v: `注意力要用到**前面每个 token 的 K/V**。**有缓存**：算过的 K/V 存起来，本步只算新 token 那 **1** 个；**无缓存**：本步把整段 ${st.recomputed} 个 token 的 K/V 全重算。所以有缓存每步是常数、无缓存随长度线性涨。` },
        { k: '本步结果',
          v: st.phase === 'done'
            ? `有缓存共算 **${st.cumCached}** 次、无缓存要 **${st.cumNaive}** 次 —— 省 **${st.savedPct}%**。代价：缓存占 ${st.cacheSize} 对 K/V 显存，序列越长占越多。`
            : `有缓存算 ${st.computed}、无缓存要 ${st.recomputed}。累计 ${st.cumCached} vs ${st.cumNaive}，缓存现存 ${st.cacheSize} 对。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; savedPct: number; seq: string[]; cacheSize: number }
      return st.phase === 'done' ? `缓存省 ${st.savedPct}% 计算 · 占 ${st.cacheSize} 对 KV`
        : st.phase === 'prefill' ? `预填充 ${st.cacheSize} 个 token`
          : `第 ${st.seq.length} 个 · 只算 1 个 K/V`
    },
    read: [
      { at: 'token 序列', is: '绿框是缓存里已有的 K/V，琥珀框是本步新算的那一个。', anchor: '.kvseq' },
      { at: '本步计算量', is: '左边有缓存永远是 1，右边无缓存等于当前序列长度。', anchor: '.kvstep' },
      { at: '累计对比条', is: '有缓存线性、无缓存二次 —— 差距随长度拉开。', anchor: '.kvcmp' },
    ],
    try: [
      { act: '拉长总长度', watch: '无缓存累计按 ~L²/2 涨、有缓存只按 L 涨，省下的百分比越来越高。', param: '总长度' },
      { act: '改提示词长度', watch: '预填充一次算完提示词那段；提示词越长，缓存起步就越大。', param: '提示词长度' },
    ],
    terms: ['kvprefill', 'kvmem'],
  },
  mha: {
    question: 'MHA / MQA / GQA 差在哪？为什么大模型都改用 GQA？',
    step: (s: never) => {
      const st = s as { act: string; variant: string; heads: number; kvHeads: number; focus: number; map: number[]; kvRatio: number }
      return [
        { k: '本步输入', v: st.act === 'done' ? `${st.variant}：${st.heads} 个 query 头、${st.kvHeads} 个 KV 头` : `query 头 ${st.focus}` },
        { k: '判定规则', v: `注意力分多个头并行。三种变体差在**KV 头怎么共享**：**MHA** 每个 query 头独占一个 KV 头；**MQA** 所有 query 头共享 1 个；**GQA** 分组共享。KV 缓存 ∝ KV 头数。` },
        { k: '本步结果', v: st.act === 'done'
          ? `KV 缓存是 MHA 的 **${Math.round(st.kvRatio * 100)}%**。${st.variant === 'GQA' ? 'GQA 用一点表达力换来 KV 缓存大减 —— 现在主流' : st.variant === 'MQA' ? 'MQA 最省但可能掉点' : 'MHA 最大、表达力最强'}`
          : `它读 KV 头 **${st.map[st.focus]}**。` },
      ]
    },
    verdict: (s: never) => { const st = s as { act: string; variant: string; kvRatio: number; focus: number; map: number[] }; return st.act === 'done' ? `${st.variant} · KV ${Math.round(st.kvRatio * 100)}% of MHA` : `头 ${st.focus} → KV ${st.map[st.focus]}` },
    read: [
      { at: '头共享图', is: 'query 头在上、KV 头在下，连线表示谁读谁。', anchor: '.mhwrap' },
      { at: 'KV 缓存条', is: 'KV 头越少、缓存越小 —— MQA 最短、MHA 最长。', anchor: '.mhkv' },
    ],
    try: [
      { act: '在 MHA / MQA / GQA 之间切', watch: '同样 8 个 query 头，KV 头从 8 到 1，KV 缓存从 100% 降到十几 %。', param: '变体' },
      { act: '看 GQA 分组数', watch: '组越多越接近 MHA（表达力高、KV 大），越少越接近 MQA（省显存）。', param: 'GQA 分组' },
    ],
    terms: ['mhavariant', 'kvmem'],
  },
  chunkprefill: {
    question: '一个用户发来超长 prompt，为什么会让别的用户"卡住"？怎么解决？',
    step: (s: never) => {
      const st = s as { phase: string; chunk: number; timeline: {kind:string;cost:number;label:string}[]; cursor: number; clock: number; firstDecodeAt: number; prefillLen: number; totalTime: number }
      const op = st.timeline[st.cursor]
      return [
        { k: '本步输入', v: st.phase === 'done' ? '时间线走完' : op ? `t=${st.clock}：${op.label}` : '开始' },
        { k: '判定规则',
          v: `长 prefill 切成大小 ${st.chunk} 的块，**每排一个 prefill 块就插一个 B 的 decode**。整块跑 B 要等到 prefill 全完（t=${st.prefillLen + 1}）；切块后 B 很快插进来。` },
        { k: '本步结果',
          v: st.phase === 'done'
            ? `B 的首字在 t=**${st.firstDecodeAt}** 就吐出（整块跑要等到 ${st.prefillLen + 1}），总时间还是 ${st.totalTime}。切得越碎、别人等得越短。`
            : op ? `${op.kind === 'prefill' ? 'A 算一块 KV' : 'B 吐一个字'}，时钟到 ${st.clock}。` : '' },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; chunk: number; firstDecodeAt: number; clock: number }
      return st.phase === 'done' ? `块 ${st.chunk} · B 首字延迟 ${st.firstDecodeAt}` : `t=${st.clock}`
    },
    read: [
      { at: '时间线甘特', is: '蓝块是 A 的 prefill、绿块是 B 的 decode、琥珀是 B 首字。', anchor: '.cpgantt' },
      { at: '首字延迟对比', is: '切块后 B 的首字延迟 vs 整块跑要等的时间。', anchor: '.cpcmp' },
    ],
    try: [
      { act: '把块大小从 8 减到 2', watch: 'B 的首字延迟从 9 降到 3，总时间不变 —— 切得越碎别人等得越短。', param: 'prefill 块大小' },
      { act: '看甘特图怎么交错', watch: '块大小 8 是一整条蓝挡在前面；块小了就变成蓝绿相间，B 早早插进来。', param: 'prefill 块大小' },
    ],
    terms: ['chunkpf'],
  },
  knn: {
    question: '不训练模型，怎么给一个新点分类？看它的邻居就行？',
    step: (s: never) => {
      const st = s as { phase: string; k: number; seen: number; voteA: number; voteB: number; predict: number }
      return [
        { k: '本步输入', v: st.phase === 'done' ? `看最近 ${st.k} 个邻居` : `找第 ${st.seen} 近的邻居` },
        { k: '判定规则', v: `k-NN 不训练:找待判点最近的 k 个已知点,让它们**投票**,票多的类别即答案。近的权重大。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `A ${st.voteA} : B ${st.voteB} → 判 **${st.predict === 0 ? 'A' : 'B'}**。边界附近的点,判断会随 k 翻。`
            : `到目前 A **${st.voteA}** : B **${st.voteB}** → 暂判 **${st.predict === 0 ? 'A' : st.predict === 1 ? 'B' : '平'}**。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; voteA: number; voteB: number; predict: number }
      return st.phase === 'done' ? `判 ${st.predict === 0 ? 'A' : 'B'}` : `A${st.voteA}:B${st.voteB}`
    },
    read: [
      { at: '读数', is: 'k、A/B 票数、判为哪类。', anchor: '.scdim' },
      { at: '散点图', is: '◆=待判点;蓝=A、红=B;虚线圈=k 个邻居的覆盖半径,连线=被算进投票的邻居。', anchor: '.mlplot' },
    ],
    try: [
      { act: '按「下一步」逐个找最近邻', watch: '覆盖圈变大、票数累加;够 k 个就定类。' },
      { act: '把 k 从 1 调到 7', watch: '同一个点判断 A→B→A 来回翻——k 小敏感、k 大平滑。' },
    ],
    terms: [],
  },
  kmeans: {
    question: '一堆没有标签的点，怎么自己分成几堆？',
    step: (s: never) => {
      const st = s as { phase: string; iter: number; k: number; inertia: number; converged: boolean }
      return [
        { k: '本步输入', v: st.phase === 'done' ? 'k-means 收敛' : `第 ${st.iter + 1} 轮 · ${st.phase === 'assign' ? '分配' : '更新重心'}` },
        { k: '判定规则', v: `两步反复:①每点归给最近的重心(分堆);②重心移到"自己那堆点"的均值。inertia(簇内平方和)每步降。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `重心 march 到三堆中心、inertia 稳定 **${st.inertia}**、归属稳定——没用任何标签。`
            : st.phase === 'assign' ? `按最近重心分堆,此刻 inertia **${st.inertia}**。`
            : `重心跳到各堆均值${st.converged ? '——不再动了,收敛' : ''}。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; iter: number; inertia: number; converged: boolean }
      return st.phase === 'done' || st.converged ? `inertia ${st.inertia}` : `轮${st.iter + 1}·${st.phase === 'assign' ? '分' : '移'}`
    },
    read: [
      { at: '读数', is: '轮次、簇数 k、簇内平方和、是否收敛。', anchor: '.scdim' },
      { at: '散点图', is: '点按归属染色(三色);✕=重心;看点变色、✕ 移动。', anchor: '.mlplot' },
    ],
    try: [
      { act: '一步步走「分配→移动」', watch: '点按最近 ✕ 染色 → ✕ 跳到自己那堆中心;几轮后三堆清清楚楚。' },
      { act: '盯 inertia', watch: '每步都在降(54→4),重心不再动=收敛。全程没用真实标签。' },
    ],
    terms: [],
  },
  pca: {
    question: '高维数据里维度那么多，怎么找出真正"有用"的几个方向？',
    step: (s: never) => {
      const st = s as { phase: string; angle: number; var1: number }
      return [
        { k: '本步输入', v: st.phase === 'done' ? '2D 投影到 1D 主轴' : ({ cloud: '一团拉长的点云', axis: '找方差最大的方向', project: '投影到主轴' } as Record<string, string>)[st.phase] },
        { k: '判定规则', v: `PCA 找方差最大的方向 PC1(=协方差矩阵最大特征向量),把点投影上去;特征值=该方向方差,越大越该留。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `PC1 保留 **${st.var1}%** 方差——2D 压到 1D 只丢 ${(100 - st.var1).toFixed(1)}%,去冗余抓主轴。`
            : st.phase === 'axis' ? `主轴 PC1 约 **${st.angle}°**,是点铺得最开的方向。`
            : st.phase === 'project' ? `每个点投影到 PC1,原 2D 坐标 → 轴上位置一个数。`
            : `点云沿对角线拉长,两坐标相关——信息集中在少数方向。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; var1: number; angle: number }
      return st.phase === 'done' ? `保 ${st.var1}%` : st.phase === 'cloud' ? '点云' : `PC1 ${st.angle}°`
    },
    read: [
      { at: '读数', is: '主轴方向、保留方差、压维、丢失。', anchor: '.scdim' },
      { at: '散点图', is: '橙点=原始点;橙线=主轴 PC1;红点=投影;虚线=投影垂线;红点(小)=均值。', anchor: '.mlplot' },
    ],
    try: [
      { act: '走 点云→主轴→投影', watch: '先找到 33°主轴(方差最大),再把点垂直投影到轴上。' },
      { act: '看保留方差', watch: 'PC1 一条轴就保住 96%——2D 压到 1D 几乎不丢信息。' },
    ],
    terms: [],
  },
  svm: {
    question: '能分开两类的线有无数条，哪一条最好？',
    step: (s: never) => {
      const st = s as { phase: string; margin: number; supportVectors: number[]; isMax: boolean }
      return [
        { k: '本步输入', v: st.phase === 'done' ? '对比随便一条 vs SVM' : ({ setup: '两类线性可分', naive: '随便一条分开的线', svm: 'SVM 最大间隔' } as Record<string, string>)[st.phase] },
        { k: '判定规则', v: `SVM 找最大间隔:两类间想象最宽的"街道",正中那条是边界。街只由紧贴街边的"支持向量"定住。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `SVM 间隔 **${st.margin}** > 随便那条 0.5,只由 **${st.supportVectors.length}** 个支持向量定边界——泛化最稳。`
            : st.phase === 'naive' ? `贴着一类、间隔只 **0.5**,离一类太近、泛化差。`
            : st.phase === 'svm' ? `边界居中、间隔 **${st.margin}**(街最宽),**${st.supportVectors.length}** 个支持向量高亮。`
            : `能分开的线无数条,哪条最好?` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; margin: number }
      return st.phase === 'done' || st.phase === 'svm' ? `间隔 ${st.margin}` : st.phase === 'naive' ? '间隔窄' : '?'
    },
    read: [
      { at: '读数', is: '哪条边界、间隔、支持向量数、泛化。', anchor: '.scdim' },
      { at: '散点图', is: '两类点;橙线=边界;虚线=街边;浅色=间隔街道;黑圈=支持向量。', anchor: '.mlplot' },
    ],
    try: [
      { act: '走 随便一条 → SVM 两步', watch: '随便那条贴着一类(间隔 0.5);SVM 居中、街最宽(间隔 1)。' },
      { act: '看支持向量', watch: '最宽的街只由紧贴街边的 4 个点定住,其余点再远都不影响边界。' },
    ],
    terms: [],
  },
  gbdt: {
    question: '单棵树不够准，怎么让一串小树接力、越拟合越好？',
    step: (s: never) => {
      const st = s as { phase: string; round: number; mse: number; splitT: number }
      return [
        { k: '本步输入', v: st.phase === 'done' ? `boosting ${st.round} 轮` : st.round === 0 ? '起点:只用均值当预测' : `第 ${st.round} 轮,加第 ${st.round} 棵小树` },
        { k: '判定规则', v: `每轮算残差(真值−当前预测),训一棵小树拟合**残差**,乘学习率加进预测。拟合的是残差/梯度,故名梯度提升。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `MSE 从 0.75 降到 **${st.mse}**,预测阶梯贴上数据——弱学习器接力=强学习器。`
            : st.round === 0 ? `一条平线,MSE **${st.mse}**,啥都没学。`
            : `加一棵切 x≈${st.splitT} 的树桩,MSE 降到 **${st.mse}**。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; round: number; mse: number }
      return st.phase === 'done' ? `MSE ${st.mse.toFixed(2)}` : `第${st.round}轮·${st.mse.toFixed(2)}`
    },
    read: [
      { at: '读数', is: '提升轮数、MSE、小树棵数、本轮切在哪。', anchor: '.scdim' },
      { at: '散点图', is: '蓝点=数据;橙折线=当前预测(阶梯);红竖虚线=残差。', anchor: '.mlplot' },
    ],
    try: [
      { act: '一轮一轮加树', watch: '预测阶梯从平线开始、一段段长出,越来越贴数据、残差变短。' },
      { act: '盯 MSE', watch: '每轮都降(0.75→0.03)——每棵小树只补上一棵没拟合掉的残差。' },
    ],
    terms: [],
  },
  dtree: {
    question: '不用直线，怎么靠"问是非题"一步步把类别分开？',
    step: (s: never) => {
      const st = s as { phase: string; splits: unknown[]; curGini: number; gain: number; leaves: unknown[] }
      return [
        { k: '本步输入', v: st.phase === 'done' ? '切完(3 个纯叶子)' : st.phase === 'root' ? '根节点:16 点混在一起' : `切第 ${st.splits.length} 刀` },
        { k: '判定规则', v: `每刀挑"某特征≷某阈值"里让子集**最纯**的那一刀(基尼不纯度下降最多=信息增益最大);切出纯块成叶子,不纯的继续切。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `深 2、**${st.leaves.length}** 个纯叶子。每条路径=一串 if-else,可解释、拼出非线性边界。`
            : st.phase === 'root' ? `不纯度 Gini **${st.curGini}**(0=全同类),要切纯。`
            : `本刀信息增益 **${st.gain}**,当前节点不纯度降到 **${st.curGini}**。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; splits: unknown[]; leaves: unknown[] }
      return st.phase === 'done' ? `${st.leaves.length} 纯叶子` : st.phase === 'root' ? '根·不纯' : `切${st.splits.length}刀`
    },
    read: [
      { at: '读数', is: '切了几刀、当前不纯度、本刀增益、纯叶子数。', anchor: '.scdim' },
      { at: '散点图', is: '蓝/红两类点;虚线=每一刀(轴对齐);浅色块=已切纯的叶子(按主类)。', anchor: '.mlplot' },
    ],
    try: [
      { act: '一刀一刀切', watch: '先竖切 x=0(左半纯)、再横切右半 y=0——每块变纯、Gini 降到 0。' },
      { act: '看信息增益', watch: '挑的都是让子集最纯的那刀;三刀两下全部切纯。' },
    ],
    terms: [],
  },
  logreg: {
    question: '把"拟合一条线"改一改，怎么变成"分两类"？',
    step: (s: never) => {
      const st = s as { phase: string; gdStep: number; loss: number; acc: number; w1: number; w2: number }
      return [
        { k: '本步输入', v: st.phase === 'done' ? '梯度下降 60 步' : `第 ${st.gdStep} 步梯度下降` },
        { k: '判定规则', v: `打分 z=w₁x+w₂y+b → **sigmoid** 出概率 → **交叉熵**当损失 → 梯度下降调 w、b,把决策边界(z=0)转到分开两类。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `交叉熵 **${st.loss}**、准确率 **${(st.acc * 100).toFixed(0)}%**,边界干净分开——这就是单个神经元+sigmoid。`
            : `交叉熵 **${st.loss}**、准确率 **${(st.acc * 100).toFixed(0)}%**${st.gdStep === 0 ? '(还没边界、蒙一半)' : '(边界往中间转)'}。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; gdStep: number; acc: number }
      return st.phase === 'done' ? `${(st.acc * 100).toFixed(0)}%` : `步${st.gdStep}·${(st.acc * 100).toFixed(0)}%`
    },
    read: [
      { at: '读数', is: '梯度下降步、交叉熵损失、准确率、边界 w。', anchor: '.scdim' },
      { at: '散点图', is: '蓝/红两类点;橙线=决策边界(z=0);两侧按 sigmoid 概率渐变。', anchor: '.mlplot' },
    ],
    try: [
      { act: '按「下一步」推进', watch: '决策边界从无到有、转到两类中间;准确率 50%→100%、交叉熵降。' },
      { act: '对比线性回归', watch: '同一套"定损失→求梯度→更新",只是 MSE 换交叉熵、直线换 sigmoid 概率。' },
    ],
    terms: [],
  },
  backprop: {
    question: '网络有上亿个权重，怎么一趟就把每个权重的梯度都算出来？',
    step: (s: never) => {
      const st = s as { phase: string; stage: string; loss: number; gLda: number | null; gLdz: number | null; gLdw: number | null }
      return [
        { k: '本步输入', v: st.phase === 'forward' ? '前向:算到损失 L' : st.phase === 'done' ? '反向完成' : `反向回传:${st.stage}` },
        { k: '判定规则', v: `前向算 L;反向从 L 出发,用链式法则**下游梯度 × 本站局部导数 = 上游梯度**,一站站回传到每个权重。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `dL/dw、dL/db 都算出来了(负→梯度下降增大 w、b、降损失)。一趟出全部梯度。`
            : st.phase === 'forward' ? `损失 L=**${st.loss}**。接下来从它往回传梯度。`
            : st.gLdw !== null ? `到权重:dL/dw=**${st.gLdw}**。` : st.gLdz !== null ? `过 sigmoid:dL/dz=**${st.gLdz}**。` : `dL/da=**${st.gLda}**。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; stage: string }
      return st.phase === 'done' ? '梯度全出' : st.phase === 'forward' ? '前向' : st.stage
    },
    read: [
      { at: '读数', is: '当前趟、损失 L、逐站梯度 dL/da、dL/dz、dL/dw。', anchor: '.scdim' },
      { at: '计算图', is: 'w,x,b→z→a→L 的链;节点上=前向值,节点下红字=回传的梯度 ∂L。', anchor: '.bpplot' },
    ],
    try: [
      { act: '一步步走', watch: '前向算到 L;再从 L 往回,dL/da → 过 sigmoid → dL/dz → dL/dw、dL/db。' },
      { act: '盯每站', watch: '下游梯度 × 本站局部导数 = 上游梯度——链式法则把误差一路送回权重。' },
    ],
    terms: [],
  },
  binsearch: {
    question: '数组已经排好序，怎么比一个个扫快得多地找到一个数？',
    step: (s: never) => {
      const st = s as { phase: string; target: number; lo: number; hi: number; mid: number; arr: number[]; cmp: string; compares: number; found: number }
      return [
        { k: '本步输入', v: st.phase === 'done' ? `在 ${st.arr.length} 个数里找 ${st.target}` : `区间 [${st.lo},${st.hi}]，看中点` },
        { k: '判定规则', v: `看正中间 arr[mid]:等于就命中;目标比它大只在右半、小只在左半——一次比较**砍掉一半**。区间反复对折。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `**${st.compares}** 次比较命中(下标 ${st.found})——log₂n,百万个也才 ~20 步。`
            : st.cmp === 'hit' ? `arr[${st.mid}]=${st.arr[st.mid]}=${st.target},**命中**!`
            : st.cmp === 'go-right' ? `arr[${st.mid}]=${st.arr[st.mid]}<${st.target},砍左半、看右边。`
            : `arr[${st.mid}]=${st.arr[st.mid]}>${st.target},砍右半、看左边。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; compares: number; lo: number; hi: number }
      return st.phase === 'done' ? `${st.compares} 步命中` : `[${st.lo},${st.hi}]`
    },
    read: [
      { at: '读数', is: '要找的数、当前区间、比较次数、结果。', anchor: '.scdim' },
      { at: '数组', is: '有序数;灰=已排除、蓝框=中点 mid、绿=命中;lo/hi 标在下面。', anchor: '.bsrow' },
    ],
    try: [
      { act: '按「下一步」二分', watch: '每步看中点、砍掉一半灰掉;区间越缩越小。' },
      { act: '数比较次数', watch: '13 个数只要 4 次——log₂n,不是一个个扫的 n 次。' },
    ],
    terms: [],
  },
  nqueens: {
    question: '要把 N 个皇后摆得互不攻击，怎么系统地试、不漏不重？',
    step: (s: never) => {
      const st = s as { phase: string; act: string; row: number; col: number; skip: number[]; cols: number[]; placed: number; n: number; backtracks: number }
      const solved = st.act === 'solved' || st.phase === 'done'
      return [
        { k: '本步输入', v: solved ? `盘上 ${st.placed}/${st.n} 个皇后` : st.act === 'backtrack' ? `第 ${st.row} 行列 ${st.col} 下面走进死胡同` : `第 ${st.row} 行,从左找安全列` },
        { k: '判定规则', v: `行内挑**不被已放皇后攻击**的列(同列或对角|Δ行|=|Δ列| 都算攻击);找到就落子进下一行,整行没有安全位就**回溯**——退回上一行换下一列。` },
        { k: '本步结果', v: solved
            ? `拼出无冲突布局 [${st.cols.join(',')}]——**解出**(回溯 ${st.backtracks} 次)。`
            : st.act === 'place' ? `列 ${st.col} 安全,**落子**${st.skip && st.skip.length ? `(列 ${st.skip.join('、')} 被攻击、跳过)` : ''}。`
            : `**撤回**第 ${st.row} 行的皇后,回上一行换下一个。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; act: string; placed: number; n: number; backtracks: number }
      return (st.act === 'solved' || st.phase === 'done') ? `解出(回溯 ${st.backtracks} 次)` : `${st.placed}/${st.n}` 
    },
    read: [
      { at: '读数', is: '盘上皇后数、累计试列次数、回溯次数。', anchor: '.scdim' },
      { at: '棋盘', is: '♛=皇后;绿格=刚落子(安全)、红格=正被撤回(回溯)、✕=本行被攻击跳过的列。', anchor: '.nqboard' },
    ],
    try: [
      { act: '按「下一步」逐行放', watch: '安全就落子往下走;整行没位就红格撤回、回上一行。' },
      { act: '盯着皇后进出', watch: '一落一撤、换个位置再来——这就是"试错+撤销"的回溯。' },
    ],
    terms: [],
  },
  unionfind: {
    question: '一堆元素不断两两结盟，怎么快速回答「这俩现在是不是一伙的」？',
    step: (s: never) => {
      const st = s as { phase: string; act: string; a: number; b: number; ra: number; rb: number; root: number; path: number[]; comps: number; depths: number[] }
      return [
        { k: '本步输入', v: st.act === 'union' ? `union(${st.a},${st.b})` : st.act === 'find' ? `find(${st.a}):要认根` : st.act === 'compress' ? `find(${st.a}) 的路径 ${st.path.join('→')}` : `已并成 ${st.comps} 团` },
        { k: '判定规则', v: `每个元素顺**父指针**爬到**根**,根=集团代表。union=把两人的根挂一起、并成一棵树;"是不是一伙"就看**根同不同**;路径压缩=find 到根后把沿途点直接挂根下、拍平长链。` },
        { k: '本步结果', v: st.act === 'union'
            ? (st.ra === st.rb ? `根都是 ${st.ra},本就一伙,不用并。` : `根 ${st.ra}≠根 ${st.rb} → 挂到一起,连通分量降到 ${st.comps}。`)
            : st.act === 'find' ? `顺链爬 ${[...st.path, st.root].join('→')} 到根 **${st.root}**,爬了 ${st.path.length} 步。`
            : st.act === 'compress' ? `把 ${st.path.join('、')} 全直挂根 ${st.root},最深链塌到 **${Math.max(...st.depths)}**。`
            : `6 次 union 并成 **1** 团,find 认根、压缩拍平——均摊近乎 O(1)。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; act: string; comps: number; path: number[] }
      return st.phase === 'done' ? `${st.comps} 团` : st.act === 'find' ? `爬 ${st.path.length} 步` : `${st.comps} 团`
    },
    read: [
      { at: '读数', is: '连通分量数、本步操作、最深链长。', anchor: '.scdim' },
      { at: '节点', is: '大数=编号、↑=父指针、深N=到根几步、顶部色条=所属集团(同色一伙)。', anchor: '.ufrow' },
    ],
    try: [
      { act: '按「下一步」做 union', watch: '两棵树并成一棵、连通分量数一路减到 1。' },
      { act: '看 find(0) + 压缩', watch: '顺链爬到根,再把沿途点直挂根下——最深链从 4 塌到 1。' },
    ],
    terms: [],
  },
  heap: {
    question: '怎么让「随时取出最大值」快到 O(log n)，而不是每次扫一遍？',
    step: (s: never) => {
      const st = s as { phase: string; act: string; stage: string; arr: number[]; node: number; child: number; heapN: number; sortedFrom: number }
      return [
        { k: '本步输入', v: st.act === '' ? `乱序数组 [${st.arr.join(',')}]` : st.act === 'extract' ? `堆顶 ${st.arr[st.sortedFrom]} 要取出` : st.stage === 'build' ? `建堆:节点 ${st.node >= 0 ? st.arr[st.node] : '—'} sift-down` : `复原:堆顶下沉` },
        { k: '判定规则', v: `完全二叉树 + **父≥子**=最大堆,堆顶永远最大。孩子在 2i+1/2i+2;sift-down=节点比更大的孩子小就**交换、往下沉**到位。取最大=堆顶↔末尾、堆减一、再下沉复原。` },
        { k: '本步结果', v: st.act === 'sift' ? `${st.arr[st.node]} 比孩子小 → 交换下沉。`
            : st.act === 'extract' ? `最大值和末尾对调,排到数组尾就位,堆缩到 ${st.heapN}。`
            : st.act === 'done' ? `新堆顶 **${st.arr[0]}** 是剩下的最大;反复取顶=堆排序 O(n log n)。`
            : st.stage === 'build' && st.node === 0 ? `**最大堆建成**,堆顶 ${st.arr[0]}=全体最大。`
            : `节点已 ≥ 孩子,到位。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; act: string; stage: string; arr: number[] }
      return st.phase === 'done' ? `顶=${st.arr[0]}` : st.stage === 'build' ? '建堆' : '取最大'
    },
    read: [
      { at: '读数', is: '堆顶(最大)、堆内元素数、当前阶段。', anchor: '.scdim' },
      { at: '树+数组', is: '上=完全二叉树(琥珀=正下沉的节点、绿=更大的孩子),下=同一堆压进数组(#k=下标,绿"已排"=取出的最大)。', anchor: '.hpwrap' },
    ],
    try: [
      { act: '按「下一步」建堆', watch: '节点比孩子小就下沉,整棵树变成父≥子、堆顶最大。' },
      { act: '看取最大', watch: '堆顶和末尾对调、最大排到尾,新顶下沉复原——这就是堆排序的一趟。' },
    ],
    terms: [],
  },
  quicksort: {
    question: '不用一趟趟两两交换，怎么把一个数组又快又省地排好？',
    step: (s: never) => {
      const st = s as { phase: string; act: string; arr: number[]; lo: number; hi: number; pivotVal: number; iPtr: number; jPtr: number; sortedCount: number; n: number }
      return [
        { k: '本步输入', v: st.act === '' ? `乱序 [${st.arr.join(',')}]` : st.pivotVal >= 0 && st.phase !== 'done' ? `区间 [${st.lo},${st.hi}],基准 ${st.pivotVal}` : `已排好 ${st.sortedCount}/${st.n}` },
        { k: '判定规则', v: `分治:挑一个**基准 pivot**,一趟扫描把 **<pivot 的甩左、≥pivot 的留右**;基准落到分界位=**最终位置**(左全小、右全不小),永久锁定。再对左右两段**各自递归**,段长到 1 停。` },
        { k: '本步结果', v: st.act === 'swap' ? `${st.arr[st.iPtr]} < ${st.pivotVal},换进左区。`
            : st.act === 'grow' ? `${st.arr[st.jPtr]} < ${st.pivotVal},原地并入左区。`
            : st.act === 'keep' ? `${st.arr[st.jPtr]} ≥ ${st.pivotVal},留右边。`
            : st.act === 'place' ? `基准 ${st.pivotVal} **归位**到 #${st.jPtr},区间一切为二。`
            : st.act === 'single' ? `单元素区间,天然有序,直接归位。`
            : st.act === 'pivot' ? `挑末元素 ${st.pivotVal} 当基准,开始扫描。`
            : st.act === 'done' ? `**排好序** [${st.arr.join(',')}]——平均 O(n log n)、原地。`
            : `扫描中。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; sortedCount: number; n: number; pivotVal: number }
      return st.phase === 'done' ? '已排好' : st.pivotVal >= 0 ? `归位 ${st.sortedCount}/${st.n}` : `${st.sortedCount}/${st.n}`
    },
    read: [
      { at: '读数', is: '当前基准、处理区间、已归位个数。', anchor: '.scdim' },
      { at: '数组', is: '琥珀=基准 pivot、蓝=扫描指针 j、i=左区右边界、绿✓=已归位(最终位置)、灰=不在当前区间。', anchor: '.qsrow' },
    ],
    try: [
      { act: '按「下一步」分区', watch: 'j 一路扫:小的收进左区、大的留右;扫完基准归位、区间一切为二。' },
      { act: '数已归位', watch: '每趟 partition 定死一个基准的最终位置;段越切越短,直到全部锁定。' },
    ],
    terms: [],
  },
  mergesort: {
    question: '把两个已经排好序的小段合成一个大有序段，最快怎么做？',
    step: (s: never) => {
      const st = s as { phase: string; act: string; arr: number[]; width: number; lo: number; hi: number; took: number; from: string; out: number[] }
      return [
        { k: '本步输入', v: st.act === '' ? `乱序 [${st.arr.join(',')}]` : st.act === 'done' ? `段宽 ${st.width} 的两段` : `归并 [${st.lo},${st.hi}),各取队首比` },
        { k: '判定规则', v: `分治:拆到长度 1(天然有序),再**两两归并**。合并两个有序段时,两段各自**队首就是各自最小**——比一下,把**小的先接进输出**,一趟线性扫完就拼成更长有序段。段宽 1→2→4… 翻倍。` },
        { k: '本步结果', v: st.act === 'done' ? `拼成宽 ${st.out.length} 的有序段 [${st.out.join(',')}]。`
            : st.act === 'drain' ? `另一段空了,${st.from === 'L' ? '左' : '右'}段剩下的 ${st.took} 直接接上。`
            : st.act === 'emit' ? `${st.from === 'L' ? '左' : '右'}段队首 ${st.took} 更小 → 取它。`
            : st.act === 'done' && st.phase === 'done' ? `排好序。`
            : `扫描中。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; act: string; width: number; out: number[] }
      return st.phase === 'done' ? '已排好' : st.act === 'done' ? `宽 ${st.out.length}` : `段宽 ${st.width}`
    },
    read: [
      { at: '读数', is: '当前段宽、正在归并的区段、已输出个数。', anchor: '.scdim' },
      { at: '数组+缓冲', is: '上=原数组(蓝=左段、琥珀=右段,▸=各自队首,灰=不在本次归并),下=输出缓冲逐个填。', anchor: '.mswrap' },
    ],
    try: [
      { act: '按「下一步」归并', watch: '比两段队首、把小的先接进输出;一段空了另一段整段接上。' },
      { act: '看段宽翻倍', watch: '长度 1→2→4… 每轮把相邻两段合成更长的有序段,直到全有序。' },
    ],
    terms: [],
  },
  fastpow: {
    question: '算 a 的 n 次方，怎么不用老实乘 n 次，而是 log n 步搞定？',
    step: (s: never) => {
      const st = s as { phase: string; act: string; a: number; n: number; k: number; bit: number; powK: number; result: number; prevResult: number; mults: number; squares: number; picked: number[] }
      return [
        { k: '本步输入', v: st.act === '' ? `算 ${st.a}^${st.n}` : st.act === 'done' ? `${st.a}^${st.n} 逐位处理完` : `第 ${st.k} 位 = ${st.bit},幂 ${st.a}^${2 ** st.k}=${st.powK}` },
        { k: '判定规则', v: `把指数写成**二进制**,每一位对应一个"反复平方"得来的幂 a^(2^k)(a,a²,a⁴,a⁸…每个由上一个平方而来)。这位是 **1** 就把该幂**乘进结果**、是 **0** 就跳过。log n 位 ⇒ log n 步。` },
        { k: '本步结果', v: st.act === 'mul' ? `这位是 1 → ${st.prevResult}×${st.powK}=${st.result}。`
            : st.act === 'skip' ? `这位是 0 → 跳过,结果仍 ${st.result}。`
            : st.act === 'done' ? `${st.a}^${st.n}=${st.a}^(${st.picked.join('+')})=**${st.result}**,${st.mults} 乘+${st.squares} 平方 vs 朴素 ${st.n} 乘。`
            : `处理中。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; act: string; result: number; powK: number }
      return st.phase === 'done' ? `${st.result}` : st.act === 'mul' ? `×${st.powK}` : st.act === 'skip' ? '跳过' : '逐位'
    },
    read: [
      { at: '读数', is: '要算的幂、当前结果、乘+平方次数。', anchor: '.scdim' },
      { at: '二进制位', is: '指数拆二进制,每列一位:琥珀=当前位、绿✓=是1且已乘入、每列标 a^(2^k)。', anchor: '.fprow' },
    ],
    try: [
      { act: '按「下一步」逐位', watch: 'base 反复平方得 a^(2^k);二进制这位是 1 就把它乘进结果、0 就跳。' },
      { act: '数乘法次数', watch: '3¹³ 只用 3 乘+3 平方,不是老实乘 13 次——log n vs n。' },
    ],
    terms: [],
  },
  astar: {
    question: '在有障碍的网格里找最短路，怎么比 Dijkstra 四面乱铺更聪明？',
    step: (s: never) => {
      const st = s as { phase: string; act: string; cur: number[]; curG: number; curH: number; curF: number; expanded: number; open: string[]; path: string[] }
      return [
        { k: '本步输入', v: st.act === '' ? '从起点 S 出发' : st.act === 'done' ? `已展开 ${st.expanded} 格` : `开放集里 f 最小的格 (${st.cur[0]},${st.cur[1]})` },
        { k: '判定规则', v: `每格算 **f=g+h**:g=从起点已走的步数、h=到终点的**乐观估计**(曼哈顿距离,永不高估)。每步展开 f 最小的格→移入关闭集、邻居加进开放集。g 防走冤枉、h 把搜索**拽向终点**;h 不高估就保证最短路。` },
        { k: '本步结果', v: st.act === 'expand' ? `展开 (${st.cur[0]},${st.cur[1]}):g=${st.curG}+h=${st.curH}=**f=${st.curF}**,邻居入开放集。`
            : st.act === 'goal' ? `取到终点!g=${st.curG}、h=0——最短路已定。`
            : st.act === 'done' ? `**最短路 ${st.path.length - 1} 步**,只展开 ${st.expanded} 格(比 Dijkstra 省)。`
            : `搜索中。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; act: string; curF: number; path: string[] }
      return st.phase === 'done' ? `${st.path.length - 1} 步` : st.act === 'goal' ? '到终点' : `f=${st.curF}`
    },
    read: [
      { at: '读数', is: '当前 f=g+h、已展开格数、开放集大小。', anchor: '.scdim' },
      { at: '网格', is: '大数=f、角标 g;蓝=已展开(关闭)、虚线浅色=开放集、琥珀=正展开、深灰=墙、S/G=起终点、绿=最短路。', anchor: '.asgrid' },
    ],
    try: [
      { act: '按「下一步」展开', watch: 'A* 先探 f 最小的:沿 h 指引直扑终点,撞墙才绕行。' },
      { act: '看展开范围', watch: '只在起点→终点那条走廊附近展开,不像 Dijkstra 四面均匀铺。' },
    ],
    terms: [],
  },
  perceptron: {
    question: '一个神经元怎么"学会"在平面上画一条线，把两类点分开？',
    step: (s: never) => {
      const st = s as { phase: string; act: string; pts: { x: number[]; y: number }[]; w: number[]; b: number; pass: number; ptIdx: number; score: number; ok: boolean; updated: boolean; updates: number }
      const p = st.ptIdx >= 0 ? st.pts[st.ptIdx] : null
      return [
        { k: '本步输入', v: st.act === '' ? '一条还没定的线,6 个点' : st.act === 'converged' ? `第 ${st.pass} 轮扫查` : st.act === 'done' ? `学好的线 w=(${st.w.join(',')})` : `点 (${p!.x.join(',')}) 真实类 ${p!.y > 0 ? '正' : '负'}` },
        { k: '判定规则', v: `神经元算 **score=w·x+b**,看符号判类别(几何=一条分界线)。逐点检查:符号和真实类**一致就分对、不动**;**不一致就纠**——把权重朝该点挪:w += y·x、b += y。扫到某轮**零错误**即收敛(线性可分保证)。` },
        { k: '本步结果', v: st.act === 'converged' ? `6 个点全分对、零更新 → **收敛**!`
            : st.act === 'done' ? `学好:w=(${st.w.join(',')})、b=${st.b},共 ${st.updates} 次纠正。`
            : st.ok ? `score=${st.score},符号对 → 分对,不动。`
            : `score=${st.score},符号错 → 纠:w→(${st.w.join(',')})、b→${st.b},线转一下。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; act: string; updates: number; updated: boolean }
      return st.phase === 'done' ? `${st.updates} 次收敛` : st.act === 'converged' ? '收敛' : st.updated ? '纠正' : '分对'
    },
    read: [
      { at: '读数', is: '权重 w、偏置 b、纠正次数。', anchor: '.scdim' },
      { at: '平面', is: '蓝=正类、琥珀=负类,那条线是 w·x+b=0;当前点分对=绿圈、分错=红圈(触发纠正,线转一下)。', anchor: '.mlplot' },
    ],
    try: [
      { act: '按「下一步」逐点', watch: '符号对就跳过、符号错就纠(w+=y·x),线朝分错的点转一下。' },
      { act: '看它收敛', watch: '5 次纠正后某一整轮零错误——线学好了,两类干净分开。' },
    ],
    terms: [],
  },
  pooling: {
    question: '卷积后的特征图很大，怎么缩小它、又保住关键信号？',
    step: (s: never) => {
      const st = s as { phase: string; kindName: string; wr: number; wc: number; vals: number[]; result: number; out: (number | null)[][] }
      const filled = st.out ? st.out.flat().filter(x => x !== null).length : 0
      return [
        { k: '本步输入', v: st.wr < 0 ? '4×4 特征图' : st.phase === 'done' ? '4 块都汇总完' : `窗口 (${st.wr},${st.wc}) 盖住 [${st.vals.join(', ')}]` },
        { k: '判定规则', v: `2×2 窗口**不重叠**地扫,每块把 4 个数**汇总成 1 个**:${st.kindName}池化取${st.kindName === '平均' ? '**平均**(留整体强度)' : '**最大**(留最强响应)'}。图边长减半、面积变 1/4=降采样。无可学参数。` },
        { k: '本步结果', v: st.phase === 'done' ? `4×4 缩成 2×2(已填 ${filled}/4),降采样完成。`
            : st.wr < 0 ? '待扫。'
            : st.kindName === '平均' ? `平均=(${st.vals.join('+')})/4=**${st.result}**。`
            : `最大=**${st.result}**。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; kindName: string; result: number; wr: number }
      return st.phase === 'done' ? `${st.kindName}池化` : st.wr >= 0 ? `→${st.result}` : st.kindName
    },
    read: [
      { at: '读数', is: '汇总方式、尺寸变化、本块结果。', anchor: '.scdim' },
      { at: '两张图', is: '左=输入 4×4(琥珀框=当前 2×2 窗口),右=输出 2×2(绿=刚写入)。', anchor: '.cvwrap' },
    ],
    try: [
      { act: '按「下一步」扫窗口', watch: '2×2 窗口不重叠扫 4 个位置,每块汇总成 1 个数填进输出。' },
      { act: '切「汇总方式」', watch: '最大池化留最强(6/4/7/9)、平均池化留整体(3.75…);改了立即重跑。' },
    ],
    terms: [],
  },
  beam: {
    question: '大模型逐词生成整句，怎么不被"每步只贪当前最高"带进坑？',
    step: (s: never) => {
      const st = s as { phase: string; act: string; t: number; k: number; beamsIn: { seq: string; p: number }[]; cands: { seq: string; p: number }[]; kept: string[]; best: { seq: string; p: number }; greedy: { seq: string; p: number } }
      const d = (x: string) => x === '' ? '⟨起⟩' : x.replace('·', '⟨end⟩')
      return [
        { k: '本步输入', v: st.act === '' ? '从起点开始' : st.phase === 'done' ? `${st.k} 条终局候选` : `第 ${st.t} 步:${st.beamsIn.length} 条候选` },
        { k: '判定规则', v: `一句话概率=各步词概率**连乘**。维护 **k 条**候选(束宽=${st.k}),每步把每条各扩一个词、按**累积概率**排序,**只留前 k 条**继续、其余剪枝。k=1 就是贪心、k=∞ 就是全搜索。` },
        { k: '本步结果', v: st.phase === 'done' ? `束搜索 **${d(st.best.seq)}(${st.best.p})** 胜过贪心 ${d(st.greedy.seq)}(${st.greedy.p})——留住了贪心错过的更优整句。`
            : st.act === 'expand' ? `${st.cands.length} 候选留前 ${st.k}:${st.kept.map(d).join('、')}。`
            : `扩展中。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; t: number; best: { p: number }; greedy: { p: number } }
      return st.phase === 'done' ? `胜贪心 ${Math.round((st.best.p / (st.greedy.p || 1)) * 10) / 10}×` : `第${st.t}步`
    },
    read: [
      { at: '读数', is: '束宽 k、解码步、当前最优概率。', anchor: '.scdim' },
      { at: '候选/对照', is: '各步候选按累积概率排序、前 k 条绿✓保留其余剪掉;末步束搜索 vs 贪心对照。', anchor: '.bmwrap' },
    ],
    try: [
      { act: '按「下一步」解码', watch: '每步 k 条各扩一词→排序→只留前 k 条(绿),其余剪掉。' },
      { act: '看末步对照', watch: '贪心第一步贪 A 被锁进 0.10,束搜索留住 B 发现 0.288——近 3 倍胜出。' },
    ],
    terms: [],
  },
  rnn: {
    question: '一句话有长有短，网络怎么"记住"前面读过的、处理变长序列？',
    step: (s: never) => {
      const st = s as { phase: string; t: number; xt: number; hPrev: number; pre: number; ht: number; wx: number; wh: number; b: number; xs: number[] }
      return [
        { k: '本步输入', v: st.t === 0 ? `序列 [${st.xs.join(',')}],记忆 h₀=0` : st.phase === 'done' ? '整段读完' : `x=${st.xt},带着上一刻记忆 h=${st.hPrev}` },
        { k: '判定规则', v: `隐藏状态 **h(记忆)沿时间传递**。每读一个 x_t,用**同一套共享权重**把当前输入和上一刻记忆揉进新记忆:**h_t = tanh(wx·x_t + wh·h_{'{'}t-1{'}'} + b)**。权重所有时刻共享,能吃任意长序列。` },
        { k: '本步结果', v: st.phase === 'done' ? `记忆演化到末态 **${st.ht}**——它藏着整段历史(同样末输入、历史不同 h 就不同)。`
            : st.t === 0 ? '待读。'
            : `h_${st.t} = tanh(${st.wx}·${st.xt}+${st.wh}·${st.hPrev}) = tanh(${st.pre}) = **${st.ht}**,传给下一步。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; t: number; ht: number }
      return st.phase === 'done' ? `末态 ${st.ht}` : st.t > 0 ? `h=${st.ht}` : '记忆流动'
    },
    read: [
      { at: '读数', is: '时间步、当前输入、记忆 h、共享权重。', anchor: '.scdim' },
      { at: '时间链', is: '上排=记忆 h 沿时间流的传送带(蓝正/琥珀负、越深越大),下排=每步输入 x;h_t 同时吃当前 x 和上一刻 h。', anchor: '.rnnchain' },
    ],
    try: [
      { act: '按「下一步」读序列', watch: '每步 h_t=tanh(wx·x+wh·h_prev),记忆沿时间更新、往右传。' },
      { act: '想记忆的作用', watch: '同样最后输入 +2,历史 [2] 得 0.923、[−3] 得 0.269——h 记着过去。' },
    ],
    terms: [],
  },
  wordvec: {
    question: '怎么让计算机"懂"词的意思——还能做「国王−男人+女人=？」这种类比？',
    step: (s: never) => {
      const st = s as { phase: string; stage: string; dir: number[]; result: number[]; ranked: { name: string; d: number }[]; nearest: string }
      return [
        { k: '本步输入', v: st.stage === 'show' ? '几个词的坐标(王室度×性别)' : st.stage === 'sub' ? '国王(1,0)、男人(0,0)' : st.stage === 'add' ? `方向(${st.dir.join(',')}) 和 女人(0,1)` : `结果 (${st.result.join(',')})` },
        { k: '判定规则', v: `词向量把词变成**向量**:意思相近→位置相近,**语义关系→方向**。类比 A−B+C 用**向量加减**算出一个点,再找**离它最近的词**当答案。` },
        { k: '本步结果', v: st.stage === 'sub' ? `国王−男人 = (${st.dir.join(',')})——"王室"方向。`
            : st.stage === 'add' ? `+女人 = (${st.result.join(',')})。`
            : st.stage === 'find' ? `最近的词是 **${st.nearest}**(距离 ${st.ranked[0]?.d})。`
            : st.phase === 'done' ? `国王−男人+女人 = **${st.nearest}**——语义关系是可加减的方向。`
            : '把词摆进平面。' },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; stage: string; nearest: string }
      return st.phase === 'done' ? `=${st.nearest}` : st.stage === 'find' ? st.nearest : st.stage === 'sub' ? '王室方向' : '语义空间'
    },
    read: [
      { at: '读数', is: '要算的类比、结果向量、最近的词。', anchor: '.scdim' },
      { at: '语义空间', is: '词=平面上的点(横轴王室度、纵轴性别);琥珀箭头=国王−男人的方向,接到女人上(虚线)、终点 ⊕ 最近的词高亮。', anchor: '.wvplotbox' },
    ],
    try: [
      { act: '按「下一步」做类比', watch: '国王−男人得"王室"方向→接到女人上→终点落在王后附近。' },
      { act: '想方向的含义', watch: '"男→女""平民→王室"是两个方向,能像箭头一样加减——这就是语义算术。' },
    ],
    terms: [],
  },
  lstm: {
    question: '普通 RNN 长序列就"忘"了，怎么让记忆稳稳传很远？',
    step: (s: never) => {
      const st = s as { phase: string; t: number; role: string; f: number; ig: number; o: number; ctil: number; cPrev: number; c: number; h: number }
      return [
        { k: '本步输入', v: st.t === 0 ? '空记忆 c₀=0' : st.phase === 'done' ? '走完 4 步' : `第 ${st.t} 步(${st.role}):门 f=${st.f} i=${st.ig} o=${st.o}` },
        { k: '判定规则', v: `另开一条**细胞状态 c(传送带)**:**c_t = f·c_{'{'}t-1{'}'} + i·c̃**(加法为主、近乎线性)。遗忘门 **f** 留多少旧记忆、输入门 **i** 写多少新内容、输出门 **o** 放多少:**h = o·tanh(c)**。f≈1、i≈0 记忆就原样传很远。` },
        { k: '本步结果', v: st.phase === 'done' ? `传送带全程稳在 **${st.c}**——存进去被原样扛到末尾、再取出 ${st.h}。这是 RNN 做不到的长期记忆。`
            : st.role === '存' ? `开输入门 → c=${st.c},写入记忆。`
            : st.role === '守' ? `f=1、i=0 → c=1·${st.cPrev}=**${st.c}**,记忆原样传下去。`
            : st.role === '取' ? `开输出门 → h=tanh(${st.c})=**${st.h}**,放出记忆。`
            : '待走。' },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; role: string; c: number }
      return st.phase === 'done' ? `守住 ${st.c}` : st.role || '门控'
    },
    read: [
      { at: '读数', is: '细胞状态 c(记忆)、隐藏 h、三个门、本步动作。', anchor: '.scdim' },
      { at: '传送带+门', is: '上=cell 记忆传送带(全程稳在 0.8),下=三个门(绿开/灰关):遗忘 f、输入 i、输出 o。', anchor: '.lstmwrap' },
    ],
    try: [
      { act: '按「下一步」走 4 步', watch: '存(开输入门)→守守(f=1 i=0,c 不变)→取(开输出门)。' },
      { act: '盯 cell 传送带', watch: 'c 全程稳在 0.8——记忆被原封不动扛过来,这正是 RNN 会丢的。' },
    ],
    terms: [],
  },
  norm: {
    question: 'BatchNorm 和 LayerNorm 都在做归一化，到底差在哪？',
    step: (s: never) => {
      const st = s as { phase: string; kindName: string; axis: string; slice: number; vals: number[]; mu: number; sigma: number }
      const isB = st.axis === 'col'
      return [
        { k: '本步输入', v: st.slice < 0 ? '4 样本 × 3 特征的激活表' : st.phase === 'done' ? '全部片归一化完' : `${isB ? `特征 f${st.slice + 1}(一列)` : `样本 s${st.slice + 1}(一行)`} [${st.vals.join(',')}]` },
        { k: '判定规则', v: `都是 **x̂=(x−μ)/√(σ²+ε)**,把一片激活拉成零均值单位方差。分歧只在**沿哪条轴**统计:**BatchNorm** 对每个**特征**、在一批**样本**上算(沿列);**LayerNorm** 对每个**样本**、在它自己**所有特征**上算(沿行)。` },
        { k: '本步结果', v: st.phase === 'done' ? `每${isB ? '个特征(列)' : '个样本(行)'}都零均值单位方差。BatchNorm 依赖 batch(CNN 常用)、LayerNorm 不依赖(Transformer 标配)。`
            : st.slice < 0 ? '待算。'
            : `μ=${st.mu}、σ=${st.sigma} → (x−μ)/σ。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; kindName: string; mu: number; sigma: number; slice: number }
      return st.phase === 'done' ? '已归一化' : st.slice >= 0 ? `μ=${st.mu} σ=${st.sigma}` : st.kindName
    },
    read: [
      { at: '读数', is: '归一化方式、沿哪条轴、本片 μ/σ。', anchor: '.scdim' },
      { at: '两张表', is: '左=输入(4 样本×3 特征),琥珀=当前归一化的一列(BatchNorm)或一行(LayerNorm);右=输出。', anchor: '.nmwrap' },
    ],
    try: [
      { act: '按「下一步」逐片归一', watch: 'BatchNorm 一列列(每个特征跨样本)、LayerNorm 一行行(每个样本跨特征)。' },
      { act: '切「归一化方式」', watch: '同一个 (x−μ)/σ 公式,只是统计的轴不同——BatchNorm 沿列、LayerNorm 沿行。' },
    ],
    terms: [],
  },
  rag: {
    question: '大模型会过时、记不住私有资料、还爱编造，怎么让它答得有据可查？',
    step: (s: never) => {
      const st = s as { phase: string; stage: string; query: string; docs: { t: string; sim: number | null }[]; retrieved: number[]; answer: string; topK: number }
      return [
        { k: '本步输入', v: st.stage === 'query' ? `问题「${st.query}」+ 知识库 ${st.docs.length} 篇` : st.stage === 'score' ? '查询向量 vs 每篇文档' : st.stage === 'retrieve' ? `${st.docs.length} 篇的相似度` : st.stage === 'augment' ? `检索到的 ${st.topK} 篇` : '增强后的提示词' },
        { k: '判定规则', v: `RAG 三步:①**检索**——问题编码成查询向量,和库里每篇比**相似度**(内积/余弦),取最相关 top-${st.topK}(这步=**向量最近邻**);②**增强**——把它们拼进提示词当上下文;③**生成**——模型据此作答。` },
        { k: '本步结果', v: st.stage === 'score' ? '讲"猫吃"的两篇相似度最高、无关的(汽车/植物)接近 0。'
            : st.stage === 'retrieve' ? `检索到「${st.docs[st.retrieved[0]]?.t}」「${st.docs[st.retrieved[1]]?.t}」,无关的丢掉。`
            : st.stage === 'augment' ? '把 2 篇拼进上下文,模型开卷作答。'
            : st.phase === 'done' ? `据此答「${st.answer}」——**有出处**、不靠瞎记。`
            : '去库里找相关资料。' },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; stage: string; retrieved: number[] }
      return st.phase === 'done' ? '据此作答' : st.stage === 'retrieve' ? `命中 ${st.retrieved.length}` : st.stage === 'score' ? '算相似度' : '检索中'
    },
    read: [
      { at: '读数', is: '当前阶段、知识库篇数、命中的文档、答案。', anchor: '.scdim' },
      { at: '知识库', is: '每篇文档的相似度条(越长越相关),绿=被检索的 top-k、灰=落选;下方是增强后的提示词与答案。', anchor: '.raglib' },
    ],
    try: [
      { act: '按「下一步」跑三步', watch: '算相似度→检索 top-2(绿)→拼进上下文→据此作答。' },
      { act: '看无关文档', watch: '汽车、植物相似度接近 0、落选——检索只留跟问题最相关的。' },
    ],
    terms: [],
  },
  selfconsist: {
    question: '单条推理一步错就全错，怎么让大模型的数学/推理答得更稳？',
    step: (s: never) => {
      const st = s as { phase: string; chains: { r: string; a: number; ok: boolean }[]; n: number; tally: [number, number][]; winner: number; correct: number }
      const last = st.chains[st.chains.length - 1]
      return [
        { k: '本步输入', v: st.chains.length === 0 ? `一道题(正解 ${st.correct})` : st.phase === 'done' ? `${st.n} 条链的答案` : `第 ${st.chains.length} 条链:${last?.r}` },
        { k: '判定规则', v: `对同一题**采样 N 条不同的推理链**(温度制造多样),每条独立推到一个答案,最后**多数投票**取出现最多的。正确推法往往多条且一致,错法各异——所以多数票能把少数算错的淹没。` },
        { k: '本步结果', v: st.phase === 'done' ? `${st.tally.map(([a, n]) => `${a}×${n}`).join('、')} → **${st.winner} 胜出**(正解 ${st.correct}${st.winner === st.correct ? '✓' : '✗'})。`
            : st.chains.length === 0 ? '开始采样。'
            : `→ ${last.a}${last.ok ? '' : '(算错)'};当前 ${st.tally[0][0]} 领先(${st.tally[0][1]} 票)。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; chains: unknown[]; n: number; winner: number }
      return st.phase === 'done' ? `${st.winner} 胜出` : `${st.chains.length}/${st.n} 链`
    },
    read: [
      { at: '读数', is: '已采样链数、当前多数票、正解。', anchor: '.scdim' },
      { at: '链与投票', is: '每条推理链的算式+答案(绿对/红错),下方投票条,胜出的答案高亮。', anchor: '.scwrap' },
    ],
    try: [
      { act: '按「下一步」采样', watch: '一条条推理链冒出来,票数实时累加。' },
      { act: '看多数投票', watch: '3 条殊途同归到 17、2 条各自算错——多数票 17 胜出,救回了正确答案。' },
    ],
    terms: [],
  },
  bestofn: {
    question: '生成质量时好时坏，怎么稳定地拿到更好的那个输出？',
    step: (s: never) => {
      const st = s as { phase: string; cands: { e: string; r: number; reward: number }[]; n: number; bestIdx: number; target: number }
      const last = st.cands[st.cands.length - 1]
      const best = st.cands[st.bestIdx]
      return [
        { k: '本步输入', v: st.cands.length === 0 ? `任务:凑近 ${st.target}` : st.phase === 'done' ? `${st.n} 个候选的分数` : `第 ${st.cands.length} 个候选:${last?.e}=${last?.r}` },
        { k: '判定规则', v: `**采样 N 个**候选,每个交给**打分器**评分(奖励模型 或 可算的验证器),最后 **argmax 取最高分**的那个。和自洽的多数投票不同——这里靠**外部打分器选单个最好**,适合开放式生成。` },
        { k: '本步结果', v: st.phase === 'done' ? `「${best?.e}」得 ${best?.reward} 分最高 → **采纳**。`
            : st.cands.length === 0 ? '开始采样。'
            : `${last?.e}=${last?.r} 得 **${last?.reward}** 分;当前最高「${best?.e}」(${best?.reward})。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; cands: { reward: number }[]; n: number; bestIdx: number }
      return st.phase === 'done' ? `取 ${st.cands[st.bestIdx]?.reward} 分` : `${st.cands.length}/${st.n}`
    },
    read: [
      { at: '读数', is: '已采样候选数、当前最高分、目标。', anchor: '.scdim' },
      { at: '候选与分', is: '每个候选的算式+结果+奖励条(越长分越高),★=当前最高分。', anchor: '.bncands' },
    ],
    try: [
      { act: '按「下一步」采样', watch: '候选一个个冒出、各自打分,★最高分实时更新。' },
      { act: '想它和自洽的区别', watch: '自洽数票(多数投票)、Best-of-N 看分(打分器择优)——一个投票、一个打分。' },
    ],
    terms: [],
  },
  tot: {
    question: '思维链错一步就没回头路，怎么让模型像下棋那样探索、试错、回溯？',
    step: (s: never) => {
      const st = s as { phase: string; stage: string; root: string; target: number; thoughts: { pruned: boolean; sure: boolean }[]; solution: string }
      const pruned = st.thoughts.filter(t => t.pruned).length
      const sure = st.thoughts.filter(t => t.sure && !t.pruned).length
      return [
        { k: '本步输入', v: st.stage === 'root' || st.stage === '' ? `${st.root} 凑 ${st.target}` : st.stage === 'generate' ? `根 ${st.root}` : `${st.thoughts.length} 个候选分支` },
        { k: '判定规则', v: `把中间状态当**树节点**:每步①**生成多个想法分支**②用**评估器**判前景(能否通向解:sure/impossible)③**剪掉**没希望的④沿有希望的**搜索**(可**回溯**换分支)。比 CoT 单线、自洽独立多线更进一步。` },
        { k: '本步结果', v: st.stage === 'generate' ? `展开出 ${st.thoughts.length} 个中间状态(分支)。`
            : st.stage === 'evaluate' ? `${sure} 个有希望(sure)、${st.thoughts.length - sure} 个死路(impossible)。`
            : st.stage === 'prune' ? `剪掉 ${pruned} 个死路分支,留有希望的。`
            : st.stage === 'expand' ? `沿 {12,2} 展开:12×2=24 ✓ 找到解。`
            : st.phase === 'done' ? `**解出** ${st.solution}=${st.target}——生成→评估→剪枝→搜索。`
            : '展开树。' },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; stage: string }
      return st.phase === 'done' ? '解出' : st.stage === 'prune' ? '剪枝' : st.stage === 'evaluate' ? '评估' : st.stage === 'expand' ? '搜索' : '展开'
    },
    read: [
      { at: '读数', is: '起始数字、目标、已剪枝分支数、解。', anchor: '.scdim' },
      { at: '想法树', is: '根=起始数字,每条边一步运算得一个中间状态(分支);绿=有希望、红虚线=死路(剪掉);沿有希望的展开到解。', anchor: '.tottree' },
    ],
    try: [
      { act: '按「下一步」建树', watch: '生成分支→评估前景→剪掉死路→沿有希望的搜到解。' },
      { act: '对比 CoT/自洽', watch: 'CoT 一条线、自洽独立多线,ToT 是能评估+剪枝+回溯的树。' },
    ],
    terms: [],
  },
  mcts: {
    question: '下棋走法多到没法全搜，怎么把有限的思考花在最有希望的走法上？',
    step: (s: never) => {
      const st = s as { phase: string; iter: number; moves: string[]; n: number[]; w: number[]; ucb: (number | null)[]; pick: number; win: number; best: number }
      return [
        { k: '本步输入', v: st.iter === 0 && st.phase !== 'done' ? '根有 3 个候选走法 A/B/C' : st.phase === 'done' ? '各走法的访问次数' : `第 ${st.iter} 轮的 UCB` },
        { k: '判定规则', v: `每轮四步:**选择**(按 **UCB=胜率+c·√(ln N父/N子)** 挑分支,胜率高多利用、试得少多探索)→**扩展**→**模拟**(随机走到底看输赢)→**回传**(更新沿途 N、胜数)。多轮后访问集中到最好的走法。` },
        { k: '本步结果', v: st.phase === 'done' ? `访问 ${st.moves.map((m, k) => `${m}=${st.n[k]}`).join('、')} → 选 **${st.moves[st.best]}**(被反复模拟、几乎全赢)。`
            : st.pick < 0 ? '待模拟。'
            : `UCB 最大是 ${st.moves[st.pick]}${st.ucb[st.pick] === null ? '(没试过∞,先探索)' : ''} → 模拟**${st.win ? '赢' : '输'}**、回传。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; iter: number; moves: string[]; best: number; win: number }
      return st.phase === 'done' ? `选 ${st.moves[st.best]}` : st.win === 1 ? '模拟赢' : st.win === 0 ? '模拟输' : `第${st.iter}轮`
    },
    read: [
      { at: '读数', is: '模拟轮、本轮选中的走法+UCB、各走法访问次数。', anchor: '.scdim' },
      { at: '树', is: '根+3走法;圆越大=访问越多;每轮挑 UCB 最大的模拟、回传;绿=本轮/最终选中。', anchor: '.gcntree' },
    ],
    try: [
      { act: '按「下一步」模拟', watch: '每轮挑 UCB 最大的走法(没试过=∞先试)、随机模拟、回传更新访问数。' },
      { act: '看火力集中', watch: 'A 总赢 → 被越选越多、圆越来越大;探索与利用的平衡。' },
    ],
    terms: [],
  },
  collision: {
    question: '一堆小球乱糟糟地碰来碰去，有什么东西是始终不变的？',
    step: (s: never) => {
      const st = s as { phase: string; n: number }
      return [
        { k: '本步输入', v: st.phase === 'init' ? `${st.n} 个小球带着初速度出发` : '小球们正在盒子里弹性碰撞' },
        { k: '判定规则', v: `实时物理引擎(Matter.js)求解**弹性碰撞**:每次碰撞按动量守恒、动能守恒的规律,把速度在两球间重新分配。无摩擦、四壁弹性反弹。` },
        { k: '本步结果', v: st.phase === 'init' ? '总动能、总动量此刻是初值,球各自朝不同方向飞。'
            : '有的球被撞快、有的被撞慢,单看一个球速度乱变——但**所有球加起来,总动能、总动量守恒**(读数基本不动)。' },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string }
      return st.phase === 'run' ? '守恒' : '就绪'
    },
    read: [
      { at: '读数', is: '总动能、总动量大小、小球数——碰撞中总量基本不变(守恒)。', anchor: '.scdim' },
      { at: '沙盘', is: '实时物理仿真:拖动小球甩它、加球看多体、开重力看它们落底堆叠。', anchor: '.colcanvas' },
    ],
    try: [
      { act: '拖一个球甩出去', watch: '它撞到别的球,把动能/动量传过去;但上方总动能读数基本不变。' },
      { act: '加球 / 开重力', watch: '多体碰撞更热闹;开重力则失去竖直方向守恒、球落到底部堆叠。' },
    ],
    terms: [],
  },
  gcn: {
    question: '社交网络、分子这种「图」数据，神经网络怎么处理？',
    step: (s: never) => {
      const st = s as { phase: string; cur: number; agg: number[]; result: number; feat: number[]; newFeat: (number | null)[] }
      return [
        { k: '本步输入', v: st.cur < 0 && st.phase !== 'done' ? '5 节点图,节点 0、4 特征=1' : st.phase === 'done' ? '一层聚合完' : `节点 ${st.cur} 及其邻居` },
        { k: '判定规则', v: `图卷积一层:每个节点把**自己+所有邻居**的特征**平均**(聚合)成新特征——信息沿边渗一跳。真实 GCN 聚合后再乘可学权重 W、过激活。叠 L 层传 L 跳。` },
        { k: '本步结果', v: st.phase === 'done' ? `新特征 [${(st.newFeat as number[]).join(', ')}]——相连节点变相似,信息渗了一跳。`
            : st.cur < 0 ? '待聚合。'
            : `节点 ${st.cur}:(${st.agg.map(u => st.feat[u]).join('+')})/${st.agg.length} = **${st.result}**。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; cur: number; result: number }
      return st.phase === 'done' ? '渗一跳' : st.cur >= 0 ? `→${st.result}` : '聚合'
    },
    read: [
      { at: '读数', is: '当前聚合的节点、新特征值、感受野。', anchor: '.scdim' },
      { at: '图', is: '颜色深=特征值大;琥珀圈=正更新的节点、绿圈=它的邻居;把自己+邻居的特征平均=新特征。', anchor: '.gcntree' },
    ],
    try: [
      { act: '按「下一步」逐个聚合', watch: '每个节点把自己+邻居的特征平均;节点 0、4 的"1"顺边分给邻居。' },
      { act: '想叠多层', watch: '一层传一跳,叠 L 层传 L 跳——节点表示概括越来越大的邻域。' },
    ],
    terms: [],
  },
  pagerank: {
    question: '网页那么多，怎么判断哪个更重要、该排在前面？',
    step: (s: never) => {
      const st = s as { phase: string; iter: number; rank: number[]; nodes: string[]; ranked: { name: string; r: number }[]; d: number }
      return [
        { k: '本步输入', v: st.iter === 0 && st.phase !== 'done' ? '4 个网页,初始 rank 各 0.25' : st.phase === 'done' ? '各页 rank 已稳定' : `第 ${st.iter} 轮的 rank` },
        { k: '判定规则', v: `一个页面的重要性 = 有多少、多重要的页面链到它(链接=投票,重要页面的票更值钱)。**幂迭代**:每页把 rank **平分**给它链出的页面,收方求和,再混入随机跳转(阻尼 d=${st.d})。反复迭代到收敛。` },
        { k: '本步结果', v: st.phase === 'done' ? `收敛排名 **${st.ranked.map(x => x.name).join(' > ')}**——${st.ranked[0].name} 最高(最多、最重要的页面链它)。`
            : st.iter === 0 ? '每页起点都一样。'
            : `${st.nodes.map((n, k) => `${n}=${st.rank[k]}`).join('、')};重要性在页面间流动、逐渐稳定。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; iter: number; ranked: { name: string }[] }
      return st.phase === 'done' ? `${st.ranked[0].name} 胜` : st.iter === 0 ? '初始' : `第${st.iter}轮`
    },
    read: [
      { at: '读数', is: '当前迭代轮、最高的页面、最高 rank。', anchor: '.scdim' },
      { at: '图+条', is: '节点越大=rank 越高;箭头=链接(投票)。每轮把 rank 平分给链出页,重要性流动、几轮收敛。', anchor: '.prwrap' },
    ],
    try: [
      { act: '按「下一步」迭代', watch: '每轮重要性顺箭头流动、重新分配;节点大小实时变。' },
      { act: '看谁胜出', watch: 'C 被最多、最重要的页面链到 → 收敛后 rank 最高;D 没人链 → 最低。' },
    ],
    terms: [],
  },
  qlearn: {
    question: '走迷宫只有终点才有奖励，怎么知道中间每一步该往哪走？',
    step: (s: never) => {
      const st = s as { phase: string; ring: number; gamma: number; path: string[] }
      return [
        { k: '本步输入', v: st.ring < 0 && st.phase !== 'done' ? '只有终点 ★ 有 +1 奖励' : st.phase === 'done' ? '价值满图、策略学好' : st.ring === 0 ? '终点拿到 +1' : `离终点 ${st.ring} 步的一圈格子` },
        { k: '判定规则', v: `给每格估一个**价值**(从这出发未来总回报)。**Bellman**:格子价值 = 即时奖励 + γ×下一格价值。于是终点的 +1 顺规则**一圈圈倒推**,每远一步打 γ=${st.gamma} 折。策略=往价值最高的邻居走。` },
        { k: '本步结果', v: st.phase === 'done' ? `跟着策略箭头从起点走到终点=最优 **${st.path.length - 1}** 步——没人教、靠试错+倒推自己学出来。`
            : st.ring <= 0 ? '价值从终点开始往外倒推。'
            : `价值 = 0.9^${st.ring} = **${Math.round(Math.pow(st.gamma, st.ring) * 1000) / 1000}**,箭头指向终点。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; ring: number; path: string[] }
      return st.phase === 'done' ? `最优 ${st.path.length - 1} 步` : st.ring < 0 ? '试错' : `第${st.ring}圈`
    },
    read: [
      { at: '读数', is: '价值倒推到第几圈、折扣 γ、本圈价值、最优路线长。', anchor: '.scdim' },
      { at: '迷宫', is: '格子越绿=价值越高;★=终点(+1)、S=起点;箭头=策略(该往哪走);价值像波纹从终点倒推。', anchor: '.asgrid' },
    ],
    try: [
      { act: '按「下一步」看倒推', watch: '价值从终点一圈圈往外传,每远一步×γ=0.9(0.9→0.81→0.729…)。' },
      { act: '看策略箭头', watch: '每格箭头指向价值更高的邻居——跟着走就是最优路线,还不用提前知道地图。' },
    ],
    terms: [],
  },
  recsys: {
    question: '你只看过几部电影，平台怎么猜你对没看过的会打几分？',
    step: (s: never) => {
      const st = s as { phase: string; stage: string; users: { n: string; v: number[] }[]; movies: { n: string; v: number[] }[]; rating: (number | null)[][]; pr: number; pc: number }
      return [
        { k: '本步输入', v: st.stage === 'matrix' || st.stage === '' ? '评分表,大半空缺' : st.stage === 'userv' ? '每个用户的口味' : st.stage === 'moviev' ? '每个电影的属性' : `${st.users[st.pr]?.n} 没看过 ${st.movies[st.pc]?.n}` },
        { k: '判定规则', v: `矩阵分解:给每个用户、每个电影各学一个**隐向量**(压进低维隐空间),让 **评分 ≈ 用户隐向量·电影隐向量**(内积)。已知评分学隐向量,空缺处用内积**预测**。口味和属性对得上=内积大=推荐。` },
        { k: '本步结果', v: st.stage === 'userv' ? '小明=(1,0)只爱动作、小红=(0,1)只爱文艺。'
            : st.stage === 'moviev' ? '盗梦=(4,3)动作+烧脑;已知评分都=内积,对得上。'
            : st.stage === 'predict' ? `${st.users[st.pr]?.n}·${st.movies[st.pc]?.n}=(${st.users[st.pr]?.v})·(${st.movies[st.pc]?.v})=**${st.rating[st.pr][st.pc]}** 分。`
            : st.phase === 'done' ? `补全:给小明推盗梦(4)、不推小森林(0,纯文艺不对味)。`
            : '待分解。' },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; stage: string; rating: (number | null)[][]; pr: number; pc: number }
      return st.phase === 'done' ? '补全' : st.stage === 'predict' ? `预测 ${st.rating[st.pr]?.[st.pc]}` : st.stage === 'userv' ? '用户向量' : st.stage === 'moviev' ? '电影向量' : '评分表'
    },
    read: [
      { at: '读数', is: '预测评分、隐空间维度、已填格数。', anchor: '.scdim' },
      { at: '评分表', is: '绿=已知评分、? =空缺;行/列标着用户/电影的隐向量;评分=两向量内积。', anchor: '.rstable' },
    ],
    try: [
      { act: '按「下一步」分解', watch: '露出用户口味向量、电影属性向量;已知评分=它们的内积。' },
      { act: '看预测空缺', watch: '小明·盗梦=(1,0)·(4,3)=4 分;口味和属性合拍就推荐。' },
    ],
    terms: [],
  },
  diffusion: {
    question: '怎么让 AI 从一团随机噪声里，"画"出一张全新的图？',
    step: (s: never) => {
      const st = s as { phase: string; dir: string; t: number; sqrtA: number; sqrtN: number }
      return [
        { k: '本步输入', v: st.dir === '' ? '一张 8×8 小图 ❤' : st.dir === 'forward' ? `噪声级 ${st.t} 的图` : st.phase === 'done' ? '纯噪声' : `噪声级 ${st.t + 1} 的图` },
        { k: '判定规则', v: `扩散=先学破坏、再学修复。**前向**给图一步步掺高斯噪声(x=√ᾱ·原图+√(1−ᾱ)·ε),几十步变纯噪声——**固定不用学**。**反向**训练网络**预测并去掉每步的噪声**;从随机噪声去噪就=生成。` },
        { k: '本步结果', v: st.phase === 'done' ? `从纯噪声一步步去噪,"磨"出了新图——这就是生成。`
            : st.dir === 'forward' ? `√ᾱ=${st.sqrtA}(信号)、√(1−ᾱ)=${st.sqrtN}(噪声),图渐被淹没。`
            : `网络减掉噪声,回到 √ᾱ=${st.sqrtA},图像浮现。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; dir: string }
      return st.phase === 'done' ? '生成✓' : st.dir === 'forward' ? '加噪' : '去噪'
    },
    read: [
      { at: '读数', is: '方向(加噪/去噪)、噪声级、√ᾱ 信号、√(1-ᾱ) 噪声。', anchor: '.scdim' },
      { at: '图', is: '8×8 小图(深=亮);前向被噪声淹没、反向从噪声浮现。', anchor: '.dfgrid' },
    ],
    try: [
      { act: '按「下一步」看加噪', watch: '前向每步 x=√ᾱ·原图+√(1−ᾱ)·噪声,图渐渐变纯噪声。' },
      { act: '看反向去噪', watch: '网络一步步去噪,图像从噪声里浮现——这就是生成。' },
    ],
    terms: [],
  },
  gan: {
    question: '不预设分布，怎么让 AI 生成以假乱真的数据？',
    step: (s: never) => {
      const st = s as { phase: string; round: number; acc: number; fakeInside: number }
      return [
        { k: '本步输入', v: st.round === 0 && st.phase !== 'done' ? '真数据(蓝) + G 造的假数据(红)' : st.phase === 'done' ? 'G、D 较劲到均衡' : `第 ${st.round} 轮的真/假数据` },
        { k: '判定规则', v: `对抗博弈:**生成器 G** 造假想骗过审查、**判别器 D** 学着分辨真假。G 要**骗过 D**、D 要**抓住 G**,轮流进步。均衡处 G 的假分布=真分布、D 分不出(准确率→50%)。` },
        { k: '本步结果', v: st.phase === 'done' ? `假数据和真数据难分难解,D 准确率掉到 **${st.acc}%**(瞎猜)——G 学会了生成。`
            : st.round === 0 ? `G 造的假数据乱撒,D 一眼看穿,准确率 ${st.acc}%。`
            : `G 造得更像,${st.fakeInside}/6 假数据混进真区骗过 D,D 准确率掉到 **${st.acc}%**。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; round: number; acc: number }
      return st.phase === 'done' ? `D ${st.acc}%` : `第${st.round}轮`
    },
    read: [
      { at: '读数', is: 'D 判别准确率、骗过 D 的假数据数、对抗轮。', anchor: '.scdim' },
      { at: '散点', is: '蓝=真数据、红=G 造的假数据、虚线圈=D 认作真的区;红点逐轮逼近蓝点分布。', anchor: '.mlplot' },
    ],
    try: [
      { act: '按「下一步」对抗', watch: 'G 造的红点逐轮逼近蓝点,混进虚线圈骗过 D。' },
      { act: '看 D 准确率', watch: '假越像真,D 越难分,准确率从 100% 掉到 50%——掉到 50% 就是 G 赢了。' },
    ],
    terms: [],
  },
  conv: {
    question: '不用给整张图接一大堆权重，怎么让网络"看见"边缘、纹理？',
    step: (s: never) => {
      const st = s as { phase: string; kernelName: string; ci: number; cj: number; curVal: number; out: (number | null)[][] }
      const done = st.out ? st.out.flat().filter(x => x !== null).length : 0
      return [
        { k: '本步输入', v: st.phase === 'done' ? `${st.kernelName}核滑完 9 处` : st.ci >= 0 ? `核滑到窗口 (${st.ci},${st.cj})` : `${st.kernelName}核` },
        { k: '判定规则', v: `卷积核在图上滑窗,每处把核和底下像素**逐位相乘再相加**(点积)=一个数,拼成特征图。核共享权重、平移不变。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `${st.kernelName === '边缘' ? '边缘核在明暗交界响应最强(±27)、平坦≈0——"看见"了边缘' : st.kernelName === '模糊' ? '模糊核把边缘抹平了' : '锐化核把边缘提得更亮'}。`
            : st.ci >= 0 ? `本格加权和 = **${st.curVal}**(已算 ${done}/9)。` : `按「下一步」滑窗。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; kernelName: string; ci: number; cj: number }
      return st.phase === 'done' ? `${st.kernelName}特征` : st.ci >= 0 ? `(${st.ci},${st.cj})` : st.kernelName
    },
    read: [
      { at: '读数', is: '卷积核、窗口位置、本格加权和、已算几格。', anchor: '.scdim' },
      { at: '三个格', is: '输入图(亮=大值)+滑窗(蓝框)、核、特征图(填色);左中右对应"⊙ ="。', anchor: '.cvwrap' },
    ],
    try: [
      { act: '按「下一步」让核滑窗', watch: '蓝框在输入图上一格格移,特征图对应格逐个填出。' },
      { act: '换「卷积核」', watch: '边缘核在交界处亮、模糊核抹平、锐化核提中心——不同核提不同特征。' },
    ],
    terms: [],
  },
  linreg: {
    question: '先从拟合一条线看起：机器"学习"到底在学什么？',
    step: (s: never) => {
      const st = s as { phase: string; gdStep: number; w: number; b: number; mse: number; wOls: number; bOls: number }
      return [
        { k: '本步输入', v: st.phase === 'done' ? '梯度下降 50 步' : `第 ${st.gdStep} 步梯度下降` },
        { k: '判定规则', v: `损失=MSE(点到直线竖直距离的平方平均);沿负梯度调 w、b 让 MSE 下降。收敛到最小二乘闭式解。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `直线 y=${st.w}x+${st.b}、MSE **${st.mse}**,正好=OLS(w=${st.wOls} b=${st.bOls})——找到数学最优线。`
            : `直线 y=**${st.w}**x+**${st.b}**,MSE **${st.mse}**${st.gdStep === 0 ? '(还平、残差大)' : '(往点云里转)'}。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; gdStep: number; mse: number }
      return st.phase === 'done' ? `MSE ${st.mse.toFixed(2)}` : `步${st.gdStep}·${st.mse.toFixed(1)}`
    },
    read: [
      { at: '读数', is: '梯度下降步、MSE、当前直线、OLS 最优。', anchor: '.scdim' },
      { at: '散点图', is: '蓝点=数据;橙线=拟合直线;红色竖虚线=残差(点到线的竖直距离)。', anchor: '.mlplot' },
    ],
    try: [
      { act: '按「下一步」推进梯度下降', watch: '直线从平的转进点云、残差竖线一根根变短、MSE 降。' },
      { act: '看收敛', watch: 'w→2.22、b→0.92,正好等于最小二乘闭式解——梯度下降找到了最优。' },
    ],
    terms: [],
  },
  pp: {
    question: '按层把模型切到多卡，为什么会有"气泡"？怎么填掉？',
    step: (s: never) => {
      const st = s as { phase: string; stages: number; micro: number; t: number; totalTime: number; busy: number[]; util: number; bubblePct: number }
      const active = st.busy ? st.busy.filter(m => m >= 0).length : 0
      return [
        { k: '本步输入', v: st.phase === 'done' ? `${st.stages} 级流水线、${st.micro} 微批` : `时刻 ${st.t + 1}/${st.totalTime}` },
        { k: '判定规则', v: `按层切成 G 级流水线;把 batch 切 M 个微批首尾衔接流进来。稳态 G 卡同时各算一个,气泡=(G−1)/(M+G−1)。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `利用率 **${st.util}%**、气泡 **${st.bubblePct}%**——微批越多气泡越小。`
            : active === st.stages ? `**满载**:${st.stages} 张卡各算一个微批。`
            : st.t < st.stages - 1 ? `**注入中**:才 ${active} 张卡在算,其余空等(气泡)。` : `**排空中**:只剩 ${active} 张卡收尾。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; t: number; totalTime: number; bubblePct: number }
      return st.phase === 'done' ? `气泡 ${st.bubblePct}%` : `t${st.t + 1}/${st.totalTime}`
    },
    read: [
      { at: '读数', is: '流水级、微批数、利用率、气泡。', anchor: '.scdim' },
      { at: '调度表', is: '行=卡、列=时刻;彩格=在算某微批 μ,灰格=气泡。', anchor: '.ppgrid' },
    ],
    try: [
      { act: '一步步走完一轮', watch: '开头几张卡空等(注入气泡)、中段满载、结尾排空。' },
      { act: '把「微批数」调到 8', watch: '中段满载更长、气泡从 43% 降到 27%——微批越多越省。' },
    ],
    terms: [],
  },
  ep: {
    question: 'MoE 的专家又多又大，一张卡放不下——怎么分到多卡、代价是什么？',
    step: (s: never) => {
      const st = s as { phase: string; gpus: number; experts: number; expertsPerGpu: number; load: number[]; maxLoad: number; minLoad: number }
      return [
        { k: '本步输入', v: st.phase === 'done' ? `${st.experts} 专家 → ${st.gpus} 卡` : ({ setup: `${st.experts} 专家分到 ${st.gpus} 卡`, route: 'token 路由挑专家', dispatch: 'all-to-all 派发', compute: '各卡算+收回' } as Record<string, string>)[st.phase] },
        { k: '判定规则', v: `EP 把 E 个专家分片(每卡 E/G 个)省显存;token 挑中的专家在别的卡就 all-to-all 派过去;路由不均→热专家那卡过载。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `分片省显存,代价=all-to-all + 负载不均(最忙 ${st.maxLoad} vs 最闲 ${st.minLoad})。MoE 常配 DP-attn + EP。`
            : st.phase === 'setup' ? `每卡放 **${st.expertsPerGpu}** 个专家。`
            : st.phase === 'route' ? `每 token 挑一个专家(专家 3 偏热)。`
            : st.phase === 'dispatch' ? `token 送到专家所在卡（跨卡通信）。`
            : `每卡负载 [${st.load.join(', ')}]:热专家那卡过载 **${st.maxLoad}**、别的闲 **${st.minLoad}**。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; maxLoad: number; minLoad: number }
      return st.phase === 'done' ? (st.maxLoad > st.minLoad ? `负载 ${st.maxLoad}/${st.minLoad}` : '均衡') : st.phase
    },
    read: [
      { at: '读数', is: '专家→卡、每卡专家数、负载最忙/最闲。', anchor: '.scdim' },
      { at: 'token 行', is: '每个 token 挑的专家;专家 3(红)偏热。', anchor: '.eptokens' },
      { at: 'GPU 盒子', is: '每卡放哪些专家 + 收到的 token + 负载条;过载卡标红。', anchor: '.epgpus' },
    ],
    try: [
      { act: '走 路由→派发→算 三步', watch: 'token 按专家 all-to-all 跳到对应卡;热专家那卡负载最高。' },
      { act: '调「卡数」', watch: '每卡专家数变(E/G),负载分布跟着变——但热专家仍造成不均。' },
    ],
    terms: [],
  },
  dpattn: {
    question: '多卡服务一批请求，注意力怎么切到各卡上、通信最省？',
    step: (s: never) => {
      const st = s as { phase: string; gpus: number; b: number; h: number; headsPerGpu: number; reqPerGpu: number; tpComm: number; tpWeight: string }
      return [
        { k: '本步输入', v: st.phase === 'done' ? `${st.b} 请求、${st.h} 头 → ${st.gpus} 卡` : st.phase === 'tp' ? '张量并行 TP：切头' : st.phase === 'dp' ? '数据并行 DP：切请求' : `${st.b} 请求、${st.h} 头、${st.gpus} 卡` },
        { k: '判定规则', v: `TP 切头(每卡 ${st.headsPerGpu} 头×全部请求)→每层 all-reduce 拼头;DP 切请求(每卡全部头×${st.reqPerGpu} 请求)→注意力零通信、权重复制。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `TP 省显存(每卡 ${st.tpWeight})但每层通信;DP 零通信但复制权重。MoE 常用 DP-attn + EP。`
            : st.phase === 'tp' ? `每卡只有一部分头,得 all-reduce 拼回来 → 通信 **${st.tpComm}**/token/层。`
            : st.phase === 'dp' ? `每卡自己那 ${st.reqPerGpu} 个请求从头算到尾 → 注意力**零通信**。`
            : `同一批注意力,两种铺法:切头 vs 切请求。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; tpComm: number }
      return st.phase === 'done' ? 'DP 零通信' : st.phase === 'dp' ? '零通信' : st.phase === 'tp' ? `all-reduce ${st.tpComm}` : 'TP/DP'
    },
    read: [
      { at: '读数', is: '卡数、请求·头、当前切法的通信量。', anchor: '.scdim' },
      { at: 'TP 面板', is: '每卡分几个头×全部请求;底部标每层 all-reduce。', anchor: '.dppanel' },
      { at: 'DP 面板', is: '每卡全部头×分几个请求;底部标零通信。', anchor: '.dpgpus' },
    ],
    try: [
      { act: '走 TP → DP 两步', watch: 'TP 切头要每层 all-reduce;DP 切请求注意力零通信。' },
      { act: '调「卡数」', watch: 'TP 每卡头更少(权重更省)、DP 每卡请求更少;通信量对比不变。' },
    ],
    terms: [],
  },
  flashdecode: {
    question: '解码每步只有 1 个 query 却要扫一长串 KV，怎么并行提速？',
    step: (s: never) => {
      const st = s as { phase: string; n: number; chunks: number; curChunk: number; output: number; fullOutput: number; seqLatency: number; parLatency: number }
      return [
        { k: '本步输入', v: st.phase === 'done' ? `1 query 对 ${st.n} 个 KV，切 ${st.chunks} 块` : st.phase === 'combine' ? '合并各块局部结果' : `第 ${st.curChunk + 1}/${st.chunks} 块（并行算局部）` },
        { k: '判定规则', v: `把 KV 切 C 块并行各算局部 (mᶜ,lᶜ,oᶜ)，再用 online softmax（拿全局最大 M 重缩放）无损合并。时延 ~N/C。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `时延从 ~${st.seqLatency} 降到 ~${st.parLatency}，输出和一次性 softmax 完全相等——解码提速。`
            : st.phase === 'combine' ? `合并输出 **${st.output}** = 一次性 softmax **${st.fullOutput}**（无损）。`
            : `这一块的局部注意力算好了，和别的块互不依赖、同时算。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; parLatency: number; curChunk: number; chunks: number }
      return st.phase === 'done' ? `时延 ~${st.parLatency}` : st.phase === 'combine' ? '合并=精确' : `块 ${st.curChunk + 1}/${st.chunks}`
    },
    read: [
      { at: '读数', is: 'query×KV、KV 分块 C、时延、输出。', anchor: '.scdim' },
      { at: 'KV 分块', is: 'N 个 key 切成 C 块(不同色);每块算局部 mᶜ/lᶜ/oᶜ。', anchor: '.fdkv' },
      { at: '时延对比', is: '顺序扫 ~N vs Flash Decode ~N/C。', anchor: '.fdlat' },
    ],
    try: [
      { act: '把「KV 分块」调到 8', watch: '时延 ~8→~1、块更多更细;合并输出始终 = 一次性 softmax。' },
      { act: '看合并那步', watch: '不是简单相加——要用全局最大 M 重缩放各块 exp 才无损(online softmax)。' },
    ],
    terms: [],
  },
  engram: {
    question: '注意力回头看又贵又受窗口限制——有没有便宜的旁路补上重复模式？',
    step: (s: never) => {
      const st = s as { stage: string; ngram: number; table: unknown[]; queryKey: string; prediction: string; matchCount: number }
      const nm: Record<string, string> = { id: '看任务', build: '建 n-gram 表', lookup: 'O(1) 查表', predict: '复制预测', done: '完成' }
      return [
        { k: '本步输入', v: st.stage === 'done' ? `序列走完` : `阶段:${nm[st.stage]}（${st.ngram}-gram）` },
        { k: '判定规则', v: `把出现过的 n-gram 存成「前 ${st.ngram - 1} 个→下一个」表;用当前 ${st.ngram - 1}-gram **O(1) 查表**拿到历次它后面跟的 token。不受注意力窗口限制。` },
        { k: '本步结果', v: st.stage === 'done'
            ? `查表补全出 **${st.prediction}**——把"精确复制"从贵的注意力卸载到便宜的表。`
            : st.stage === 'build' ? `建好 **${st.table.length}** 个前缀的表(O(1) 可查)。`
            : st.stage === 'lookup' ? `当前 2-gram「${st.queryKey}」命中(历史 ${st.matchCount} 次)。`
            : st.stage === 'predict' ? `表里「${st.queryKey}」→ **${st.prediction}**,一次查表搞定。`
            : `准备用 n-gram 记忆表补全下一个 token。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { stage: string; prediction: string }
      return st.stage === 'done' ? `→ ${st.prediction}` : st.prediction ? `查到 ${st.prediction}` : st.stage
    },
    read: [
      { at: '读数', is: '粒度、表项数、查询前缀、预测。', anchor: '.scdim' },
      { at: '序列', is: '末尾 n−1 个 token(高亮)= 查询前缀;命中后补出预测。', anchor: '.egseq' },
      { at: 'n-gram 表', is: '每行「前缀→下一个×次数」;命中行高亮。', anchor: '.egtable' },
    ],
    try: [
      { act: '一步步走', watch: '建表 → 取当前 2-gram「B C」→ O(1) 命中 → 复制出 D。' },
      { act: '对比归纳头', watch: '同是"回头找上次它之后是什么",但这是便宜的显式查表,不是贵的注意力。' },
    ],
    terms: [],
  },
  linattn: {
    question: '上下文越长，注意力算量和 KV 缓存就越顶不住——线性注意力怎么解？',
    step: (s: never) => {
      const st = s as { phase: string; n: number; d: number; ratio: number; kvMem: number; stateMem: number; crossoverN: number }
      const f = (x: number) => x >= 1e9 ? (x/1e9).toFixed(1)+'G' : x >= 1e6 ? (x/1e6).toFixed(1)+'M' : x >= 1e3 ? (x/1e3).toFixed(0)+'K' : `${x}`
      return [
        { k: '本步输入', v: st.phase === 'done' ? 'N 从 64 拉到 32768' : `序列长度 N=${st.n}` },
        { k: '判定规则', v: `softmax 算 N×N=O(N²)、KV 缓存 O(N);线性用结合律先算 φ(K)ᵀV 的 d×d 状态→算量 O(N)、状态固定 O(d²)。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `长序列线性完胜:算量差 **${st.ratio}×**、KV 缓存 ${f(st.kvMem)} vs 恒定状态 ${f(st.stateMem)}——告别膨胀 KV。`
            : `算量差 **${st.ratio}×**、KV 缓存 ${f(st.kvMem)}(随 N 长) vs 状态 ${f(st.stateMem)}(恒定)${st.n <= st.d ? '（N≤d，softmax 还更省）' : ''}。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; n: number; ratio: number }
      return st.phase === 'done' ? `省 ${st.ratio}×` : `N${st.n}·${st.ratio}×`
    },
    read: [
      { at: '读数', is: 'N、算量差、KV 缓存 vs 线性状态。', anchor: '.scdim' },
      { at: '算量曲线', is: '红=softmax O(N²) 陡、蓝=线性 O(N) 缓;竖虚线=交叉点 N=d。', anchor: '.laplot' },
      { at: '显存条', is: 'KV 缓存随 N 长、线性状态恒定 d×d。', anchor: '.lamem' },
    ],
    try: [
      { act: '按「下一步」拉长 N', watch: '红线(N²)越翘越高、蓝线(N)缓;KV 缓存条一直长、线性状态条不动。' },
      { act: '看 N=32768', watch: '算量差 512×、KV 缓存 4M vs 状态 4K——长上下文的关键。' },
    ],
    terms: [],
  },
  condnum: {
    question: '同一套梯度下降,为什么有的问题一步到位、有的却要爬几百步?',
    step: (s: never) => {
      const st = s as { phase: string; kappa: number; steps: number; rate: number }
      return [
        { k: '本步输入', v: st.phase === 'done' ? 'κ 从 1 加到 50' : `条件数 κ=${st.kappa}` },
        { k: '判定规则', v: `κ=最大曲率/最小曲率。κ=1 正圆碗、梯度直指谷底;κ 大=细长椭圆、梯度偏离谷底方向,每步误差只缩 (κ−1)/(κ+1)。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `收敛步数 1→12→47→**${st.steps}**——问题越病态越慢。要靠归一化/Adam 把 κ 拉回 1。`
            : `收敛 **${st.steps}** 步,每步误差缩 **${st.rate}**${st.kappa === 1 ? '(一步到位)' : '(之字形)'}。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; kappa: number; steps: number }
      return st.phase === 'done' ? `${st.steps} 步` : `κ${st.kappa}·${st.steps}步`
    },
    read: [
      { at: '读数', is: '条件数、收敛步数、每步误差收缩率。', anchor: '.scdim' },
      { at: '椭圆+轨迹', is: '等高线椭圆(κ 越大越扁)、之字形下降轨迹。', anchor: '.cnplot' },
    ],
    try: [
      { act: '按「下一步」加大 κ', watch: '碗越拉越扁、轨迹从直线一步变成剧烈之字形、步数暴涨。' },
      { act: '对比 κ=1 vs 50', watch: '正圆一步到位,κ=50 要 100 多步——这就是病态。' },
    ],
    terms: [],
  },
  maxent: {
    question: 'softmax 到处都是——它凭什么"天生合理",不是随手挑的?',
    step: (s: never) => {
      const st = s as { phase: string; mu: number; ent: number; naiveEnt: number; maxEnt: number }
      return [
        { k: '本步输入', v: st.phase === 'done' ? '约束 μ 从 3.5 收紧到 5.5' : `约束:期望点数 μ=${st.mu}` },
        { k: '判定规则', v: `在满足约束的分布里选**熵最大**的(最不武断)。可证它恒为指数族 p_i∝e^{λi};给期望能量约束就是 softmax/玻尔兹曼。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `最大熵解从均匀(熵 ${st.maxEnt})变尖(熵→${st.ent})——信息越多、最诚实的分布越集中。这就是 softmax 的根。`
            : `最大熵 **${st.ent}** bit${st.mu === 3.5 ? '(=均匀,到顶)' : `(> 同均值两点分布 ${st.naiveEnt})`}。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; mu: number; ent: number }
      return st.phase === 'done' ? `熵 ${st.ent}` : `μ${st.mu}·H${st.ent}`
    },
    read: [
      { at: '读数', is: '约束 μ、最大熵、熵上限、同均值两点分布的熵。', anchor: '.scdim' },
      { at: '分布柱', is: '骰子 1..6 的最大熵概率;μ 越大越往 6 偏。', anchor: '.mebars' },
      { at: '熵条', is: '当前熵占上限(log₂6)的比例。', anchor: '.meenttrack' },
    ],
    try: [
      { act: '按「下一步」收紧 μ', watch: '分布从均匀往 6 偏、熵一路降;但每步都是该约束下最不武断的。' },
      { act: '看 μ=3.5', watch: '没有约束时最大熵=均匀、熵到顶——这就是"最诚实"。' },
    ],
    terms: [],
  },
  jl: {
    question: '几百上千维的向量,凭什么能压到几十维还不丢"谁离谁近"?',
    step: (s: never) => {
      const st = s as { phase: string; d: number; k: number; avgRatio: number; maxDev: number }
      return [
        { k: '本步输入', v: st.phase === 'done' ? `K 从 16 加到 128` : `投到 K=${st.k} 维（从 ${st.d} 维压下来）` },
        { k: '判定规则', v: `JL 引理:随机线性投影到 k~O(log N/ε²) 维,所有两两距离保持在 (1±ε) 内——**与原维度 D 无关**,只看 N、ε。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `最大偏差收到 **${(st.maxDev * 100).toFixed(0)}%**、平均比≈1——${st.d} 维压到几十维,距离几乎原样。`
            : `平均距离比 **${st.avgRatio}**、最大偏差 **${(st.maxDev * 100).toFixed(0)}%**;K 越大越准。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; k: number; maxDev: number }
      return st.phase === 'done' ? `偏差 ${(st.maxDev * 100).toFixed(0)}%` : `K${st.k}·${(st.maxDev * 100).toFixed(0)}%`
    },
    read: [
      { at: '读数', is: '维度 D→K、平均距离比、最大偏差。', anchor: '.scdim' },
      { at: '距离比数轴', is: '每个点=一对点的距离比,越挤向 1 越保距;灰带=±最大偏差。', anchor: '.jltrack' },
    ],
    try: [
      { act: '按「下一步」加大 K', watch: '点越挤越紧地贴向 1、灰带越缩越窄。' },
      { act: '想一想', watch: '要多少投影维只跟点数 N、精度有关,和原始 256 维无关——这才是 JL 的惊人处。' },
    ],
    terms: [],
  },
  greedy: {
    question: '"每一步都拿当下最好的"——这个又快又直觉的策略,什么时候会栽?',
    step: (s: never) => {
      const st = s as { phase: string; rem: number; pick: number; picked: number[]; greedyCount: number; optimal: number; target: number }
      return [
        { k: '本步输入', v: st.phase === 'done' ? `贪心凑 ${st.target} 完成` : `剩 ${st.rem}，选一枚币` },
        { k: '判定规则', v: `贪心=每步拿 ≤剩余 的**最大**币、不回头。只有具备"贪心选择性质"时才等于全局最优,否则可能次优。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `贪心 [${st.picked.join('+')}]=**${st.greedyCount}** 枚,最优 **${st.optimal}** 枚(3+3)——贪心栽了。`
            : `拿 **${st.pick}** → 已拿 [${st.picked.join('+')}]（${st.greedyCount} 枚）。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; greedyCount: number; optimal: number; pick: number }
      return st.phase === 'done' ? (st.greedyCount > st.optimal ? `${st.greedyCount}>最优${st.optimal}` : '最优') : `+${st.pick}`
    },
    read: [
      { at: '读数', is: '目标、币值、贪心用了几枚。', anchor: '.scdim' },
      { at: '已拿的币', is: '贪心一枚枚拿的币(圆片)。', anchor: '.grcoins' },
      { at: '对比条', is: '贪心 vs DP 最优的枚数对比。', anchor: '.grcompare' },
    ],
    try: [
      { act: '按「下一步」贪心找零', watch: '每步拿最大币:4→1→1,共 3 枚。' },
      { act: '看对比条', watch: '最优只要 2 枚(3+3)——先拿了 4 就堵死了 3+3 这条更优路。' },
    ],
    terms: [],
  },
  dotsim: {
    question: '注意力用 Q·K 打分——一个乘加为什么就能量出"相关不相关"?',
    step: (s: never) => {
      const st = s as { phase: string; angleDeg: number; dot: number; cosSim: number; proj: number; magA: number; magB: number }
      return [
        { k: '本步输入', v: st.phase === 'done' ? 'θ 从 0° 转到 180°' : `夹角 θ=${st.angleDeg}°` },
        { k: '判定规则', v: `内积 a·b=|a||b|cosθ,长度固定时纯量方向一致度:同向最大、正交=0、反向最负。÷|a||b| 就是余弦相似度。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `内积 6→0(正交)→−6、余弦 1→0→−1——方向越一致内积越大。这就是 Q·K 打分。`
            : `a·b = ${st.magA}×${st.magB}×cos${st.angleDeg}° = **${st.dot}**,余弦 **${st.cosSim}**${st.angleDeg === 90 ? '(正交=不相关)' : ''}。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; angleDeg: number; dot: number }
      return st.phase === 'done' ? '方向=相似' : `${st.angleDeg}°·${st.dot}`
    },
    read: [
      { at: '读数', is: '夹角、内积、余弦相似度。', anchor: '.scdim' },
      { at: '几何图', is: 'a(灰)固定、b(蓝)转角;红段=b 在 a 上的投影,内积=|a|×投影。', anchor: '.dsplot' },
      { at: '余弦尺', is: '▲ 在 −1(反向)…+1(同向)之间。', anchor: '.dsmtrack' },
    ],
    try: [
      { act: '按「下一步」转 b', watch: '同向内积最大→转到 90°内积为 0→反向最负;投影段跟着变。' },
      { act: '盯 90°那步', watch: '正交时内积=0=不相关——这正是注意力里无关 token 权重低的道理。' },
    ],
    terms: [],
  },
  lowrank: {
    question: '为什么微调大模型能只训一小撮参数(LoRA)、还不太掉效果?',
    step: (s: never) => {
      const st = s as { phase: string; rank: number; error: number; energyPct: number; fullParams: number; lowrankParams: number }
      return [
        { k: '本步输入', v: st.phase === 'done' ? '秩从 1 提到 4' : `保留秩 k=${st.rank}` },
        { k: '判定规则', v: `A=Σσ_i·u_i·v_iᵀ,信息集中在前几个大 σ。留前 k 个:用 2·d·k 个数近似 d² 个,误差=√(丢掉的σ²)(Eckart–Young 最优)。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `秩 2 就保 98% 能量——这就是 LoRA:低秩更新 ΔW=B·A,只训 2·d·r 参数。`
            : `保留能量 **${st.energyPct}%**、误差 **${st.error}**;参数 ${st.fullParams} → **${st.lowrankParams}**。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; rank: number; energyPct: number }
      return st.phase === 'done' ? '低秩=LoRA' : `k${st.rank}·${st.energyPct}%`
    },
    read: [
      { at: '读数', is: '秩、保留能量、重建误差、参数量。', anchor: '.scdim' },
      { at: '两张热力图', is: '左=原矩阵、右=秩-k 重建;k 越大越像。', anchor: '.lrpair' },
      { at: '奇异值条', is: '亮=保留、暗=丢弃;大的 σ 装了大部分信息。', anchor: '.lrsig' },
    ],
    try: [
      { act: '按「下一步」加大秩 k', watch: '右边重建越来越像原图、能量从 88% 涨到 100%。' },
      { act: '看秩 2', watch: '只留 2 个分量就 98% 像、参数 64→32——这就是 LoRA 省参数的道理。' },
    ],
    terms: [],
  },
  editdist: {
    question: '把一个词改成另一个最少几步?为什么"填张表"就不用指数级重算?',
    step: (s: never) => {
      const st = s as { phase: string; a: string; b: string; ci: number; cj: number; match: boolean; val: number }
      return [
        { k: '本步输入', v: st.phase === 'done' ? `${st.a} → ${st.b} 全表填完` : `填格 (${st.ci},${st.cj})：a[${st.ci}]='${st.a[st.ci - 1]}' vs b[${st.cj}]='${st.b[st.cj - 1]}'` },
        { k: '判定规则', v: `dp[i][j]=a 前 i 个改成 b 前 j 个的最少步。相同→抄左上;不同→**1+min(左上替换, 上删除, 左插入)**。只看三个已算邻居 O(1)。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `右下角=**${st.val}**,就是编辑距离。O(n·m) 填完,把指数级重算压成填表。`
            : st.match ? `相同,直接继承左上 → **${st.val}**。` : `不同,取三邻居最小+1 → **${st.val}**。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; ci: number; cj: number; val: number }
      return st.phase === 'done' ? `距离 ${st.val}` : `(${st.ci},${st.cj})=${st.val}`
    },
    read: [
      { at: '读数', is: 'a→b、当前格、本格值/编辑距离。', anchor: '.scdim' },
      { at: 'DP 表', is: '行=a、列=b;蓝=当前格,浅色=它依赖的三个邻居,右下角=答案。', anchor: '.edtable' },
    ],
    try: [
      { act: '按「下一步」逐格填', watch: '每格由左上/上/左三个已算好的邻居 O(1) 推出。' },
      { act: '填到右下角', watch: 'horse→ros 的编辑距离 = 3。' },
    ],
    terms: [],
  },
  induction: {
    question: '大模型没训过这句话,凭什么能"照着上文的样式接着写"?',
    step: (s: never) => {
      const st = s as { stage: string; cur: string; matches: number[]; prediction: string }
      const nm: Record<string, string> = { id: '认当前 token', scan: '扫匹配位置', attend: '注意力落点', copy: '复制预测', done: '完成' }
      return [
        { k: '本步输入', v: st.stage === 'done' ? '序列 A B C A B C A' : `阶段:${nm[st.stage]}（当前 token ${st.cur}）` },
        { k: '判定规则', v: `归纳头:"上次见到当前 token(${st.cur})时,它后面跟了什么?复制过来。"找"前一个 token==${st.cur}"的位置,注意力落其上。` },
        { k: '本步结果', v: st.stage === 'done'
            ? `A B C A B C A → **${st.prediction}**——纯靠上下文模式现学现用,这就是上下文学习。`
            : st.stage === 'id' ? `当前 token = **${st.cur}**,准备回头找它上次之后跟了什么。`
            : st.stage === 'scan' ? `找到匹配位置 [${st.matches.join(', ')}](前面都是 ${st.cur})。`
            : st.stage === 'attend' ? `注意力集中在 pos ${st.matches.join('、')}(上次 ${st.cur} 之后)。`
            : `那些位置的 token 都是 **${st.prediction}** → 复制成预测。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { stage: string; prediction: string }
      return st.stage === 'done' ? `→ ${st.prediction}` : st.prediction ? `复制 ${st.prediction}` : st.stage
    },
    read: [
      { at: '读数', is: '当前 token、注意力落点、预测。', anchor: '.scdim' },
      { at: 'token 序列', is: '每个 token 一格;查询高亮、匹配位高亮、下方小柱=注意力权重。', anchor: '.idcrow' },
    ],
    try: [
      { act: '一步步走', watch: '认当前 A → 扫出 pos1/pos4(前面是 A) → 注意力落上去 → 复制出 B。' },
      { act: '看预测', watch: '"上次 A 之后跟的是 B",于是补全 A B C A B C A → B。' },
    ],
    terms: [],
  },
  residual: {
    question: '几十上百层的深网络,梯度传到最底下不就没了吗?为什么还能训?',
    step: (s: never) => {
      const st = s as { phase: string; layer: number; depth: number; gradPlain: number; gradRes: number; resFactor: number }
      return [
        { k: '本步输入', v: st.phase === 'done' ? `梯度穿过全部 ${st.depth} 层` : `倒传到第 ${st.layer} 层` },
        { k: '判定规则', v: `反向传播=各层导数**连乘**。没残差每层×0.8(<1)→指数衰减;残差 y=x+f(x)、导数=**1+f′**，那个 +1 让梯度原样穿过。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `没残差塌到 **${st.gradPlain}**(≈梯度消失);有残差稳在 **${st.gradRes}**——这就是残差的作用。`
            : `没残差 →**${st.gradPlain}**;有残差 ×${st.resFactor}→**${st.gradRes}**${st.gradPlain < 0.1 ? '(没残差快没了)' : ''}。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; layer: number; gradPlain: number; gradRes: number }
      return st.phase === 'done' ? '残差守住' : `层${st.layer}·平${st.gradPlain}`
    },
    read: [
      { at: '读数', is: '层数、没残差梯度、有残差梯度。', anchor: '.scdim' },
      { at: '两条曲线', is: '红=有残差(守在1)、灰=没残差(往0塌);虚线是 y=1 与消失阈 0.1。', anchor: '.rsplot' },
    ],
    try: [
      { act: '按「下一步」让梯度倒传', watch: '灰线(没残差)指数往 0 掉、红线(有残差)守在 1 附近。' },
      { act: '看穿过 16 层后', watch: '没残差≈0.03(消失)、有残差≈1——差了一条 +1 恒等高速路。' },
    ],
    terms: [],
  },
  graddesc: {
    question: '模型"训练"到底在干嘛？凭什么损失会一直降？',
    step: (s: never) => {
      const st = s as { phase: string; step: number; x: number; y: number; loss: number; gx: number; gy: number; lr: number }
      return [
        { k: '本步输入', v: st.phase === 'done' ? '走了 8 步梯度下降' : `第 ${st.step < 0 ? 0 : st.step} 步，位置 (${st.x}, ${st.y})` },
        { k: '判定规则', v: `沿**负梯度**更新 θ←θ−lr·∇L。梯度指向上升最快方向，取负号朝下降最快走，lr=${st.lr} 控步长。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `损失从 96 单调降到 **${st.loss}**，逼近谷底 (0,0)——这就是神经网络训练。`
            : `损失 **${st.loss}**，梯度 (${st.gx}, ${st.gy})，走一步到 (${(st.x - st.lr * st.gx).toFixed(2)}, ${(st.y - st.lr * st.gy).toFixed(2)})。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; step: number; loss: number }
      return st.phase === 'done' ? '到谷底' : `步${st.step < 0 ? 0 : st.step}·L${st.loss}`
    },
    read: [
      { at: '读数', is: '步、损失、位置、梯度。', anchor: '.scdim' },
      { at: '等高线+轨迹', is: '椭圆=损失等值圈；折线=下降轨迹,当前点高亮。', anchor: '.gdplot' },
    ],
    try: [
      { act: '按「下一步」下降', watch: '损失单调降、点拐向谷底 (0,0)。' },
      { act: '看 y 方向', watch: 'y 更陡、步子迈过头,点在中轴两侧来回跳(条件数的影响)。' },
    ],
    terms: [],
  },
  bloom: {
    question: '怎么用一点点空间，就几乎不出错地判断"这个元素见过没"？',
    step: (s: never) => {
      const st = s as { phase: string; op: string; word: string; idx: number[]; verdict: string; falsePositive: boolean }
      return [
        { k: '本步输入', v: st.phase === 'done' ? '插 3 个、查 4 个之后' : st.op === 'add' ? `插入「${st.word}」` : `查询「${st.word}」` },
        { k: '判定规则', v: `插入=把 k 个哈希位全置 1；查询=看这 k 位：**有一位是 0→一定不在**(绝不漏报)、**全是 1→可能在**(可能撞位假阳性)。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `规律成立:绝不漏报、但可能误报——owl 撞了 dog 的位就是一次假阳性。`
            : st.op === 'add' ? `位 [${st.idx.join(', ')}] 全置 1。`
            : `位 [${st.idx.join(', ')}] → **${st.verdict}**${st.falsePositive ? '（假阳性！撞了别人的位）' : ''}。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; op: string; word: string; verdict: string; falsePositive: boolean }
      return st.phase === 'done' ? '绝不漏报' : st.op === 'add' ? `+${st.word}` : `${st.word}:${st.verdict}${st.falsePositive ? '(假阳)' : ''}`
    },
    read: [
      { at: '读数', is: 'm、k、已插入的词。', anchor: '.scdim' },
      { at: 'bit 数组', is: '24 个位；插入点亮(蓝框)、查询探测(高亮)对应位。', anchor: '.blmbits' },
    ],
    try: [
      { act: '按「下一步」插入 cat/dog/sun', watch: '每个词点亮 3 个位。' },
      { act: '查到 owl', watch: '它没插过,可三位恰好和 dog 一样全是 1 → 假阳性"可能在"。' },
    ],
    terms: [],
  },
  bayes: {
    question: '检测阳性了，你到底有多可能患病？为什么不是 90%？',
    step: (s: never) => {
      const st = s as { phase: string; nTests: number; prior: number; num: number; denFalse: number; posterior: number }
      const pf = (x: number) => (x * 100).toFixed(x < 0.1 ? 2 : 1) + '%'
      return [
        { k: '本步输入', v: st.phase === 'done' ? '连续 4 次阳性' : `第 ${st.nTests} 次阳性，先验(本次前) ${pf(st.prior)}` },
        { k: '判定规则', v: `后验 ∝ 先验 × 似然：P(病|阳)=真阳/(真阳+误报)=sens·先验/(sens·先验+fpr·(1−先验))。**把基础率也算进去**。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `后验爬到 **${pf(st.posterior)}**。单次阳性只 9%(基础率谬误)，但证据连续更新逼近确诊。`
            : `后验=${st.num.toFixed(3)}/(${st.num.toFixed(3)}+${st.denFalse.toFixed(3)})=**${pf(st.posterior)}**${st.nTests === 1 ? '(才 9%！误报淹了真阳)' : ''}。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; nTests: number; posterior: number }
      return st.phase === 'done' ? `${(st.posterior * 100).toFixed(0)}%` : `#${st.nTests}·${(st.posterior * 100).toFixed(0)}%`
    },
    read: [
      { at: '读数', is: '阳性次数、先验(本次前)、后验(本次后)。', anchor: '.scdim' },
      { at: '患病信念尺', is: 'P(患病)在 0..100% 的位置，随证据右移。', anchor: '.bytrack' },
      { at: '真阳|误报拆分', is: '后验=真阳截/(真阳+误报);先验低时误报截巨大。', anchor: '.bysplitbar' },
    ],
    try: [
      { act: '按「下一步」看第 1 次阳性', watch: '后验只有 9%——因为先验(基础率)才 1%,误报截把真阳淹了。' },
      { act: '继续按下去', watch: '上次后验当这次先验,9%→50%→91%→99%,证据累积逼近确诊。' },
    ],
    terms: [],
  },
  xent: {
    question: '语言模型的"训练损失"和"困惑度"，到底在量什么？',
    step: (s: never) => {
      const st = s as { phase: string; trueWord: string; pTrue: number; surprise: number; ce: number; perplexity: number; ppUniform: number }
      return [
        { k: '本步输入', v: st.phase === 'done' ? '整句逐词预测完' : `预测「${st.trueWord}」，模型给它 ${(st.pTrue * 100).toFixed(0)}%` },
        { k: '判定规则', v: `真词只有一个→这步交叉熵=**−log₂p(真词)**(惊讶度)；平均交叉熵=训练损失；**困惑度=2^交叉熵**(有效分叉数)。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `平均交叉熵 **${st.ce}** bit/词(=训练损失)，困惑度 **${st.perplexity}**——只在约 ${st.perplexity.toFixed(1)} 个词间犹豫(完美=1、瞎猜=${st.ppUniform})。`
            : `惊讶度 −log₂${st.pTrue} = **${st.surprise}** bit，到此平均交叉熵 **${st.ce}**、困惑度 **${st.perplexity}**。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; perplexity: number; ce: number }
      return st.phase === 'done' ? `困惑度 ${st.perplexity}` : `CE ${st.ce}·PP ${st.perplexity}`
    },
    read: [
      { at: '读数', is: '给真词的概率、惊讶度、平均交叉熵、困惑度。', anchor: '.scdim' },
      { at: '预测分布', is: '模型对 8 个词的概率(柱)，真词高亮。', anchor: '.xebars' },
      { at: '困惑度尺', is: '▲ 在「1(笃定)…V(瞎猜)」之间的位置。', anchor: '.xepptrack' },
    ],
    try: [
      { act: '按「下一步」逐词预测', watch: '真词概率高的词惊讶度低；「on」拿不准(25%)那步惊讶度飙到 2 bit。' },
      { act: '盯困惑度 ▲', watch: '它在 1(毫不犹豫)到 8(瞎猜)之间；平均交叉熵越小，困惑度越贴近 1。' },
    ],
    terms: [],
  },
  clt: {
    question: '为什么高斯分布到处都是——凭什么"多个一平均"就变钟形？',
    step: (s: never) => {
      const st = s as { phase: string; m: number; trials: number; std: number; theoStd: number; exKurt: number }
      return [
        { k: '本步输入', v: st.phase === 'done' ? '平均样本数从 1 扫到 32' : `每次平均 ${st.m} 个均匀样本（跑 ${st.trials} 次）` },
        { k: '判定规则', v: `不管原始分布长啥样(方差有限)，m 个 i.i.d. 样本的**均值**随 m 增大越来越接近**高斯**；均值 std 按 **σ/√m** 缩。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `均匀分布(平的)平均 32 个就长成**钟形**：超额峰度从 −1.2 奔向 **0**(=高斯)，均值 std 按 σ/√m 缩。`
            : `均值 std **${st.std}**(理论 σ/√m=${st.theoStd})、超额峰度 **${st.exKurt}**${st.m === 1 ? '(=均匀本身，平顶)' : '(往 0=高斯 走)'}。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; m: number; exKurt: number }
      return st.phase === 'done' ? '长成钟形' : `m=${st.m} · 峰度${st.exKurt}`
    },
    read: [
      { at: '统计读数', is: 'm、均值 std vs 理论 σ/√m、超额峰度(0=高斯)。', anchor: '.scdim' },
      { at: '标准化直方图', is: '标准化均值的分布(柱)，红线=标准正态；m 越大越贴。', anchor: '.cltplot' },
    ],
    try: [
      { act: '按「下一步」把 m 从 1 加到 32', watch: '直方图从平顶长成钟形、越来越贴那条红色正态曲线。' },
      { act: '盯超额峰度', watch: '从 −1.2(均匀)一路奔向 0(高斯)；同时均值 std 按 σ/√m 缩。' },
    ],
    terms: [],
  },
  lln: {
    question: '为什么“多采样就准”——大数定理凭什么让蒙特卡洛能算 π？',
    step: (s: never) => {
      const st = s as { phase: string; n: number; trials: number; meanEst: number; rmsError: number; rmsErrSqrtN: number }
      return [
        { k: '本步输入', v: st.phase === 'done' ? '撒点数从 50 扫到 12800' : `每次撒 ${st.n} 点、跑 ${st.trials} 次独立试验` },
        { k: '判定规则', v: `落进 1/4 圆(x²+y²≤1)的比例 × 4 ≈ π；样本越多均值越贴期望，估计误差按 **1/√n** 缩（方差可加）。单条路径太吵，故取 RMS 误差。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `均值估计始终 ≈3.14159（无偏），RMS 误差越来越小，而 **RMS误差×√n ≈ 1.64 恒定**——这就是“误差 ∝ 1/√n”。`
            : `均值估计 **${st.meanEst}**（≈π），RMS 误差 **${st.rmsError}**、RMS误差×√n **${st.rmsErrSqrtN}**。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; n: number; meanEst: number }
      return st.phase === 'done' ? '收敛到 π' : `n=${st.n} · π≈${st.meanEst}`
    },
    read: [
      { at: '收敛读数', is: 'n、均值估计、RMS 误差、RMS误差×√n（后者≈1.64 常数=1/√n 定律）。', anchor: '.scdim' },
      { at: '散点图', is: '第 0 次试验的散点：蓝=圆内、灰=圆外；蓝点占比×4=π 估计。', anchor: '.llnplot' },
    ],
    try: [
      { act: '按「下一步」把 n 从 50 加到 12800', watch: '均值估计稳在 ≈3.14、RMS 误差越来越小。' },
      { act: '盯 RMS误差×√n', watch: '它基本不随 n 变(≈1.64)——这个常数就是“误差 ∝ 1/√n”：样本翻 4 倍、误差才减半。' },
    ],
    terms: [],
  },
  ortho: {
    question: '几百维的嵌入，为什么能装下十几万个词还不打架？',
    step: (s: never) => {
      const st = s as { phase: string; d: number; std: number; theoStd: number; maxAbs: number; mean: number }
      return [
        { k: '本步输入', v: st.phase === 'done' ? '维度从 2 扫到 512' : `维度 d=${st.d}` },
        { k: '判定规则', v: `两个随机单位向量的夹角余弦，均值 0、**方差=1/d**（d 个分量的归一化内积，大数定理——分量越多越集中在 0）。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `d 越大，余弦标准差越贴近 **1/√d**、max|cos|→0——随机方向几乎两两正交。`
            : `余弦均值 ${st.mean}、标准差 **${st.std}**（理论 1/√d=${st.theoStd}）、最大 |余弦| **${st.maxAbs}**${st.maxAbs < 0.15 ? '（已近正交）' : ''}。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; d: number; maxAbs: number }
      return st.phase === 'done' ? '几乎正交' : `d=${st.d} \u00b7 max|cos| ${st.maxAbs}`
    },
    read: [
      { at: '维度读数', is: 'd、余弦标准差 vs 理论 1/√d、最大 |余弦|。', anchor: '.scdim' },
      { at: '余弦数轴', is: '28 对夹角余弦画在 [-1,1] 上，中间 0=正交(90°)。', anchor: '.ortrack' },
      { at: '灰带 ±1σ', is: '一个标准差的范围，随 d 越缩越窄。', anchor: '.orband' },
    ],
    try: [
      { act: '按「下一步」把 d 从 2 加到 512', watch: '点越挤越紧地贴向中间"0=正交"；灰带(±1σ)越缩越窄。' },
      { act: '看 d=2 vs d=512', watch: 'd=2 还可能有一对几乎同向(max|cos|≈1)；d=512 全贴到 90°(max|cos|≈0.09)。' },
    ],
    terms: [],
  },
  hopfield: {
    question: '注意力凭什么能“回忆”——从上下文里检索出相关信息？',
    step: (s: never) => {
      const st = s as { phase: string; step: number; weights: number[]; best: number; matchBits: number; converged: boolean }
      return [
        { k: '本步输入', v: st.phase === 'done' ? '检索收敛' : `第 ${st.step < 0 ? 0 : st.step} 步检索` },
        { k: '判定规则', v: `一步 Hopfield = 一次注意力：权重=softmax(β·query·keys)，output=Σ权重·记忆，取符号当新 query 再来。β 大→精确检索。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `残缺 query 被“回忆”回完整 P0，权重收敛到 one-hot——注意力就是按内容检索的联想记忆。`
            : `最像 **P${st.best}**（${(st.weights[st.best] * 100).toFixed(0)}%），query 与 P0 相同 **${st.matchBits}/8** 位${st.converged ? '——已回忆出完整 P0、权重 one-hot' : st.matchBits < 8 ? '（还残缺）' : ''}。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; best: number; matchBits: number }
      return st.phase === 'done' ? '回忆出 P0' : `P${st.best} \u00b7 ${st.matchBits}/8`
    },
    read: [
      { at: '存储的记忆', is: '4 个 8 位模式(蓝=+1 红=-1)当 keys；被检索到的高亮。', anchor: '.hfmem' },
      { at: '当前 query', is: '红框标出和 P0 不一致的位；随检索一步步清理回 P0。', anchor: '.hfquery' },
      { at: '检索权重', is: 'softmax(β·query·keys)，收敛到 one-hot=认定某个记忆。', anchor: '.hfweights' },
    ],
    try: [
      { act: '按「下一步」做一次检索', watch: '红框位翻回来、query 与 P0 从 6/8 变 8/8；权重从分散收敛到 one-hot。' },
      { act: '盯"最像 P?"', watch: '残缺 query 一开始就最像 P0，检索把它拉回完整的 P0——这就是按内容的联想回忆。' },
    ],
    terms: [],
  },
  scale: {
    question: '注意力为什么要除以 \u221ad_k？',
    step: (s: never) => {
      const st = s as { phase: string; d: number; sqrtd: number; variance: number; entU: number; entS: number; maxU: number }
      return [
        { k: '本步输入', v: st.phase === 'done' ? '维度从 4 扫到 1024' : `维度 d=${st.d}` },
        { k: '判定规则', v: `Q\u00b7K 是 d 个 i.i.d. 乘积之和 → 方差=d、标准差 \u221ad。不缩放 softmax(base\u00d7\u221ad)；\u00f7\u221ad 后 softmax(base)。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `d 越大，不缩放的熵越塌向 0（一头独大、梯度消失）；\u00f7\u221ad 熵恒 **${st.entS}**。所以要除以 \u221ad_k。`
            : `方差=**${st.variance}**、\u221ad=${st.sqrtd.toFixed(1)}。不缩放最大概率 **${(st.maxU * 100).toFixed(1)}%**、熵 **${st.entU}**${st.maxU > 0.9 ? '（塌成 one-hot）' : ''}；\u00f7\u221ad 熵 ${st.entS}（不变）。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; d: number; maxU: number }
      return st.phase === 'done' ? '\u00f7\u221ad 稳' : `d=${st.d} \u00b7 最大 ${(st.maxU * 100).toFixed(0)}%`
    },
    read: [
      { at: '维度读数', is: 'd、方差=d、标准差 \u221ad。', anchor: '.scdim' },
      { at: '不缩放（红）', is: 'softmax(base\u00d7\u221ad)，d 大就塌成一根到顶的 one-hot。', anchor: '.sccol.bad' },
      { at: '\u00f7\u221ad（绿）', is: 'softmax(base)，四根一直“软”、不随 d 变。', anchor: '.sccol.good' },
    ],
    try: [
      { act: '按「下一步」把 d 从 4 加到 1024', watch: '不缩放那边逐步塌成 one-hot（熵→0、最大→100%）；\u00f7\u221ad 那边纹丝不动。' },
      { act: '对比两边的熵', watch: '不缩放熵一路降到 0（梯度要消失）；\u00f7\u221ad 熵恒定——这就是为什么要除 \u221ad。' },
    ],
    terms: [],
  },
  engine: {
    question: '一堆长短不一的请求，怎么高效地一起服务？',
    step: (s: never) => {
      const st = s as { phase: string; step: number; free: number; pool: number; running: unknown[]; waiting: string[]; gen: number; admitted: string[]; finished: string[]; event: string }
      return [
        { k: '本步输入', v: st.phase === 'done' ? '全部请求跑完' : `引擎第 ${st.step < 0 ? 0 : st.step} 步` },
        { k: '判定规则', v: `回收完成的请求（归还块）→ FCFS 准入等待队列里空闲块够的（遇到第一个放不下就停）→ 新准入做 **prefill**、在跑的做 **decode**（各出 1 token）。块池守恒：空闲 + 在跑占用 = 总块。` },
        { k: '本步结果', v: st.phase === 'done'
            ? `共生成 **${st.gen}** 个 token、引擎 **${st.step + 1}** 步跑完。连续批处理让算完的位子立刻让给等待的。`
            : (st.finished.length ? `回收 ${st.finished.join('/')}；` : '') + (st.admitted.length ? `准入 ${st.admitted.join('/')}；` : '') + `块池 ${st.pool - st.free}/${st.pool} 用，批内 ${st.running.length} 在跑、${st.waiting.length} 等。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; step: number; event: string; gen: number }
      return st.phase === 'done' ? `${st.gen} token` : `第 ${st.step < 0 ? 0 : st.step} 步 · ${st.event}`
    },
    read: [
      { at: '块池', is: '每格是一个 KV 块，按颜色归属在跑的请求；灰的是空闲。', anchor: '.engpool' },
      { at: '运行批次', is: '每个请求一条：进度条（prompt|生成）、prefill/decode、占几块。', anchor: '.engbatch' },
      { at: '计数', is: '引擎步 / 生成 token / 完成数，看吞吐。', anchor: '.engstats' },
    ],
    try: [
      { act: '把 KV 块池从 4 加到 6', watch: '块多了，一开始能同时准入更多请求（批更大），等待更少。', param: 'KV 块池' },
      { act: '盯运行批次的组成', watch: '每步都在变：R1 算完→R3 补上→R2 算完→R4 补上。算完随时走、新的随时上，这就是连续批处理。', param: 'KV 块池' },
    ],
    terms: [],
  },
  kvoffload: {
    question: 'GPU 显存装不下这么多 KV 缓存，怎么办？',
    step: (s: never) => {
      const st = s as { phase: string; slots: number; req: number; result: string; evicted: number|null; reloaded: boolean; gpu: number[]; hits: number; offloads: number; reloads: number }
      return [
        { k: '本步输入', v: st.phase === 'done' ? '访问序列走完' : `访问 KV 块 ${st.req}` },
        { k: '判定规则',
          v: `在 GPU 上 → **命中**；不在且 GPU 满（${st.slots} 槽）→ 按 **LRU** 把最久没用的块**换出到 CPU**，再把要的块换入。和页面置换一样。` },
        { k: '本步结果',
          v: st.phase === 'done'
            ? `命中 **${st.hits}**、换出 **${st.offloads}**、换入 **${st.reloads}**。GPU 装不下就靠换出换入续命，代价是 PCIe 拷贝。`
            : st.result === 'hit' ? `块 ${st.req} 命中，更新为最近用过。`
              : `未命中` + (st.reloaded ? `，块 ${st.req} 从 CPU 换入` : '（新块）') + (st.evicted !== null ? `，换出块 ${st.evicted} 到 CPU` : '') + `。GPU：[${st.gpu.join('、')}]。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; req: number; result: string; offloads: number }
      return st.phase === 'done' ? `换出 ${st.offloads} 次` : `块 ${st.req} · ${st.result === 'hit' ? '命中' : '未命中'}`
    },
    read: [
      { at: 'GPU 槽', is: '绿色是 GPU 上的 KV 块，右边最近用过；命中/换入的高亮。', anchor: '.kotier.gpu' },
      { at: 'CPU 换出区', is: '被换出的块落到这里，红色；要用时再换回。', anchor: '.kotier.cpu' },
      { at: '计数', is: '命中 / 换出 / 换入 三个数，看代价。', anchor: '.kostats' },
    ],
    try: [
      { act: '把 GPU 槽数从 3 加到 4', watch: '槽多了，换出从 4 次降到 2 次、换入从 2 到 1 —— 显存越大越少来回搬。', param: 'GPU 槽数' },
      { act: '盯 CPU 换出区', watch: '每次 GPU 满又要新块，最久没用的块就被踢到 CPU；再访问它时又得换回来（reload）。', param: 'GPU 槽数' },
    ],
    terms: ['kvoff'],
  },
  collective: {
    question: '多张卡各算了一半，怎么高效地把结果求和、让每张卡都拿到？',
    step: (s: never) => {
      const st = s as { phase: string; G: number; round: number; totalSteps: number; target: number[]; moves: {src:number;dst:number;chunk:number}[] }
      return [
        { k: '本步输入',
          v: st.phase === 'done' ? `${st.G} 张卡的通信全走完` : st.phase === 'reduce' ? `reduce-scatter 第 ${st.round}/${st.G-1} 步` : `all-gather 第 ${st.round}/${st.G-1} 步` },
        { k: '判定规则',
          v: st.phase === 'reduce'
            ? `每张卡把**一个块**发给环上下一张，对方**累加**。${st.G-1} 步后每卡各拥有某块的完整和。`
            : st.phase === 'gather'
              ? `把已求和的块沿环**广播**一圈，接收方覆盖。${st.G-1} 步后人人集齐。`
              : `全部 **${st.totalSteps}** 步（2·(G−1)）走完。` },
        { k: '本步结果',
          v: st.phase === 'done'
            ? `每张卡都拿到完整总和 [${st.target.join('、')}]。每步每卡只收发一个块 —— 带宽与卡数无关，比人人对发（G² 消息）省得多。`
            : `本步 ${st.moves.length} 条环上传递（块 ${st.moves.map(m=>m.chunk).join('、')}）。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; round: number; G: number; totalSteps: number }
      return st.phase === 'done' ? `人人拿到总和 · ${st.totalSteps} 步`
        : st.phase === 'reduce' ? `reduce-scatter ${st.round}/${st.G-1}` : `all-gather ${st.round}/${st.G-1}`
    },
    read: [
      { at: '阶段条', is: 'reduce-scatter 先做，再 all-gather；共 2(G−1) 步。', anchor: '.coph' },
      { at: 'GPU×块 网格', is: '绿色✓的格子是已求和的块；本步环上传递的格子高亮。', anchor: '.cogrid' },
      { at: '总和行', is: '逐元素总和，末步每张卡都收敛到它。', anchor: '.cotarget' },
    ],
    try: [
      { act: '把 GPU 数从 2 加到 4', watch: '步数变成 2·(G−1)：卡越多步越多，但每步每卡仍只收发一个块。', param: 'GPU 数 G' },
      { act: '看绿色✓怎么铺开', watch: 'reduce-scatter 后每卡先各拥有一个完整块，all-gather 再把它们传满全网格。', param: 'GPU 数 G' },
    ],
    terms: ['allreduce', 'tpdef', 'matmuldef'],
  },
  tensorpar: {
    question: '一个矩阵乘大到单卡装不下，怎么切到多张 GPU 上算、还保证结果不变？',
    step: (s: never) => {
      const st = s as { phase: string; gpu: number; G: number; cols: [number,number]; shard: number[]; full: number[]; fraction: number }
      return [
        { k: '本步输入',
          v: st.phase === 'done' ? `${st.G} 张卡的 Y 片全拼完` : st.phase === 'gather' ? `${st.G} 张卡各自的 Y 片` : `GPU ${st.gpu}：拿 W 的第 ${st.cols[0]}~${st.cols[1]-1} 列（1/${st.G} 的权重）` },
        { k: '判定规则',
          v: `**列并行**：W 按列切成 ${st.G} 份，第 g 卡算 Y 的对应列 Y_g = X·W_g（只存/只算 1/${st.G}）。${st.phase==='gather'||st.phase==='done' ? '**all-gather** 把各片拼成完整 Y（跨卡通信）。' : ''}` },
        { k: '本步结果',
          v: st.phase === 'done'
            ? `拼出的 Y = [${st.full.join('、')}]，和单卡整算**完全一样**。每卡显存、算力都降到 **1/${st.G}**，代价是 all-gather 的跨卡通信。`
            : st.phase === 'gather' ? `拼成完整 Y = [${st.full.join('、')}]。`
              : `算出 Y 片 = [${st.shard.join('、')}]。只做了整个乘法的 1/${st.G}。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; gpu: number; G: number; fraction: number; full: number[] }
      return st.phase === 'done' ? `拼接 == 单卡 · 每卡 1/${st.G}`
        : st.phase === 'gather' ? 'all-gather 拼接'
          : `GPU ${st.gpu} 算 1/${st.G}`
    },
    read: [
      { at: 'W 按列分卡', is: 'W 的列按颜色分给不同 GPU，当前卡的列高亮。', anchor: '.tpw' },
      { at: 'Y 片 → 完整 Y', is: '各卡算自己那段 Y，all-gather 后拼成整条。', anchor: '.tpyrow' },
      { at: '1/G 占比', is: '每卡只承担 1/G 的显存与算力。', anchor: '.tpfrac' },
    ],
    try: [
      { act: '把 GPU 数从 2 调到 4', watch: 'W 切得更细，每卡只拿 1/4 的列、算 1/4；拼起来仍等于单卡整算。', param: 'GPU 数 G' },
      { act: '核对拼接结果', watch: '不管切几刀，all-gather 拼出的 Y 和单卡完全一样 —— 切的是乘法、不改结果。', param: 'GPU 数 G' },
    ],
    terms: ['tpdef', 'matmuldef'],
  },
  layout: {
    question: '二维矩阵在内存里其实是一条直线 —— 它到底怎么排？为什么排法会影响速度？',
    step: (s: never) => {
      const st = s as { phase: string; layout: string; rows: number; cols: number; cur: {addr:number;i:number;j:number;v:number}|null; rowStride: number; colStride: number; mem: ({v:number}|null)[] }
      return [
        { k: '本步输入',
          v: st.phase === 'done' ? `${st.layout} 全摊平完` : st.cur ? `内存地址 @${st.cur.addr}` : '开始摊平' },
        { k: '判定规则',
          v: st.layout === 'row-major'
            ? `**row-major**：一行连续存，地址 = i·${st.cols}+j。`
            : `**col-major**：一列连续存，地址 = j·${st.rows}+i。` },
        { k: '本步结果',
          v: st.phase === 'done'
            ? `内存顺序 [${st.mem.map(m=>m!.v).join('、')}]。扫一行步长 **${st.rowStride}**、扫一列步长 **${st.colStride}** —— 步长 1 的那个连续、快。`
            : st.cur ? `A[${st.cur.i}][${st.cur.j}]=${st.cur.v} 放进地址 ${st.cur.addr}。` : '' },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; layout: string; rowStride: number; colStride: number; cur: {addr:number}|null }
      return st.phase === 'done' ? `${st.layout} · 行步长 ${st.rowStride} / 列步长 ${st.colStride}`
        : st.cur ? `@${st.cur.addr}` : st.layout
    },
    read: [
      { at: '矩阵格', is: '每格标着 [i,j]；颜色按"谁连续"分（row-major 按行、col-major 按列）。', anchor: '.lymat' },
      { at: '一维内存条', is: '按布局顺序摊平；同色的连续排在一起。', anchor: '.lymem' },
      { at: '步长对比', is: '扫一行 vs 扫一列的地址步长，步长 1 = 连续 = 快。', anchor: '.lystride' },
    ],
    try: [
      { act: '在 row-major / col-major 之间切', watch: '同一矩阵内存顺序变了：[1,2,3,4,5,6] ↔ [1,4,2,5,3,6]；行/列步长跟着互换。', param: '布局' },
      { act: '盯步长那两格', watch: 'row-major 扫行快(步长1)、扫列慢(步长3)；col-major 正好反过来 —— 决定矩阵乘该怎么访存。', param: '布局' },
    ],
    terms: ['layoutdef'],
  },
  matmul: {
    question: '神经网络里说的"矩阵乘"到底怎么算？为什么它是一切的地基？',
    step: (s: never) => {
      const st = s as { phase: string; row: number; col: number; terms: {a:number;b:number;prod:number}[]; value: number; M:number;K:number;N:number; flops:number; totalFlops:number }
      return [
        { k: '本步输入',
          v: st.phase === 'done' ? `${st.M}×${st.K} · ${st.K}×${st.N} 全算完` : `输出格 C[${st.row}][${st.col}]：A 第 ${st.row} 行、B 第 ${st.col} 列` },
        { k: '判定规则',
          v: `A[M×K]·B[K×N]=C[M×N]，**内维 K 必须对上**。每格 C[i][j] = A 第 i 行**点** B 第 j 列 = Σ 对应位相乘。` },
        { k: '本步结果',
          v: st.phase === 'done'
            ? `每格都是一行点一列。共 **${st.totalFlops}** 次浮点（2·M·N·K）。注意力 Q·Kᵀ、FFN 的 W·x 都是它 —— FlashAttention/张量并行切的就是这个乘法。`
            : `= ${st.terms.map(t=>t.a+'×'+t.b).join(' + ')} = **${st.value}**。累计 ${st.flops}/${st.totalFlops} FLOPs。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; row: number; col: number; value: number; M:number; N:number }
      return st.phase === 'done' ? `${st.M}×${st.N} 算完 · 每格一行点一列`
        : `C[${st.row}][${st.col}] = ${st.value}`
    },
    read: [
      { at: 'A·B→C 布局', is: 'A 在左下、B 在右上、C 在右下；当前格由 A 的行 × B 的列决定。', anchor: '.mmlayout' },
      { at: '高亮的行与列', is: '蓝行是 A 第 i 行、紫列是 B 第 j 列，它俩点积落到 C 那一格。', anchor: '.mmC' },
      { at: '点积展开', is: '一行点一列 = 对应位相乘再相加。', anchor: '.mmdot' },
      { at: 'FLOPs 条', is: '每格 2K 次浮点，共 2·M·N·K。', anchor: '.mmflops' },
    ],
    try: [
      { act: '一格一格点下去', watch: 'A 的行、B 的列高亮，点积落到 C 对应格；FLOPs 每格涨 2K。' },
      { act: '想想它在哪出现', watch: '注意力 Q·Kᵀ、FFN 的 W·x、LM 头投影全是矩阵乘 —— 这一个算法撑起整个网络。' },
    ],
    terms: ['matmuldef'],
  },
  softmax: {
    question: 'softmax 怎么把一串打分变成概率？温度到底调的是什么？',
    step: (s: never) => {
      const st = s as {
        phase: string; T: number; tokens: string[]; probs: number[]; entropy: number; sumExp: number
      }
      const top = st.probs.length ? Math.max(...st.probs) : 0
      return [
        { k: '本步输入',
          v: st.phase === 'logits'
            ? `模型对 ${st.tokens.length} 个候选 token 各打了一个 **logit**（可正可负、和不为 1）`
            : st.phase === 'scale'
              ? `温度 T = ${st.T}`
              : st.phase === 'exp'
                ? `温度缩放后的 logits`
                : `各 token 的 exp 值，总和 = ${st.sumExp.toFixed(2)}` },
        { k: '判定规则',
          v: st.phase === 'scale' || st.phase === 'logits'
            ? `**softmax**：每个 logit 取 exp，再除以所有 exp 的总和 → 得到非负、和为 1 的概率。`
              + `**温度**在 softmax 之前先把 logit 除以 T：T 小放大差距（分布尖）、T 大压平差距（分布匀）。`
            : `**归一化**：prob = exp(logit) ÷ Σexp。exp 保证非负、单调；除以总和保证和为 1。` },
        { k: '本步结果',
          v: st.phase === 'done'
            ? `分布出来了，熵 = **${st.entropy.toFixed(2)} bit**，最大概率 ${(top * 100).toFixed(0)}%。`
              + (st.T < 1 ? '低温 → 尖 → 接近贪心。' : st.T > 1 ? '高温 → 平 → 更随机。' : '基准温度。')
            : st.phase === 'norm'
              ? `归一化完成：概率和为 1，熵 ${st.entropy.toFixed(2)} bit。`
              : st.phase === 'exp'
                ? `exp 把负数也变正、把大的拉得更大，为归一化做准备。`
                : st.phase === 'scale'
                  ? `每个 logit 除以 T，差距被${st.T < 1 ? '放大' : st.T > 1 ? '压平' : '保持'}。`
                  : `logit 是原始打分，还不是概率。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; T: number; entropy: number; probs: number[] }
      if (st.phase !== 'done' && st.phase !== 'norm') return `softmax 计算中`
      const top = st.probs.length ? Math.round(Math.max(...st.probs) * 100) : 0
      return `熵 ${st.entropy.toFixed(2)} bit · 最大 ${top}%`
    },
    read: [
      { at: 'logit 条', is: '原始打分，可正可负（正向右、负向左）。', anchor: '.smsect' },
      { at: '概率条', is: '归一化后的分布，非负、和为 1；越尖越确定。', anchor: '.smbars' },
    ],
    try: [
      { act: '把温度 T 从 1 调到 2', watch: '同样的 logits，分布变平、熵变大 —— 更随机、更有创造性。', param: '温度 T' },
      { act: '把 T 调到 0.5', watch: '分布变尖、熵变小 —— 越来越接近"只选最大的那个"（贪心）。', param: '温度 T' },
      { act: '换成「接近平局」的 logits', watch: '几个 logit 很接近时，softmax 出来的概率也很接近，熵很高。', param: 'logits 组' },
    ],
    terms: ['softmaxdef', 'temp', 'entropy'],
  },
  attention: {
    question: '自注意力怎么让每个词"看"全句？Q、K、V 各是干嘛的？',
    step: (s: never) => {
      const st = s as {
        phase: string; qi: number; tokens: string[]; scores: number[]; attn: number[][]; out: number[]
      }
      const w = st.qi >= 0 ? st.attn[st.qi] : []
      const top = w.length ? st.tokens[w.indexOf(Math.max(...w))] : ''
      return [
        { k: '本步输入',
          v: st.phase === 'setup'
            ? `每个 token 带三个向量：**Q**（我要找什么）· **K**（我能被谁找到）· **V**（我携带的信息）`
            : st.phase === 'done'
              ? `${st.tokens.length} 个查询都算完了`
              : `查询 token「**${st.tokens[st.qi]}**」，要决定它该关注全句里的谁` },
        { k: '判定规则',
          v: st.phase === 'sum'
            ? `**加权求和**：out = Σ 注意力权重 × 各 token 的 V。关注得越多，那个 token 的信息占比越大。`
            : st.phase === 'softmax' || st.phase === 'score'
              ? `**缩放点积注意力**：分数 = Q·K / √d（点积衡量相关，除 √d 防 softmax 饱和），再 softmax 成和为 1 的权重。`
              : `Q/K/V 已经投影好（真实模型里由 embedding 乘三个矩阵得到）。下面逐个查询算注意力。` },
        { k: '本步结果',
          v: st.phase === 'score'
            ? `「${st.tokens[st.qi]}」和每个 token 的 K 点积 → 分数 [${st.scores.map(x => x.toFixed(1)).join(' ')}]。分数越高越相关`
            : st.phase === 'softmax'
              ? `softmax 后权重 [${w.map(x => (x * 100).toFixed(0) + '%').join(' ')}]，「${st.tokens[st.qi]}」最关注「**${top}**」`
              : st.phase === 'sum'
                ? `「${st.tokens[st.qi]}」的新表示 = [${st.out.map(x => x.toFixed(1)).join(' ')}]，已融入最相关 token 的信息`
                : st.phase === 'done'
                  ? `矩阵每一行是"一个词对全句的关注分配" —— 每个词都根据全局重新理解了自己`
                  : `准备逐个查询。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; qi: number; tokens: string[]; attn: number[][] }
      if (st.phase === 'done') return `${st.tokens.length} 个词各算完注意力`
      const w = st.qi >= 0 ? st.attn[st.qi] : []
      if (w.length) return `「${st.tokens[st.qi]}」最关注「${st.tokens[w.indexOf(Math.max(...w))]}」`
      if (st.qi >= 0) return `查询「${st.tokens[st.qi]}」`
      return `Q / K / V`
    },
    read: [
      { at: '注意力连线', is: '当前查询到每个 token 的线；线越粗越深＝关注越多。', anchor: '.atflow' },
      { at: '注意力矩阵', is: '行=查询、列=键，格子越深权重越高，逐行长出来。', anchor: '.atmat' },
      { at: '算式', is: '分数 Q·K/√d → softmax → 加权求和 V，三步现算。', anchor: '.atcalc' },
    ],
    try: [
      { act: '逐步走完一个查询', watch: '先和每个 K 点积得分数、softmax 成权重、再按权重把各 V 加起来 —— 这就是一次注意力。' },
      { act: '换成「猫追老鼠」例句', watch: 'Q/K/V 变了，注意力矩阵完全不同 —— 每个词关注谁，由向量之间的相似度决定。', param: '例句' },
    ],
    terms: ['qkv', 'scaleddot', 'softmaxdef'],
  },
  llmsize: {
    question: '7B 为什么要十几 G 显存？参数都堆在哪、KV 缓存又吃多少？',
    step: (s: never) => {
      const st = s as {
        phase: string; L: number; d: number; total: number; embed: number
        attnPerLayer: number; ffnPerLayer: number; weightBytes: number; kvBytes: number; dtype: string; bytes: number; seq: number
      }
      const gb = (b: number) => (b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : (b / 1e6).toFixed(0) + ' MB')
      const bn = (n: number) => (n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : (n / 1e6).toFixed(0) + 'M')
      return [
        { k: '本步输入',
          v: st.phase === 'kv' || st.phase === 'done'
            ? `序列长度 ${st.seq}、精度 ${st.dtype}（每参数 ${st.bytes} 字节）`
            : `模型 ${st.L} 层、d_model ${st.d}` },
        { k: '判定规则',
          v: st.phase === 'kv'
            ? `**KV 缓存** = 2（K 和 V）× 层数 × 序列长 × d × 字节。它是**每序列**的额外显存，跟并发数一起线性涨。`
            : st.phase === 'weight'
              ? `**权重显存** = 总参数 × 每参数字节数。fp16 是 2 字节 —— "7B×2=14G"就是这么来的。`
              : `**参数量**逐块算：embedding = vocab×d；每层注意力 = 4d²（Q/K/V/O）；每层 FFN = 2·ffn·d²。总数 = embedding + 层数×两者之和。` },
        { k: '本步结果',
          v: st.phase === 'embed' ? `词嵌入 ${bn(st.embed)} 参数。`
            : st.phase === 'attn' ? `每层注意力 ${bn(st.attnPerLayer)}。`
            : st.phase === 'ffn' ? `每层 FFN ${bn(st.ffnPerLayer)} —— 通常是参数大头。`
            : st.phase === 'total' ? `总参数 **${bn(st.total)}**。`
            : st.phase === 'weight' ? `权重占 **${gb(st.weightBytes)}**（${st.dtype}）。换 fp32 翻倍、int8 减半 —— 量化就在这省。`
            : st.phase === 'kv' ? `KV 缓存 **${gb(st.kvBytes)}** / 序列（长 ${st.seq}）。`
            : `权重是固定开销、KV 随并发和序列长涨 —— 推理显存两大块。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; total: number; weightBytes: number; dtype: string }
      const gb = (b: number) => (b / 1e9).toFixed(1) + ' GB'
      if (st.phase === 'done' || st.phase === 'weight' || st.phase === 'kv') return `${(st.total / 1e9).toFixed(2)}B · 权重 ${gb(st.weightBytes)}（${st.dtype}）`
      if (st.total) return `总参数 ${(st.total / 1e9).toFixed(2)}B`
      return `逐块拆参数`
    },
    read: [
      { at: '参数拆解条', is: '嵌入 / 注意力×层 / FFN×层 三块，FFN 往往最大。', anchor: '.lsstack' },
      { at: '显存条', is: '权重是固定开销，KV 随序列和并发涨。', anchor: '.lsmem' },
    ],
    try: [
      { act: '把精度从 fp16 切到 int8', watch: '权重显存直接减半 —— 这就是量化省显存的原理。', param: '精度' },
      { act: '把序列长度从 512 拉到 8192', watch: '权重一点没变，但 KV 缓存翻了十几倍 —— 长上下文贵在 KV。', param: '序列长度' },
      { act: '在 GPT-2 和 7B 之间切', watch: '同样的公式，参数量差 50 倍，显存跟着差 50 倍。', param: '模型' },
    ],
    terms: ['params', 'kvmem'],
  },
  sampling: {
    question: '吐字前 top-k / top-p 在砍什么？它们和温度怎么配合？',
    step: (s: never) => {
      const st = s as {
        phase: string; T: number; k: number; p: number; tokens: string[]
        order: number[]; kept: boolean[]; final: number[]
      }
      const keptN = st.kept.filter(Boolean).length
      return [
        { k: '本步输入',
          v: st.phase === 'softmax'
            ? `softmax 后的概率分布（温度 T=${st.T}）`
            : `按概率降序：${st.order.map(i => st.tokens[i]).slice(0, 5).join(' > ')}…` },
        { k: '判定规则',
          v: st.phase === 'topk'
            ? `**top-k**：只留概率最高的 ${st.k > 0 ? st.k : '（关）'} 个，其余置 0 —— 按**个数**截断。`
            : st.phase === 'topp'
              ? `**top-p（核采样）**：概率从大到小累加，留累计刚超过 ${st.p} 的一小撮 —— 按**累计概率**截断，分布尖只留一两个、分布平自动多留。`
              : st.phase === 'renorm'
                ? `**重新归一化**：留下的概率除以它们的总和，重新凑成和为 1。`
                : `先 softmax，再排序，长尾一堆低概率 token 直接采容易蹦出离谱词，所以要截断。` },
        { k: '本步结果',
          v: st.phase === 'topk'
            ? (st.k > 0 ? `留下 ${keptN} 个，砍掉 ${st.tokens.length - keptN} 个。` : `top-k 关闭，不按个数截。`)
            : st.phase === 'topp'
              ? (st.p < 1 ? `核里剩 ${keptN} 个候选。` : `top-p 关闭。`)
              : st.phase === 'renorm'
                ? `归一化完成，就在这 ${keptN} 个候选里随机采一个。`
                : st.phase === 'done'
                  ? `最终从 ${keptN} 个候选采样（原本 ${st.tokens.length} 个）—— 三个旋钮一起定"多稳/多野"。`
                  : `分布出来了，准备排序截断。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { phase: string; k: number; p: number; kept: boolean[]; tokens: string[] }
      const keptN = st.kept.filter(Boolean).length
      if (st.phase === 'done' || st.phase === 'renorm') return `采样集 ${keptN} / ${st.tokens.length} 个`
      if (st.phase === 'topk') return `top-k=${st.k > 0 ? st.k : '关'} · 留 ${keptN}`
      if (st.phase === 'topp') return `top-p=${st.p < 1 ? st.p : '关'} · 留 ${keptN}`
      return `准备截断`
    },
    read: [
      { at: '概率条', is: '按概率降序；被砍的变灰打 ✕，留下的重新归一化。', anchor: '.spbars' },
      { at: '累计 Σ', is: 'top-p 用：概率从大到小累加，越过 p 就停。', anchor: '.spcum' },
      { at: '旋钮现值', is: '温度、top-k、top-p 三个旋钮当前的值。', anchor: '.spknobs' },
    ],
    try: [
      { act: '把 top-p 从 1 调到 0.5', watch: '只留累计到 50% 的那一两个 —— 越保守、越稳。', param: 'top-p' },
      { act: '把 top-k 设 2、top-p 关（=1）', watch: '硬留 2 个，不管它们概率多接近。top-k 按个数、top-p 按累计，两种取向。', param: 'top-k' },
      { act: '换「两强争锋」的 logits', watch: '两个概率接近时，top-p 会自动两个都留，top-k=1 却只留一个 —— 这时 top-p 更合理。', param: 'logits 组' },
    ],
    terms: ['topk', 'topp'],
  },
  bpe: {
    question: 'BPE 怎么把文本切成 token？中文为什么就更贵？',
    step: (s: never) => {
      const st = s as { act: string; toks: string[]; pair: [string, string] | null; merged: string; start: number; ruleLeft: number }
      return [
        { k: '本步输入',
          v: st.act === 'init'
            ? `文本先拆成最小单位：${st.toks.join(' ')}（${st.start} 个）`
            : st.act === 'done'
              ? `合并结束`
              : st.pair ? `相邻的 ${st.pair[0]} 和 ${st.pair[1]}` : `当前序列 ${st.toks.join(' ')}` },
        { k: '判定规则',
          v: `**BPE**：按训练好的 merge 表（按学到的先后排序），把**高频相邻对**合成一个 token。merge 表主要在英文上学 —— 英文常见组合都在表里、能一路合并；中文的组合大多不在，合并不动。` },
        { k: '本步结果',
          v: st.act === 'merge'
            ? `合成 **${st.merged}** → 现在 ${st.toks.length} 个 token。`
            : st.act === 'nomerge'
              ? `没有可用的合并 —— 每个符号各算一个 token。`
              : st.act === 'done'
                ? `${st.start} 符号 → **${st.toks.length}** token。${st.toks.length < st.start ? '压得短、便宜' : '合并不动、贵'}`
                : `准备逐条套用 merge 表。` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { act: string; toks: string[]; start: number }
      if (st.act === 'done') {
        const r = Math.round((st.toks.length / Math.max(1, st.start)) * 100)
        return `${st.start} 符号 → ${st.toks.length} token（压到 ${r}%）`
      }
      if (st.act === 'merge') return `合成 · 剩 ${st.toks.length} token`
      if (st.act === 'nomerge') return `合并不动`
      return `拆分中`
    },
    read: [
      { at: 'token 序列', is: '当前 token；深色是合并出来的多字符 token，高亮是本步刚合成的。', anchor: '.bptoks' },
      { at: '压缩条', is: '压到原符号数的百分比 —— 越短、token 越少、越便宜。', anchor: '.bpbar' },
    ],
    try: [
      { act: '看「英文 lowest」', watch: '6 个字符一路合并成 1 个 token —— 英文常见词在 merge 表里，压得很短。', param: '例子' },
      { act: '换成「中文 你好」', watch: 'merge 表里没有它们的组合，合并不动，每个字各算一个 token —— 这就是中文更贵的原因。', param: '例子' },
    ],
    terms: ['bpe', 'tokencost'],
  },
  batching: {
    question: '推理引擎怎么把长短不一的请求凑成 batch？连续批处理省在哪？',
    step: (s: never) => {
      const st = s as { act: string; mode: string; active: string[]; done: string[]; admitted: string[]; waiting: string[]; util: number; slots: number; step: number }
      return [
        { k: '本步输入',
          v: st.act === 'done'
            ? `全部请求处理完`
            : `第 ${st.step} 步，${st.slots} 个 GPU 槽；排队 ${st.waiting.length} 个` },
        { k: '判定规则',
          v: st.mode === 'cont'
            ? `**连续批处理**：每个 decode 步都检查 —— 有请求吐完就离场，腾出的空槽**立刻**补进排队的请求，不等整批跑完。`
            : `**静态批处理**：凑一批一起跑，中途不接新请求，直到整批全部吐完才收下一批 —— 空出来的槽只能干等。` },
        { k: '本步结果',
          v: st.act === 'idle'
            ? `GPU 空转 —— 没有已到达的请求可跑。`
            : st.act === 'done'
              ? `${st.mode === 'cont' ? '连续：空槽随时补，GPU 几乎没闲着' : '静态：每批等最慢的跑完，空槽白白浪费'}。`
              : `batch [${[...st.active, ...st.done].join(' ')}] 各吐一个 token${st.done.length ? `，${st.done.join('、')} 离场` : ''}${st.admitted.length ? `，补入 ${st.admitted.join('、')}` : ''}。利用率 ${Math.round(st.util * 100)}%` },
      ]
    },
    verdict: (s: never) => {
      const st = s as { act: string; mode: string; util: number; step: number }
      if (st.act === 'done') return `${st.mode === 'cont' ? '连续' : '静态'} · 用了 ${st.step} 步`
      if (st.act === 'idle') return `空转 · 0%`
      return `利用率 ${Math.round(st.util * 100)}%`
    },
    read: [
      { at: 'GPU batch 槽', is: '实线是在跑、虚线是空槽；绿色离场、高亮是本步补入的。', anchor: '.bqslots' },
      { at: '排队 / 完成', is: '已到达还没进 batch 的排队中，跑完的进已完成。', anchor: '.bqqueue' },
    ],
    try: [
      { act: '在「连续」和「静态」之间切', watch: '静态每批要等最慢的跑完、空槽闲置；连续吐完就补，利用率高得多、总步数更少。', param: '批处理方式' },
      { act: '把槽数调大', watch: '能同时跑更多请求，但也更吃显存 —— 槽数受 KV 缓存显存约束。', param: 'batch 槽数' },
    ],
    terms: ['contbatch', 'gpuutil'],
  },
}

// ═══════════════════════════════════════════════════════════════
//  导览：把上面这些内容摊成一串**有序的卡**
// ═══════════════════════════════════════════════════════════════

/**
 * 悬浮卡里的一页。
 *
 * 顺序就是「‹ 1/N ›」翻页的顺序，也是新手真实的卡壳顺序：
 * 这一屏在问什么 → 屏幕上每块是什么 → 先拧什么看什么 → 名词。
 */
/**
 * 卡片正文可以是**函数** —— 拿当前这一步的状态现算。
 *
 * 为什么要这个：静态卡片只能写"组、路、tag 是什么"，那是**组件说明书**；
 * 而读者真正缺的是"这一个地址进来之后，第一步、第二步、第三步到底发生了什么"。
 * 那句话必须提到**此刻屏幕上这个具体的地址、这一行、这几个方框**，
 * 写死就不成立 —— 下一步它就变了。
 *
 * 边界跟实验单 ④ 同一条：**只从验过的轨迹派生，不接运行时模型**。
 */
/**
 * 「本步推演」的一段。`k` 是段名，`v` 是这一步现算出来的内容。
 *
 * 分成四段而不是一段散文，是因为**结构本身就是要教的东西**：
 * 每一步都在回答同样四个问题（这次的输入是什么 → 本步按什么规则走 →
 * 因此状态怎么变 → 这个结果在画面哪儿看得到）。写成散文，
 * 用户得自己从句子里把这四段扒出来；写成四格，翻到第三个实验时
 * 他已经知道该往哪儿看了。
 */
export type WhyPart = { k: string; v: string }

export type Card = {
  id: string
  title: string
  body: string
  /** 讲到这一页时高亮页面上的哪块；反过来，点了那块也跳到这一页 */
  anchor?: string
  /** 高亮参数面板里的某一项（按 `.k` 的文字前缀找，选择器表达不了） */
  param?: string
  /** 高亮某个预置按钮（按按钮文字精确匹配） */
  preset?: string
  /** 这一页提到的名词 —— 渲染成可点的链接，跳到对应的名词页 */
  see?: string[]
  /**
   * `'ref'` = **参考层**：点到了才讲，不进首轮翻页。
   *
   * ## 为什么要分这一层
   *
   * 卡组一路长到 28 张：读数一张、每个参数一张、每个预置一张、每个术语一张、
   * 页面每块一张。挨个翻完，用户读到的是一本**组件说明书** ——
   * 「轴是什么」「参数怎么改」「tag 是什么」，一句都没错，
   * 而看完还是不知道这一屏在推演什么。
   *
   * 首轮只留三张：**这一屏在问什么**（对象）、**本步推演**（单步规则）、
   * **第一项实验**（动手）。剩下的全在这一层 —— 它们照样点得到
   * （点哪讲哪那条路不变），只是不再堵在主干上。
   */
  tier?: 'ref'
}

const termCardId = (id: string) => `term:${id}`

/**
 * 摊平时用得上的运行期信息 —— 参数规格与预置清单都在注册表里，
 * 而这个文件不能 import 注册表（它拖着 `@engine/*` 与 .tsx，纯 node 的单元测试进不来）。
 * 所以由 App 在渲染时喂进来。
 */
export type GuideContext = {
  params?: { key: string; label: string; options: readonly (string | number)[]; unit?: string }[]
  seqPresets?: readonly { label: string; note: string }[]
  entPresets?: readonly { label: string; note: string }[]
  hasSequence?: boolean
  hasEntities?: boolean
}

/**
 * 摊平成卡片序列。**不另存一份数据**：卡是从上面那三块现算出来的，
 * 内容只有一处真源。
 *
 * ## 覆盖面是这里的第一目标
 *
 * 用户要的是「点哪儿都有说明」。所以除了手写的那几张，还**派生**出三类：
 *
 *   预置按钮 → 直接用它的 `note`。那句话本来就是一个**能被证伪的行为主张**
 *              （`tests/presets-claims.test.ts` 逐条验过），拿来当讲解比另写一份强：
 *              按钮上写什么、讲解里说什么、测试验什么，是同一句话。
 *   参数旋钮 → 没有手写"试一试"覆盖到的，补一张说清选项与它改的是什么。
 *   页面区域 → 轴 / 日志 / 读数 / 真题 / 边界…（就是 TOUR 那一串），
 *              合进每个实验的序列里，于是这些地方在**任何实验下**都点得到。
 *
 * 再加上「简介卡锚在 `.stagewrap` 上」这一条：舞台里任何一处点下去，
 * 往上找总能落到简介 —— **不会出现"点了没反应"**。
 */
export function cardsOf(expId: string, ctx: GuideContext = {}): Card[] {
  const g = GUIDES[expId]
  if (!g) return []

  //  手写的"试一试"已经覆盖到的旋钮与预置，不再重复派生一张
  const coveredParams = new Set(g.try.map(t => t.param).filter(Boolean) as string[])
  const coveredPresets = new Set(g.try.map(t => t.preset).filter(Boolean) as string[])

  const cards: Card[] = [
    { id: 'intro', title: '这一屏在问什么', body: g.question, anchor: '.stagewrap', see: g.terms.slice(0, 3) },
    //  推演那一张紧跟着问题 —— 先跟完一次，再去看"组件都叫什么"
    //  基础卡：名词先认识，再谈这一步在干什么。锚到舞台 —— 它们讲的就是那张图
    ...(g.basics ?? []).map((b, i) => ({
      id: `basic${i}`, title: b.title, body: b.body, anchor: '.stagewrap',
    } as Card)),
    /*  推演本身在舞台底下那条带子里（`shell/WhyBand.tsx`），这里只留一张指路的卡。
        两处印同一段文字是浪费 —— 而这一张的活是**告诉人那条带子会跟着走**，
        不然它看起来就像又一条静态说明。 */
    ...(g.step ? [{
      /*  ⚠️ 两个住处都写上：推演在旁栏时是 `.whyband`，搬到右栏时是 `.whyrail`
          （见 types.ts 的 whyInRail）。只写一个的那版，Cache 这张卡
          "声明了锚点却落不下" —— 卡还在，指过去是空的。 */
      id: 'why', title: '本步推演', anchor: '.whyband, .whyrail',
      /*  ⚠️ 只留一句。四个段名屏幕上就写着，卡里再抄一遍是**同一件事说两遍** ——
          而这张卡每多一行，浮层就得高 18px，它被"不许压住可点元素"那条判据卡着，
          高不上去就只能裁字。真正要说的只有一件：它是活的。 */
      body: '这条带子跟着轴走 —— 按一下「下一步」，四段全会改写成新那一步的内容。',
    } as Card] : []),
    /*  第一项实验留在主干（用户："第一项实验"），其余全降级 ——
        三条动手挨个翻，等于把实验单又抄了一遍。 */
    ...g.try.slice(0, 1).map((t, i) => ({
      id: `try${i}`, title: `试一试 · ${t.act}`, body: t.watch,
      ...(t.param ? { param: t.param } : {}),
      ...(t.preset ? { preset: t.preset } : {}),
      ...(!t.param && !t.preset ? { anchor: '.stagewrap' } : {}),
    })),
    ...g.read.map((r, i) => ({ id: `read${i}`, title: r.at, body: r.is, anchor: r.anchor, tier: 'ref' as const })),
    ...g.try.slice(1).map((t, i0) => { const i = i0 + 1; return {
      id: `try${i}`, title: `试一试 · ${t.act}`, body: t.watch, tier: 'ref' as const,
      ...(t.param ? { param: t.param } : {}),
      ...(t.preset ? { preset: t.preset } : {}),
      ...(!t.param && !t.preset ? { anchor: '.stagewrap' } : {}),
    } }),
    ...(ctx.seqPresets ?? []).filter(x => !coveredPresets.has(x.label)).map(x => ({
      id: `preset:${x.label}`, title: `预置 · ${x.label}`, body: x.note, preset: x.label, tier: 'ref' as const,
    })),
    ...(ctx.entPresets ?? []).filter(x => !coveredPresets.has(x.label)).map(x => ({
      id: `epreset:${x.label}`, title: `预置 · ${x.label}`, body: x.note, preset: x.label, tier: 'ref' as const,
    })),
    ...(ctx.params ?? []).filter(x => !coveredParams.has(x.label)).map(x => ({
      id: `param:${x.key}`, title: `参数 · ${x.label}`,
      body: `可选 ${x.options.join(' / ')}${x.unit ? ' ' + x.unit : ''}。改了立刻重跑整条轨迹 —— 轴、读数、逐步日志都会跟着变。`,
      param: x.label, tier: 'ref' as const,
    })),
    ...g.terms.map(id => {
      const t = TERMS.find(x => x.id === id)!
      /*  术语降级为参考层（用户原话："把术语表降级为参考层"）——
          它答的是"这个词叫什么"，不是"这一步在发生什么"。 */
      return { id: termCardId(id), title: t.term, body: t.gloss, tier: 'ref' as const }
    }),
  ]

  //  页面各区域并进来：这些地方在任何实验下都点得到。
  //  锚点已经被上面用掉的（比如 `.stagewrap`）跳过 —— 同一个元素挂两张卡，
  //  点它只会跳到前面那张，后一张永远到不了，摆着是骗人。
  const used = new Set(cards.map(c => c.anchor).filter(Boolean))
  const has = {
    params: (ctx.params?.length ?? 0) > 0,
    sequence: !!ctx.hasSequence,
    entities: !!ctx.hasEntities,
  }
  for (const [i, r] of TOUR.entries()) {
    if (used.has(r.anchor)) continue
    if (r.need && !has[r.need]) continue
    cards.push({ id: `tour${i}`, title: `页面 · ${r.at}`, body: r.is, anchor: r.anchor, tier: 'ref' })
  }
  return cards
}

export { termCardId }

// ═══════════════════════════════════════════════════════════════
//  第二层：字段级的悬停说明
// ═══════════════════════════════════════════════════════════════

/**
 * **一行能说完的东西不该占一张卡。**
 *
 * 用户的原话：「有些字段比较简单，可以在鼠标移动上去的时候展示标签说明就可以了。」
 * 对的 —— 读数栏里「Work」「装填因子 α」「ssthresh」这种，要的是一句话，
 * 不是把讲解卡翻过去。
 *
 * 这跟 Transformer Explainer 的分层是同一套：它有两个层次 ——
 * `Tooltip`（悬停，一行，比如那个 `Q · K^T` 气泡）和
 * `TextbookTooltip`（点开，把讲解卡翻到那一页）。前者管"这是什么"，
 * 后者管"这为什么重要"。
 *
 * ## 写哪些、不写哪些
 *
 * **只写名字自己说不清的。**「命中」「缺失」「轮次」不用写 —— 给一个把名字
 * 重念一遍的提示，比没有提示更烦。写的是 `Work`、`校验子`、`带权周转` 这类
 * 术语，以及那些**看着眼熟但含义有坑**的（「已定位」和「局部有序」差在哪）。
 *
 * 值以 `@` 开头时引用词表里的解释 —— 同一句话不写两遍。
 */
export const TIPS: Record<string, string> = {
  // ── 通用 / 组成原理 ──
  '命中率': '命中次数 ÷ 总访问次数，是**到这一步为止**的滚动值，不是最终值。',
  'tag': '@tagidx',
  '组号': '@tagidx',
  '块内偏移': '@tagidx',
  '被挤掉': '这一步为了腾位置而被换出去的那一块。命中时没有人被挤掉。',
  '本步结果': '这一步是命中还是缺失。轴上那一格的颜色就是它。',
  '相联度': '@setassoc',
  '替换策略': '@lru',
  '精度': 'single 是 32 位（阶码 8 + 尾数 23），double 是 64 位（11 + 52）。',
  '已确定位': '推导到这一步为止，32 位里已经定下来的那些位。',
  '判断位': 'Booth 看的是相邻两位的组合，靠它决定这一轮加、减还是只移位。',
  '部分积': '逐位乘法的中间结果，每轮累加并右移一位，最后就是乘积。',
  '本周期停顿': '这一拍有几条指令因为数据冒险停着不动（气泡）。',
  '本周期前递': '这一拍有没有把还没写回的结果直接送给下一段。',
  '本周期冲刷': '分支猜错时要把已经进流水线的错误指令清掉，清掉几条。',
  '前递开关': '@forward',
  'TLB 命中': '@tlb',
  '查页表': 'TLB 没中才查页表，多一次访存。',
  '虚页号': '@vaddr',
  '页内偏移': '@vaddr',
  '缺页率': '缺页次数 ÷ 访问次数。物理块越多通常越低 —— 但 FIFO 会出反例。',
  '换出页': '这一步被挤出内存的那一页。',

  // ── 操作系统 ──
  '当前时刻': '甘特图上的横坐标。每一步推进一个时间单位。',
  '就绪队列': '已经到达、等着上 CPU 的进程，按当前算法排的序。',
  '剩余时间': '各进程还差多少服务时间才跑完。',
  '本步移动': '这一步磁头移动了多少个磁道。',
  '累计寻道': '@seek',
  '扫描方向': 'SCAN 一族要靠它决定下一步往哪边走 —— 题目里这个条件不能漏读。',
  'Work': '银行家算法里"当前可用资源"的工作副本。每假设一个进程跑完，就把它已占的加回来。',
  '已入序列': '已经被证明"能安全跑完"的那些进程，按被选中的顺序排。',
  '安全序列': '@safeseq',
  '本步试探': '这一轮在试哪个进程的 Need 能不能被 Work 满足。',
  '其中外碎片': '@fragment',
  '空闲块数': '空闲分区的个数。同样的空闲总量，块数越多越碎。',
  '每块指针数 K': '一个磁盘块能装下多少个指针 = 块大小 ÷ 指针大小。它决定各级间址能覆盖多少块。',
  '落在': '这个逻辑块号落在直接地址、一级间址还是二级间址区。',
  '磁盘访问': '取到这一块要访问几次磁盘 —— 每多一级间址就多一次。',
  'empty（空位）': '缓冲区还剩几个空格子。生产者 P 它，满了就阻塞。',
  'full（产品）': '缓冲区里有几件产品。消费者 P 它，空了就阻塞。',
  'mutex（锁）': '@semaphore',
  '第一块的字号': '@bitmap',
  '第一块的位号': '@bitmap',

  // ── 数据结构 ──
  '已定位': '@settled',
  '局部有序': '@settled',
  '手持值': '挖坑法：这一刻手里端着的那个值，坑还没填上 —— 所以数组看起来会少一个。',
  '划分次序': '快排每次划分把基准放到最终位置，这里记的是第几次划分。',
  '当前距离': 'Dijkstra 到这一步为止，从源点到各点已知的最短距离（还可能被松弛得更小）。',
  '是否更新': '这一步的松弛有没有真的改小某个距离。',
  '平衡因子': '@bf',
  '旋转次数': '@rotate',
  '阶 m': '@border',
  '分裂次数': '结点装满时把中间的键提到父结点，一共分裂了几次。',
  '装填因子 α': '已装入的关键字数 ÷ 表长。它一上去，所有冲突处理方式的 ASL 都变差。',
  'ASL 成功': '@asl',
  'ASL 失败': '查一个**不在表里**的关键字平均要比较几次 —— 通常比成功那个大得多。',
  '探查次数': '这一次插入/查找一共探了几个槽才停下。',
  '是否冲突': '算出来的初始地址上已经有人了没有。',
  'WPL': '@wpl',
  '森林剩余': '哈夫曼每合并一次，森林里的树就少一棵。剩 1 棵时结束。',
  'next 数组': '@next',
  '主串指针 i': '@noback',
  '模式指针 j': '失配时它按 next 往回退，主串那个不退。',
  '主串前进次数': 'KMP 相对暴力法省下多少，看的就是它 —— 主串指针只增不减。',
  '总权值': '@mst',
  '本步边': '这一步在考虑哪条边，以及要它还是不要（要不要的理由在日志里）。',
  '树中顶点': 'Prim 已经连上的那一堆点，下一条边只能从这堆往外挑。',
  '拓扑序列': '@topo',
  '总工期': '@critical',
  '关键活动': '@critical',
  '生成树边数': '遍历过程中"第一次访问某个点"用掉的边。连通图上应当等于顶点数 − 1。',
  '栈内容': 'DFS 用栈：后进先出，所以它一条路走到黑。',

  // ── 计算机网络 ──
  'cwnd': '@cwnd',
  'ssthresh': '@ssthresh',
  '所处阶段': '@phases',
  '本轮事件': '这一轮有没有丢包，以及是超时还是三次重复 ACK —— 两者的惩罚差很多。',
  '发送窗口': '已发出但还没被确认的帧最多能有几个。',
  '接收方期待': '接收方下一个想收的序号。GBN 只认这个号，别的一律丢。',
  '信道在途': '此刻正在链路上飞、还没到达的帧。',
  '其中重传': '累计传输里有多少次是重传的 —— GBN 与 SR 的差距就在这个数上。',
  '生成多项式': '@crc',
  '校验位数': '等于生成多项式的次数。',
  '当前商': '模 2 除法的商，其实用不上 —— CRC 只要余数。',
  '余数': '模 2 除法的余数就是校验位，附在数据后面构成码字。',
  '校验子': '@hamming',
  '码长': '数据位 + 校验位。海明码要求 2^校验位数 ≥ 码长 + 1。',
  '前缀': '@mask',
  '客户端状态': '@handshake',
  '服务器状态': '@handshake',
  '争用期': '以太网上信号一个来回的时间（2τ）。退避等的就是若干个争用期。',
  '各站冲突次数': '每个站已经冲突几次 —— 它决定各自的退避区间有多宽。',
  '已放弃': '@backoff',
}

/** 取某个字段的一行说明；没有就返回 null（名字自己说得清的不给提示）。 */
export function tipFor(label: string): string | null {
  const raw = TIPS[label]
  if (!raw) return null
  if (!raw.startsWith('@')) return raw
  return TERMS.find(t => t.id === raw.slice(1))?.gloss ?? null
}
