# 假仿真排查（2026-09-03）

判据:实验的"步"是**真状态转移**(该用走带)还是**把一次计算/一个函数拆成幻灯片**(假仿真)。
softmax 已按"温度当轴"改好(commit 432cb61),作为范式。

## 结论:三档

### A. 真仿真(REAL)——不动，大多数
过程/迭代/序列/状态机/物理·RL rollout。步与步之间状态真在推进。
排序搜索图:binsearch sort quicksort mergesort quickselect heap astar dijkstra mst topo traverse
  unionfind nqueens bloom skiplist trie(走查) hashtable expr fastpow greedy editdist(DP填表·边界) kmp
数据结构/树:avl bplus btree(遍历)
OS/系统:page cache disk vm scheduler partition bitmap banker(检查序列) mempaging bufferpool
并发:cas aba deadlock mesi semaphore rwlock lockstrategy blockingqueue happensbefore(实为剧本·见B) mvcc
分布式/后端:raft twopc quorum vectorclock consistenthash tokenbucket wal lsm minikv minisearch
  seckill mqdesign urlshortener snowflake(发号·借步) circuitbreaker compositeindex queryplan(选路)
网络:tcp arq csma rip handshake subnet(走查·见B)
ML迭代:graddesc linreg logreg perceptron kmeans knn svm(找边界) dtree gbdt pagerank pca(降维步·借B) bayes(证据累积) recsys
DL:backprop rnn lstm gan diffusion gcn conv(滑窗·借B) pooling
大模型过程:beam bestofn mcts tot rag selfconsist specdec bpe kvcache kvoffload radix paged
  batching chunkprefill pp collective engine ep flash flashdecode moe tensorpar
Agent:reactagent planning reflection toolcall subagent ctxcompact memretrieve memwrite permguard promptbuild engram
RL/控制/物理:qlearn qlearning mdp ppo policygrad pid mpc impedance kalman ekf ukf particlefilter
  complementary computedtorque contactlcp foc fwddyn collision slam icp diffpolicy vla teleop miniduck
规划:rrt rrtconnect rrtstar prm dstarlite potentialfield chomp trajectory

### B. 假仿真·可换轴(FAKE-SWEEP)——**该改,像 softmax**
轴其实是"把一个函数分幕",真正在变的是某个**参数**,该把它当轴、播放=扫描它。
**B1 破的(轴是"步骤/计算阶段"、参数藏在侧栏)——高优先:**
- ✅**sampling** 采样解码——已换轴:top-p 从紧到松扫描,看核长大(commit 869a2d6)
- ✅**quant** 权重量化——已换轴:位宽 int8→int2 扫描,看精度换显存(commit 3305c01)
- ✅**ik** 二连杆逆解——已换轴:目标距离 r 由近到远扫描,多解→奇异(r=L1+L2 合并)→无解(commit 待填)
- ✅**jacobian** 雅可比——已换轴:θ2 从 90°→0° 扫描,det=L1L2sinθ2→0 逼近奇异
- **inode** i 节点寻址——扫**逻辑块号** 看直接→一/二/三级间接跨界(子代理确认)
- **hashaval** 雪崩——扫**输入扰动** 看输出翻转≈一半(子代理确认)
- ~~residual~~ **实为 REAL(误判)**:细读内核=梯度沿层倒传的真递归(gradPlain*=factor、两条曲线随层累积),是真过程,不动。归 A。
- ~~maxent~~ **实为 B2(误判)**:内核 MUS=[3.5..5.5] 本就是"扫约束 μ"、每帧重算最大熵分布,结构已对;顶多把轴标签/舞台打磨,不用换轴。
**B2 已经是正确扫描形态(轴就是参数)——结构没问题,顶多把舞台做得像 softmax 那样"看它形变":**
condnum(κ) clt(样本数n) lln(撒点n) ortho(维度d) scale(维度d) dotsim(夹角θ) roofline(批大小)
  jl(投影维K) linattn(序列N) lowrank(秩k) rope(位置) llmsize(规模/seq·子代理) joins(表规模·子代理) birthday(人数)

### C. 假仿真·手算走查(FAKE-STATIC)——低优先,多数当"手把手算"尚可接受
一次算完/固定结构按顺序画出,无可扫参数。要改就改静态展示;但作为"教你一步步手算"可留。
密码学:caesar vigenere xorcipher aesround hmac merkle signature salt rsa diffiehellman crt extgcd
  modpow fermat otpreuse totp ecbcbc
组成原理算术:matmul multiply addsub float
编码校验:crc hamming
Transformer 拆解:mha scaledmask norm rmsnorm forward xent wordvec attention(逐query·借A)
视觉/机器人闭式计算:pinhole pnp stereo vo quat rnea dyneom fk handeye
LeRobot/杂:lerobot layout normstats deltats induction

## 建议顺序
先啃 **B1**(8 个,和 softmax 同病、ROI 最高;sampling 第一,它就是 softmax 的续集)。
再看 **B2** 舞台打磨(结构已对)。**C** 视情况(很多"手算走查"其实可留)。**A** 不动。

> 注:本表由 3 个子代理详判(handeye→llmsize 段)+ 其余按 axis 标签/算法性质归类;个别 C/B 边界可再核。
