/**
 * 休眠条目：**用户当前点不到**的实验的出题内容，从 catalog.ts 搬过来的 113 条。
 *
 * 两类，都不是"删了"：
 *   · 隐藏的具身智能轨（registry.ts 里那条职业线 status: 'hidden'）—— 改回 'active' 整轨就回来；
 *   · 已下线的后端/安全轨孤儿组（数据库系统 / 并发编程 / 分布式系统 / 密码学 /
 *     系统设计 / 项目实战）—— 实验本身还在 registry.ts 里，只是没有职业线挂它们了。
 *
 * **搬家不改行为。** 这些条目照旧汇进 CATALOG（见 catalog.ts 末尾），
 * 出题、判据、讲解一个字都没变。搬的理由只有一个：catalog.ts 是 390KB 的单文件，
 * 197 条里 113 条点不到，改题时纯属挡路。
 *
 * 要让它们重新出得了题，动的是 web/src/registry.ts 的职业线配置，不是这个文件。
 */
import { numDistractors, trivialDoc, last, type CatalogEntry, type Frame, type Kernel, type SimDocument } from '../catalog-shared.ts'
import { mvccKernel } from '../../src/kernels/mvcc.ts'
import { isoKernel } from '../../src/kernels/iso.ts'
import { casKernel } from '../../src/kernels/cas.ts'
import { mesiKernel } from '../../src/kernels/mesi.ts'
import { deadlockKernel } from '../../src/kernels/deadlock.ts'
import { raftKernel } from '../../src/kernels/raft.ts'
import { caesarKernel } from '../../src/kernels/caesar.ts'
import { vigenereKernel } from '../../src/kernels/vigenere.ts'
import { xorKernel } from '../../src/kernels/xorcipher.ts'
import { modpowKernel } from '../../src/kernels/modpow.ts'
import { dhKernel } from '../../src/kernels/diffiehellman.ts'
import { rsaKernel } from '../../src/kernels/rsa.ts'
import { extgcdKernel } from '../../src/kernels/extgcd.ts'
import { signKernel } from '../../src/kernels/signature.ts'
import { hashavalKernel } from '../../src/kernels/hashaval.ts'
import { merkleKernel } from '../../src/kernels/merkle.ts'
import { crtKernel } from '../../src/kernels/crt.ts'
import { fermatKernel } from '../../src/kernels/fermat.ts'
import { saltKernel } from '../../src/kernels/salt.ts'
import { tokenbucketKernel } from '../../src/kernels/tokenbucket.ts'
import { consistentHashKernel } from '../../src/kernels/consistenthash.ts'
import { skiplistKernel } from '../../src/kernels/skiplist.ts'
import { twopcKernel } from '../../src/kernels/twopc.ts'
import { otpreuseKernel } from '../../src/kernels/otpreuse.ts'
import { ecbcbcKernel } from '../../src/kernels/ecbcbc.ts'
import { birthdayKernel } from '../../src/kernels/birthday.ts'
import { aesroundKernel } from '../../src/kernels/aesround.ts'
import { hmacKernel } from '../../src/kernels/hmac.ts'
import { totpKernel } from '../../src/kernels/totp.ts'
import { snowflakeKernel } from '../../src/kernels/snowflake.ts'
import { vectorclockKernel } from '../../src/kernels/vectorclock.ts'
import { quorumKernel } from '../../src/kernels/quorum.ts'
import { circuitbreakerKernel } from '../../src/kernels/circuitbreaker.ts'
import { joinsKernel } from '../../src/kernels/joins.ts'
import { compositeindexKernel } from '../../src/kernels/compositeindex.ts'
import { rwlockKernel } from '../../src/kernels/rwlock.ts'
import { abaKernel } from '../../src/kernels/aba.ts'
import { happensbeforeKernel } from '../../src/kernels/happensbefore.ts'
import { actteKernel } from '../../src/kernels/actte.ts'
import { deltatsKernel } from '../../src/kernels/deltats.ts'
import { normstatsKernel } from '../../src/kernels/normstats.ts'
import { teleopKernel } from '../../src/kernels/teleop.ts'
import { miniduckKernel } from '../../src/kernels/miniduck.ts'
import { focKernel } from '../../src/kernels/foc.ts'
import { lockstrategyKernel } from '../../src/kernels/lockstrategy.ts'
import { bufferpoolKernel } from '../../src/kernels/bufferpool.ts'
import { feedKernel } from '../../src/kernels/feed.ts'
import { fkKernel } from '../../src/kernels/fk.ts'
import { dyneomKernel } from '../../src/kernels/dyneom.ts'
import { rneaKernel } from '../../src/kernels/rnea.ts'
import { fwddynKernel } from '../../src/kernels/fwddyn.ts'
import { computedtorqueKernel } from '../../src/kernels/computedtorque.ts'
import { contactlcpKernel } from '../../src/kernels/contactlcp.ts'
import { ikKernel } from '../../src/kernels/ik.ts'
import { jacobianKernel } from '../../src/kernels/jacobian.ts'
import { quatKernel } from '../../src/kernels/quat.ts'
import { trajectoryKernel } from '../../src/kernels/trajectory.ts'
import { icpKernel } from '../../src/kernels/icp.ts'
import { slamKernel } from '../../src/kernels/slam.ts'
import { impedanceKernel } from '../../src/kernels/impedance.ts'
import { mpcKernel } from '../../src/kernels/mpc.ts'
import { bcKernel } from '../../src/kernels/bc.ts'
import { diffpolicyKernel } from '../../src/kernels/diffpolicy.ts'
import { vlaKernel } from '../../src/kernels/vla.ts'
import { lerobotKernel } from '../../src/kernels/lerobot.ts'
import { kalmanKernel } from '../../src/kernels/kalman.ts'
import { ekfKernel } from '../../src/kernels/ekf.ts'
import { pinholeKernel } from '../../src/kernels/pinhole.ts'
import { pointcloudKernel } from '../../src/kernels/pointcloud.ts'
import { stereoKernel } from '../../src/kernels/stereo.ts'
import { handeyeKernel } from '../../src/kernels/handeye.ts'
import { voKernel } from '../../src/kernels/vo.ts'
import { pnpKernel } from '../../src/kernels/pnp.ts'
import { particlefilterKernel } from '../../src/kernels/particlefilter.ts'
import { ukfKernel } from '../../src/kernels/ukf.ts'
import { complementaryKernel } from '../../src/kernels/complementary.ts'
import { pidKernel } from '../../src/kernels/pid.ts'
import { rrtKernel } from '../../src/kernels/rrt.ts'
import { rrtconnectKernel } from '../../src/kernels/rrtconnect.ts'
import { dstarliteKernel } from '../../src/kernels/dstarlite.ts'
import { libraryKernel } from '../../src/kernels/library.ts'
import { rrtstarKernel } from '../../src/kernels/rrtstar.ts'
import { potentialfieldKernel } from '../../src/kernels/potentialfield.ts'
import { chompKernel } from '../../src/kernels/chomp.ts'
import { trapezoidKernel } from '../../src/kernels/trapezoid.ts'
import { gjkKernel } from '../../src/kernels/gjk.ts'
import { dubinsKernel } from '../../src/kernels/dubins.ts'
import { prmKernel } from '../../src/kernels/prm.ts'
import { mdpKernel } from '../../src/kernels/mdp.ts'
import { qlearningKernel } from '../../src/kernels/qlearning.ts'
import { policygradKernel } from '../../src/kernels/policygrad.ts'
import { ppoKernel } from '../../src/kernels/ppo.ts'
import { objectstoreKernel } from '../../src/kernels/objectstore.ts'
import { queryplanKernel } from '../../src/kernels/queryplan.ts'
import { blockingqueueKernel } from '../../src/kernels/blockingqueue.ts'
import { walKernel } from '../../src/kernels/wal.ts'
import { lsmKernel } from '../../src/kernels/lsm.ts'
import { minikvKernel } from '../../src/kernels/minikv.ts'
import { urlshortenerKernel } from '../../src/kernels/urlshortener.ts'
import { seckillKernel } from '../../src/kernels/seckill.ts'
import { minisearchKernel } from '../../src/kernels/minisearch.ts'
import { mqdesignKernel } from '../../src/kernels/mqdesign.ts'

export const DORMANT_ENTRIES: CatalogEntry[] = [
  {
    id: 'mvcc',
    title: 'MVCC 快照读',
    kernel: mvccKernel as Kernel<unknown>,
    doc: trivialDoc('mvcc'),
    facts: [
      {
        id: 'reread', label: '快照隔离下 T1 第二次读到的值',
        ask: 'MVCC 可重复读：T1、T2 同时开始，T1 先读 x=100，随后 T2 把 x 改成 200 并提交。T1 再次读 x，读到的值是多少?',
        kind: 'number',
        compute: t => {
          const reads = t.filter(f => f.op === 'read')
          const f = reads[reads.length - 1] ?? last(t)
          return { answer: String(f.readValue), step: t.indexOf(f), evidence: String(f.log ?? '') }
        },
        distractors: () => ['200', '150', '50'],
      },
      {
        id: 'versions', label: '调度结束后 x 的版本数',
        ask: 'MVCC 写不覆盖旧值而是追加版本。这个调度全部结束后，行 x 一共有多少个版本?',
        kind: 'number',
        compute: t => ({ answer: String((last(t).versions as unknown[]).length), step: t.length - 1, evidence: `版本链长度 = ${(last(t).versions as unknown[]).length}` }),
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'iso',
    title: '事务隔离级别',
    kernel: isoKernel as Kernel<unknown>,
    // 与 registry defaultDoc 一致:读已提交。
    doc: { kind: 'iso', params: { level: '读已提交' }, entities: [], streams: [] },
    facts: [
      {
        id: 'rc_third_read', label: '读已提交下 T1 第三次读到的值',
        ask: '读已提交(RC)隔离级别下：T1 读 x=100，之后 T2 把 x 改成 200 并提交，T1 第三次读 x 读到多少?',
        kind: 'number',
        compute: t => {
          const reads = t.filter(f => f.op === 'read')
          const f = reads[reads.length - 1] ?? last(t)
          return { answer: String(f.readValue), step: t.indexOf(f), evidence: String(f.log ?? '') }
        },
        distractors: () => ['100', '150', '0'],
      },
      {
        id: 'rc_anomaly', label: '读已提交挡不住的读现象',
        ask: '读已提交(RC)能挡住脏读，但挡不住下面哪一种读现象?',
        kind: 'choice',
        compute: () => ({ answer: '不可重复读', step: 0, evidence: 'RC 只读已提交值→无脏读；但两次读之间别的事务提交了新值→不可重复读' }),
        distractors: () => ['脏读', '幻读', '三种都能挡住'],
      },
    ],
  },
  {
    id: 'cas',
    title: 'CAS 无锁自增',
    kernel: casKernel as Kernel<unknown>,
    doc: trivialDoc('cas'),
    facts: [
      {
        id: 'final_x', label: '3 线程 CAS 自增后的最终值',
        ask: '3 个线程各用 CAS 做一次 x++（x 初值 0），期间有线程读到旧值发生竞争。CAS 保证不丢更新，最终 x 等于多少?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).x), step: t.length - 1, evidence: `终值 x=${last(t).x}、成功 ${last(t).succeeds} 次` }),
        distractors: () => ['2', '1', '4'],
      },
      {
        id: 'retries', label: 'CAS 失败重试次数',
        ask: '上题中，因为被别的线程抢先修改，CAS 一共失败并重试了多少次?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).fails), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'mesi',
    title: 'MESI 缓存一致性',
    kernel: mesiKernel as Kernel<unknown>,
    doc: trivialDoc('mesi'),
    facts: [
      {
        id: 'invalidations', label: '缓存行被失效的总次数',
        ask: 'MESI 协议：两个核对同一个 x 交替读写。整个过程里，缓存行副本一共被失效(Invalidate)了多少次?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).invalidated), step: t.length - 1, evidence: `终态 invalidated=${last(t).invalidated}` }),
        distractors: numDistractors,
      },
      {
        id: 'write_invalidate', label: '一个核写时其它核副本的状态',
        ask: 'MESI 里，某个核要写 x 时，会先把其它核持有的这个缓存行副本置为哪个状态?',
        kind: 'choice',
        compute: () => ({ answer: 'I（Invalid 失效）', step: 0, evidence: '写前先 Invalidate 其它副本，自己升 M' }),
        distractors: () => ['S（Shared 共享）', 'E（Exclusive 独占）', 'M（Modified 已改）'],
      },
    ],
  },
  {
    id: 'deadlock',
    title: '死锁检测',
    kernel: deadlockKernel as Kernel<unknown>,
    doc: trivialDoc('deadlock'),
    facts: [
      {
        id: 'cycle_len', label: '死锁环上的线程数',
        ask: '三个线程交叉加锁：T1 持 A 等 B、T2 持 B 等 C、T3 持 C 等 A。用等待图检测，死锁环上一共有几个线程?',
        kind: 'number',
        compute: t => {
          const cyc = last(t).cycle as number[]
          return { answer: String(cyc.length), step: t.length - 1, evidence: `环 = ${cyc.map(x => 'T' + x).join('→')}` }
        },
        distractors: () => ['2', '4', '1'],
      },
      {
        id: 'detect_vs_avoid', label: '等待图找环属于哪种死锁处理',
        ask: '用「等待图找环」来发现死锁，属于下面哪一种死锁处理策略?',
        kind: 'choice',
        compute: () => ({ answer: '死锁检测', step: 0, evidence: '先让死锁发生、再检测出来；银行家算法才是分配前判断的死锁避免' }),
        distractors: () => ['死锁避免（银行家算法）', '死锁预防', '鸵鸟策略（不处理）'],
      },
    ],
  },
  {
    id: 'raft',
    title: 'Raft 共识',
    kernel: raftKernel as Kernel<unknown>,
    doc: trivialDoc('raft'),
    facts: [
      {
        id: 'majority', label: '3 节点集群的多数派门槛',
        ask: 'Raft 3 节点集群：选主要拿到几票才能当选 Leader、一条日志要复制到几个节点才能提交?',
        kind: 'number',
        compute: t => ({ answer: String(last(t).majority), step: t.length - 1, evidence: `多数派 = ⌊3/2⌋+1 = ${last(t).majority}` }),
        distractors: () => ['3', '1', '4'],
      },
      {
        id: 'commit_rule', label: '日志何时算已提交',
        ask: 'Raft 里，一条日志什么时候才算「已提交(committed)」、可以安全应用到状态机?',
        kind: 'choice',
        compute: () => ({ answer: '被复制到多数派(过半)节点后', step: 0, evidence: '复制到过半即提交；任何两个多数派必有交集，保证不丢' }),
        distractors: () => ['Leader 写入自己日志后', '所有节点都复制后', '客户端收到确认后'],
      },
    ],
  },
  {
    id: 'caesar',
    title: '凯撒密码',
    kernel: caesarKernel as Kernel<unknown>,
    doc: trivialDoc('caesar'),
    facts: [
      {
        id: 'cipher', label: 'HELLO 用 k=3 加密的结果',
        ask: '凯撒密码，密钥 k=3（每个字母后移 3 位）：明文 HELLO 加密后是什么?',
        kind: 'choice',
        compute: t => ({ answer: String(last(t).cipher), step: t.length - 1, evidence: String(last(t).log ?? '') }),
        distractors: () => ['EBIIL', 'KHOOS', 'IFMMP'],
      },
      {
        id: 'keyspace', label: '凯撒密码的密钥空间大小',
        ask: '凯撒密码一共只有多少种不同的密钥（因此暴力破解极其容易）?',
        kind: 'number',
        compute: () => ({ answer: '25', step: 0, evidence: '26 个字母，位移 1~25 共 25 种有效密钥（0 位移=不加密）' }),
        distractors: () => ['26', '52', '128'],
      },
    ],
  },
  {
    id: 'vigenere', title: '维吉尼亚密码', kernel: vigenereKernel as Kernel<unknown>, doc: trivialDoc('vigenere'),
    facts: [{
      id: 'cipher', label: 'HELLO 用关键词 KEY 加密的结果',
      ask: '维吉尼亚密码，关键词 KEY（循环）：明文 HELLO 加密后是什么?', kind: 'choice',
      compute: t => ({ answer: String(last(t).cipher), step: t.length - 1, evidence: String(last(t).log ?? '') }),
      distractors: () => ['RIJVX', 'HIJVS', 'KHOOR'],
    }],
  },
  {
    id: 'xor', title: '异或加密', kernel: xorKernel as Kernel<unknown>, doc: trivialDoc('xor'),
    facts: [{
      id: 'selfinverse', label: '异或加密如何解密',
      ask: '异或加密：密文 = 明文 XOR 密钥。要把密文解回明文，该怎么做?', kind: 'choice',
      compute: () => ({ answer: '密文再 XOR 同一个密钥', step: 0, evidence: '异或自反：c XOR k XOR k = m' }),
      distractors: () => ['密文 XOR 反转的密钥', '密文减去密钥', '密文再加密一次'],
    }],
  },
  {
    id: 'modpow', title: '快速模幂', kernel: modpowKernel as Kernel<unknown>, doc: trivialDoc('modpow'),
    facts: [{
      id: 'result', label: '3^13 mod 7 的值',
      ask: '用快速模幂计算 3^13 mod 7，结果是多少?', kind: 'number',
      compute: t => ({ answer: String(last(t).result), step: t.length - 1, evidence: String(last(t).log ?? '') }),
      distractors: () => ['2', '5', '1'],
    }],
  },
  {
    id: 'diffiehellman', title: 'DH 密钥交换', kernel: dhKernel as Kernel<unknown>, doc: trivialDoc('diffiehellman'),
    facts: [{
      id: 'shared', label: 'DH 双方算出的共享密钥',
      ask: 'Diffie-Hellman：p=23、g=5，Alice 私钥 a=6、Bob 私钥 b=15。双方算出的共享密钥是多少?', kind: 'number',
      compute: t => ({ answer: String(last(t).aliceShared), step: t.length - 1, evidence: String(last(t).log ?? '') }),
      distractors: () => ['8', '19', '5'],
    }],
  },
  {
    id: 'rsa', title: 'RSA 公钥加密', kernel: rsaKernel as Kernel<unknown>, doc: trivialDoc('rsa'),
    facts: [
      {
        id: 'privkey', label: 'RSA 私钥 d',
        ask: 'RSA：p=3、q=11、e=3。私钥 d 满足 e·d≡1 (mod φ)，φ=(p-1)(q-1)。d 等于多少?', kind: 'number',
        compute: t => ({ answer: String(last(t).d), step: t.length - 1, evidence: `φ=${last(t).phi}，${last(t).e}·d≡1 → d=${last(t).d}` }),
        distractors: () => ['3', '11', '20'],
      },
      {
        id: 'cipher', label: 'RSA 加密 m=4 的密文',
        ask: 'RSA：n=33、e=3，明文 m=4。密文 c=m^e mod n 是多少?', kind: 'number',
        compute: t => ({ answer: String(last(t).c), step: t.length - 1, evidence: `4^3 mod 33 = 64 mod 33 = ${last(t).c}` }),
        distractors: () => ['64', '4', '27'],
      },
    ],
  },
  {
    id: 'extgcd', title: '扩展欧几里得求模逆', kernel: extgcdKernel as Kernel<unknown>, doc: trivialDoc('extgcd'),
    facts: [{
      id: 'inverse', label: '3 关于模 20 的逆元',
      ask: '用扩展欧几里得求 3 关于模 20 的逆元 d（使 3·d ≡ 1 mod 20），d 等于多少?', kind: 'number',
      compute: t => ({ answer: String(last(t).result), step: t.length - 1, evidence: String(last(t).log ?? '') }),
      distractors: () => ['13', '3', '9'],
    }],
  },
  {
    id: 'signature', title: '数字签名', kernel: signKernel as Kernel<unknown>, doc: trivialDoc('signature'),
    facts: [{
      id: 'who', label: '数字签名用哪个钥签、哪个钥验',
      ask: '数字签名（与加密相反）：签名和验证分别用什么钥?', kind: 'choice',
      compute: () => ({ answer: '私钥签名、公钥验证', step: 0, evidence: '只有私钥持有者签得出，任何人用公钥都能验' }),
      distractors: () => ['公钥签名、私钥验证', '都用私钥', '都用公钥'],
    }],
  },
  {
    id: 'hashaval', title: '哈希雪崩效应', kernel: hashavalKernel as Kernel<unknown>, doc: trivialDoc('hashaval'),
    facts: [{
      id: 'flipped', label: 'cat→cot 后 16 位哈希翻转的位数',
      ask: '哈希雪崩：把 "cat" 改成 "cot"（一个字母），16 位哈希翻转了多少位?', kind: 'number',
      compute: t => { const f = t.find(x => x.b === 'cot') ?? last(t); return { answer: String(f.flipped), step: t.indexOf(f), evidence: `cat→cot 翻转 ${f.flipped}/16 位，约一半` } },
      distractors: answer => { const f = Number(answer); return [String(f + 2), String(Math.max(0, f - 3)), '1'] },
    }],
  },
  {
    id: 'merkle', title: 'Merkle 树', kernel: merkleKernel as Kernel<unknown>, doc: trivialDoc('merkle'),
    facts: [{
      id: 'verify_cost', label: '验证一个块需要几个兄弟哈希',
      ask: 'Merkle 树最大的好处：验证某一个数据块没被改，需要多少个哈希（n 个块）?', kind: 'choice',
      compute: () => ({ answer: 'O(log n) 个兄弟哈希', step: 0, evidence: '沿路径到根，每层一个兄弟，不用下载全部数据' }),
      distractors: () => ['全部 n 个块的哈希', '只要根哈希 1 个', 'O(n) 个'],
    }],
  },
  {
    id: 'crt', title: '中国剩余定理', kernel: crtKernel as Kernel<unknown>, doc: trivialDoc('crt'),
    facts: [{
      id: 'x', label: '除3余2、除5余3、除7余2 的数',
      ask: '一个数除以 3 余 2、除以 5 余 3、除以 7 余 2。用中国剩余定理，这个数(0~104 内)是几?', kind: 'number',
      compute: t => ({ answer: String(last(t).x), step: t.length - 1, evidence: String(last(t).log ?? '') }),
      distractors: () => ['128', '17', '52'],
    }],
  },
  {
    id: 'fermat', title: '费马素性测试', kernel: fermatKernel as Kernel<unknown>, doc: trivialDoc('fermat'),
    facts: [{
      id: 'verdict', label: '费马测试对 15 的判定',
      ask: '费马素性测试：2^14 mod 15 = 4 ≠ 1。这说明 15 是什么?', kind: 'choice',
      compute: () => ({ answer: '一定是合数', step: 0, evidence: 'a^(n-1) mod n ≠ 1 是合数的铁证' }),
      distractors: () => ['一定是素数', '可能是素数', '无法判断'],
    }],
  },
  {
    id: 'salt', title: '盐与密码哈希', kernel: saltKernel as Kernel<unknown>, doc: trivialDoc('salt'),
    facts: [{
      id: 'why', label: '加盐的作用',
      ask: '存密码哈希时为什么要「加盐」(每个用户配一个随机盐再哈希)?', kind: 'choice',
      compute: () => ({ answer: '让相同密码的哈希也不同，使彩虹表失效', step: 0, evidence: '盐打散哈希，攻击者必须对每个盐单独暴力' }),
      distractors: () => ['让哈希更快', '让密码更短', '让密码可以解密还原'],
    }],
  },
  {
    id: 'tokenbucket', title: '令牌桶限流', kernel: tokenbucketKernel as Kernel<unknown>, doc: trivialDoc('tokenbucket'),
    facts: [{
      id: 'total', label: '令牌桶放行的请求总数',
      ask: '令牌桶：容量 5、速率 1/tick，各刻到达 [3,4,2,1,5]。一共放行了多少个请求?', kind: 'number',
      compute: t => ({ answer: String(last(t).totalAllowed), step: t.length - 1, evidence: `放行 ${last(t).totalAllowed}、拒绝 ${last(t).totalRejected}` }),
      distractors: () => ['15', '5', '6'],
    }],
  },
  {
    id: 'consistenthash', title: '一致性哈希', kernel: consistentHashKernel as Kernel<unknown>, doc: trivialDoc('consistenthash'),
    facts: [{
      id: 'moved', label: '加节点后需要搬动的键数',
      ask: '一致性哈希：环上原有 3 个节点、4 个键。加入 1 个新节点后，大约需要搬动多少个键（对比 hash%N 几乎全搬）?', kind: 'choice',
      compute: () => ({ answer: '只搬一小段（本例 1 个）', step: 0, evidence: '只有新节点到前一节点之间的键需要重新归属' }),
      distractors: () => ['几乎所有键（和 hash%N 一样）', '全部 4 个', '0 个'],
    }],
  },
  {
    id: 'skiplist', title: '跳表 Skip List', kernel: skiplistKernel as Kernel<unknown>, doc: trivialDoc('skiplist'),
    facts: [{
      id: 'complexity', label: '跳表查找的平均复杂度',
      ask: '跳表（多层索引链表）查找一个值的平均时间复杂度是?', kind: 'choice',
      compute: () => ({ answer: 'O(log n)', step: 0, evidence: '高层快车道跳过大段节点，逐层逼近' }),
      distractors: () => ['O(n)', 'O(1)', 'O(n log n)'],
    }],
  },
  {
    id: 'twopc', title: '两阶段提交 2PC', kernel: twopcKernel as Kernel<unknown>, doc: trivialDoc('twopc'),
    facts: [{
      id: 'commit_cond', label: '2PC 何时提交',
      ask: '两阶段提交：协调者在阶段二什么情况下才广播 Commit（否则全体 Abort）?', kind: 'choice',
      compute: () => ({ answer: '所有参与者阶段一都投 Yes', step: 0, evidence: '只要有一个 No 或超时就 Abort' }),
      distractors: () => ['多数参与者投 Yes', '协调者自己决定', '第一个参与者投 Yes'],
    }],
  },
  {
    id: 'otpreuse', title: '一次一密密钥重用', kernel: otpreuseKernel as Kernel<unknown>, doc: trivialDoc('otpreuse'),
    facts: [{
      id: 'leak', label: '同密钥加密两消息，异或密文得到什么',
      ask: '一次一密用同一个密钥 k 加密了两条消息(c1=m1⊕k, c2=m2⊕k)。攻击者把两段密文异或 c1⊕c2，得到什么?', kind: 'choice',
      compute: () => ({ answer: 'm1⊕m2（密钥被抵消，泄露明文关系）', step: 0, evidence: 'k⊕k=0，剩下 m1⊕m2' }),
      distractors: () => ['密钥 k', '乱码，什么也得不到', 'm1 和 m2'],
    }],
  },
  {
    id: 'wal', title: '预写日志 WAL', kernel: walKernel as Kernel<unknown>, doc: trivialDoc('wal'),
    facts: [{
      id: 'order', label: 'WAL 的核心规则',
      ask: '预写日志(WAL)保证持久性的核心规则是什么?', kind: 'choice',
      compute: () => ({ answer: '先把操作写入日志并落盘，再改数据页', step: 0, evidence: '日志落盘后崩溃可重放恢复' }),
      distractors: () => ['先改数据页，再写日志', '数据和日志同时写', '只写数据不写日志'],
    }],
  },
  {
    id: 'lsm', title: 'LSM-Tree', kernel: lsmKernel as Kernel<unknown>, doc: trivialDoc('lsm'),
    facts: [{
      id: 'why_fast', label: 'LSM-Tree 写得快的原因',
      ask: 'LSM-Tree(LevelDB/RocksDB 用)为什么写入这么快?', kind: 'choice',
      compute: () => ({ answer: '写进内存表、满了整块顺序刷盘，把随机写变顺序写', step: 0, evidence: '避免了改磁盘 B+树的随机写' }),
      distractors: () => ['直接原地改磁盘 B+树', '不落盘只在内存', '用更快的哈希'],
    }],
  },
  {
    id: 'minikv', title: '迷你 KV 存储', kernel: minikvKernel as Kernel<unknown>, doc: trivialDoc('minikv'),
    facts: [
      {
        id: 'bloom_role', label: '布隆过滤器在读路径上的作用',
        ask: 'LSM 型 KV 存储的读路径上，布隆过滤器起什么作用?', kind: 'choice',
        compute: () => ({ answer: '布隆说"一定不在"时直接返回，省掉查磁盘 SSTable 的 I/O', step: 0, evidence: 'get(z) 被布隆挡下，不查盘' }),
        distractors: () => ['加密存储的键', '给键排序', '压缩 SSTable'],
      },
      {
        id: 'write_path', label: 'KV 写入的第一步',
        ask: '这个迷你 KV 存储执行 put(k,v) 时，第一步做什么（保证宕机不丢）?', kind: 'choice',
        compute: () => ({ answer: '先写 WAL 日志并落盘', step: 0, evidence: '先日志后数据，崩溃可重放' }),
        distractors: () => ['先写进 SSTable', '先更新布隆过滤器', '先分片到其它节点'],
      },
      {
        id: 'newest_wins', label: 'LSM 更新后 get 读到哪个版本',
        ask: 'LSM 存储里，key a 先写 1、后又写 9（两个版本在不同 SSTable）。get(a) 读到几?', kind: 'number',
        compute: t => {
          const reads = (t as { op?: string; result?: string }[]).filter(f => f.op === 'get' && f.result && f.result !== '不存在')
          return { answer: String(reads[0]?.result ?? 9), step: 0, evidence: '读时从新到旧扫 SSTable，最新版本先命中' }
        },
        distractors: () => ['1', '报错', '0'],
      },
    ],
  },
  {
    id: 'urlshortener', title: '设计短链系统', kernel: urlshortenerKernel as Kernel<unknown>, doc: trivialDoc('urlshortener'),
    facts: [
      {
        id: 'shortcode', label: '短码生成为什么用发号器+Base62',
        ask: '短链的短码生成，为什么推荐「唯一发号器 + Base62 编码」，而不是「哈希长链」或「十进制自增明文」?', kind: 'choice',
        compute: () => ({ answer: '发号器发自增 ID 天然唯一、不碰撞；Base62 把 ID 编码得又短（1亿→"6LAze"只5位）。哈希会碰撞要处理冲突，十进制明文能被顺号爬遍且更长', step: 1, evidence: 'URL#1 发号 100000000 → Base62 逐位编码 → "6LAze"；62^6≈568亿够用' }),
        distractors: () => ['哈希更快所以更好', '发号器不需要唯一性', '直接用十进制自增明文最简单'],
      },
      {
        id: 'base62_reversible', label: '短码怎么跳回长 URL',
        ask: '用户访问短码（如 /6LAze），系统怎么找回原来的长 URL?', kind: 'choice',
        compute: () => ({ answer: '把短码 Base62 解码回 ID（按 62 进制累加，正好等于当初发的号，可逆），拿 ID 查映射表得长 URL，返回 302 跳转', step: 4, evidence: '"6LAze" 解码 = 100000000 = 发号时的 ID；编码/解码是可逆的一对' }),
        distractors: () => ['遍历所有长 URL 挨个哈希比对', '短码里直接存了长 URL', '每次都重新发一个号'],
      },
    ],
  },
  {
    id: 'seckill', title: '设计秒杀系统', kernel: seckillKernel as Kernel<unknown>, doc: trivialDoc('seckill'),
    facts: [
      {
        id: 'why_oversell', label: 'naive 扣库存为什么超卖',
        ask: '库存 2 件、3 个请求同抢，naive「读库存→判>0→写回」为什么会卖出 3 件(超卖)?', kind: 'choice',
        compute: () => ({ answer: '读-判-写三步不是原子的：R3 在 R2 写回之前就读了库存、读到同一个旧值 1，两个请求都判 1>0 成立、各扣一次 → 库存 -1、卖出 3', step: 6, evidence: 'naive 幕真跑出：库存 = -1、卖出 = 3（初始只有 2）' }),
        distractors: () => ['库存数配置写错了', 'Redis 太慢没扣及时', '请求数超过库存所以必然超卖'],
      },
      {
        id: 'atomic_fix', label: '原子 DECR 怎么防超卖',
        ask: '同样库存 2、3 个请求同抢，怎么改才绝不超卖?', kind: 'choice',
        compute: () => ({ answer: 'Redis 原子 DECR：把读-判-写合成一个不可打断的操作，DECR 返回值 <0 就回滚拒绝；同批请求卖出恰好 2、不超卖。落库再用 DB 乐观锁 where stock>0 兜底', step: 10, evidence: '原子幕：R1→1、R2→0 都抢到，R3→-1 回滚拒绝，卖出 = 2' }),
        distractors: () => ['直接 UPDATE 数据库库存', '加分布式锁串行下单', '前端限制点击就够了'],
      },
    ],
  },
  {
    id: 'minisearch', title: 'mini 搜索引擎', kernel: minisearchKernel as Kernel<unknown>, doc: trivialDoc('minisearch'),
    facts: [
      {
        id: 'idf_rare', label: '为什么稀有词排名更靠前',
        ask: '语料 D1「猫爱吃鱼」D2「狗爱吃肉」D3「猫猫玩鱼」，查询「猫 狗」。为什么只含一个词"狗"的 D2 反而排第一?', kind: 'choice',
        compute: () => ({ answer: '"狗"只在 1 篇出现(df=1)，idf=ln(3/1)=1.10 远高于"猫"的 ln(3/2)=0.41——稀有词更能区分相关性', step: 8, evidence: 'score(D2)=1×1.10=1.10 > score(D3)=2×0.41=0.81 > score(D1)=1×0.41=0.41' }),
        distractors: () => ['因为 D2 文档最短', '因为"狗"笔画多', '因为 D2 排在最后'],
      },
      {
        id: 'tf_freq', label: '词频对排名的影响',
        ask: 'D1 和 D3 都含查询词"猫"，为什么 D3 排在 D1 前面?', kind: 'choice',
        compute: () => ({ answer: '"猫"在 D3 出现 2 次(tf=2)、在 D1 出现 1 次(tf=1)，score=tf×idf，词频高→更相关', step: 8, evidence: 'score(D3,猫项)=2×0.41=0.81 > score(D1,猫项)=1×0.41=0.41' }),
        distractors: () => ['D3 的 idf 更高', 'D3 含更多查询词', '两者其实一样，随机排的'],
      },
    ],
  },
  {
    id: 'mqdesign', title: '设计消息队列', kernel: mqdesignKernel as Kernel<unknown>, doc: trivialDoc('mqdesign'),
    facts: [
      {
        id: 'ordering', label: '消息队列怎么保证顺序',
        ask: '要让同一个订单(同 key)的消息被顺序消费，消息队列怎么做?', kind: 'choice',
        compute: () => ({ answer: '只保证单个分区内有序；按 key 哈希路由到固定分区，同 key 消息就都进同一分区、按追加顺序天然有序。全局有序做不到（除非只用一个分区、牺牲并行）', step: 3, evidence: '本例 key=A 的下单#1、付款#1 都 hash 到分区1、offset 0 和 1，顺序不乱' }),
        distractors: () => ['全局所有分区都有序', '加副本就能保序', '消费者随机拉取即可'],
      },
      {
        id: 'offset_pubsub', label: '消息读走为什么不删除、offset 是谁的',
        ask: 'G1 已经消费过某条消息了，为什么换个消费组 G2 还能读到它?', kind: 'choice',
        compute: () => ({ answer: '消息读走不删除、一直留在日志里；"读到哪"是每个消费组自己记的 offset，各组独立。所以同一条消息被每个组各消费一遍(发布订阅)，把 offset 往回拨还能重放', step: 11, evidence: '本例 G1 把分区1读到 offset 3 后，G2 从 offset 0 照样读到「下单#1」' }),
        distractors: () => ['G2 读的是副本备份', '系统又重新生产了一条', 'offset 是全局共享的、G2 会跳过已读的'],
      },
    ],
  },
  {
    id: 'ecbcbc', title: 'ECB vs CBC 工作模式', kernel: ecbcbcKernel as Kernel<unknown>, doc: trivialDoc('ecbcbc'),
    facts: [
      {
        id: 'ecb_leak', label: '为什么 ECB 会泄露明文 pattern',
        ask: '明文里有重复块(P1=P3=1010)。为什么 ECB 模式加密后 C1 和 C3 也一模一样、把重复暴露了?', kind: 'choice',
        compute: () => ({ answer: 'ECB 每块独立、确定性加密(C=E(P))，相同明文块必得相同密文块，所以 C1=C3=1100，明文的重复结构直接暴露', step: 5, evidence: 'ECB 密文=[1100,1010,1100,0101]，C1=C3；这就是"ECB 企鹅"，加密后轮廓还在' }),
        distractors: () => ['因为密钥太短', '因为块是 4-bit 太小', 'ECB 其实不会泄露，是巧合'],
      },
      {
        id: 'cbc_chain', label: 'CBC 靠什么把重复块打散',
        ask: '同样是重复明文块(P1=P3)，为什么 CBC 加密后 C1≠C3、不泄露重复?', kind: 'choice',
        compute: () => ({ answer: 'CBC 有链接：每块先和上一块密文异或再加密(C=E(P⊕C₋₁))，同样的明文块每次异或的密文都不同，所以 C1≠C3', step: 10, evidence: 'CBC 密文=[0011,1001,0101,0000]，C1=0011≠C3=0101；再配随机 IV 连第一块都随机化' }),
        distractors: () => ['CBC 用了更长的密钥', 'CBC 把块顺序打乱了', 'CBC 每块换一个密钥'],
      },
    ],
  },
  {
    id: 'birthday', title: '生日攻击', kernel: birthdayKernel as Kernel<unknown>, doc: trivialDoc('birthday'),
    facts: [
      {
        id: 'sqrt_n', label: '找哈希碰撞大约要多少次',
        ask: '一个 n 位哈希输出空间是 2ⁿ。找到"任意一对"输入产生相同哈希，大约要试多少次?', kind: 'choice',
        compute: () => ({ answer: '约 √(2ⁿ) = 2^(n/2) 次（生日攻击），远小于 2ⁿ，所以抗碰撞需要的位数是抗原像的两倍', step: 10, evidence: '23 人就让生日碰撞过半；256 位哈希碰撞难度只有 2¹²⁸' }),
        distractors: () => ['要 2ⁿ 次（穷举整个空间）', '要 2ⁿ⁻¹ 次（一半空间）', '要 n 次'],
      },
      {
        id: 'why_fast', label: '为什么碰撞概率涨得比直觉快',
        ask: 'N=365 天，为什么只要 23 人就有过半概率两人同天生日（不用 183 人）?', kind: 'choice',
        compute: () => ({ answer: '比的是"任意一对"是否相同，对数是 C(k,2)≈k²/2，随人数平方增长，所以概率在约 √N 处就过半', step: 6, evidence: 'k=23 时可相撞的对有 253 对，碰撞概率 50.7%' }),
        distractors: () => ['因为每个人都和固定某一天比', '因为 365 天其实不够多', '巧合，换个数就不成立'],
      },
    ],
  },
  {
    id: 'aesround', title: 'AES 一轮', kernel: aesroundKernel as Kernel<unknown>, doc: trivialDoc('aesround'),
    facts: [
      {
        id: 'confuse_diffuse', label: 'AES 一轮四步分别负责什么',
        ask: 'AES 一轮的四步 SubBytes / ShiftRows / MixColumns / AddRoundKey，哪个负责"混淆"、哪些负责"扩散"?', kind: 'choice',
        compute: () => ({ answer: 'SubBytes(查S盒,非线性)负责混淆；ShiftRows(行移位)和 MixColumns(列GF混合)负责扩散；AddRoundKey 把密钥异或进来', step: 5, evidence: '混淆让密文↔密钥关系乱、扩散让一个明文位影响多个密文位；10 轮叠加后每位密文依赖所有明文和密钥位' }),
        distractors: () => ['AddRoundKey 负责混淆', 'SubBytes 负责扩散、MixColumns 负责混淆', '四步都只是异或'],
      },
      {
        id: 'sbox_nonlinear', label: 'AES 唯一的非线性步骤',
        ask: 'AES 一轮里哪一步是唯一的非线性变换（去掉它整个密码就会被线性代数破掉）?', kind: 'choice',
        compute: () => ({ answer: 'SubBytes——逐字节查 S-盒(GF(2⁸)求逆+仿射)，是唯一的非线性步骤；ShiftRows/MixColumns/AddRoundKey 都是线性的', step: 2, evidence: '没有 S-盒的非线性，密码退化成线性方程组，可被直接解出' }),
        distractors: () => ['MixColumns', 'ShiftRows', 'AddRoundKey'],
      },
    ],
  },
  {
    id: 'hmac', title: 'HMAC 消息认证', kernel: hmacKernel as Kernel<unknown>, doc: trivialDoc('hmac'),
    facts: [
      {
        id: 'why_nested', label: 'HMAC 为什么要两层嵌套而不是 H(K‖m)',
        ask: '给消息盖认证标签，为什么不直接用 H(K‖m)，而要 HMAC 的两层嵌套 H((K⊕opad)‖H((K⊕ipad)‖m))?', kind: 'choice',
        compute: () => ({ answer: '很多哈希(Merkle-Damgård 结构)有长度扩展攻击：知道 H(K‖m) 就能算出 H(K‖m‖…) 而不需要 K；HMAC 用外层再哈希一次把这条路堵死，密钥在内外各揉一次', step: 4, evidence: 'ipad/opad 让密钥参与内外两层，攻击者拿到最终标签也续不出新标签' }),
        distractors: () => ['两层只是为了更慢、增加破解成本', '嵌套能把密钥藏得更深所以更安全', '没区别，只是习惯写法'],
      },
      {
        id: 'tamper', label: 'HMAC 怎么同时防伪造和防篡改',
        ask: 'HMAC 标签是怎么让收方既挡住伪造、又发现消息被改的?', kind: 'choice',
        compute: () => ({ answer: '标签的计算需要密钥 K：没有 K 就算不出正确标签(防伪造)；消息改一个字节，收方用 K 重算的标签就和附带的对不上(防篡改)', step: 5, evidence: "m 从 'Hi' 改成 'Hj'，重算 HMAC=06≠原 05，收方拒收" }),
        distractors: () => ['靠把消息加密隐藏起来', '靠标签里带一个时间戳', '靠消息本身够长'],
      },
    ],
  },
  {
    id: 'totp', title: 'TOTP 动态口令', kernel: totpKernel as Kernel<unknown>, doc: trivialDoc('totp'),
    facts: [
      {
        id: 'offline_same', label: '手机和服务器不通信怎么算出同一个码',
        ask: 'TOTP 里手机和服务器不联网对表，为什么能各自算出同一个 6 位码?', kind: 'choice',
        compute: () => ({ answer: '两边都有同一个共享密钥 K，又都看当前时间：码 = 截断(HMAC(K, ⌊t/30⌋))，同一个时间窗算出同一个码，全程不用传密钥、不用通信', step: 4, evidence: 't=30s 时手机与服务器都算窗口 T=1 → 都得 094198' }),
        distractors: () => ['手机每次把码发给服务器存起来', '服务器提前把所有码发给手机', '靠联网实时同步'],
      },
      {
        id: 'window_change', label: '码为什么每 30 秒变一次',
        ask: 'TOTP 的码为什么在 30 秒内不变、过 30 秒就换一个?', kind: 'choice',
        compute: () => ({ answer: '码只取决于时间窗 T=⌊t/30⌋：同一个 30 秒内 T 不变→码不变(给你时间输入)；跨到下一窗口 T+1→HMAC 全变→新码(旧码作废)', step: 3, evidence: 't=0/15/29s 同在窗口0→790815；t=30s 进窗口1→094198' }),
        distractors: () => ['码是随机生成的，正好 30 秒换', '手机内置了一张 30 秒一换的码表', '服务器每 30 秒推一个新码给手机'],
      },
    ],
  },
  {
    id: 'snowflake', title: '雪花算法分布式ID', kernel: snowflakeKernel as Kernel<unknown>, doc: trivialDoc('snowflake'),
    facts: [
      {
        id: 'no_coord', label: '多台机器不协调怎么保证 ID 不撞',
        ask: '分布式下每台机器都本地发 ID、彼此不通信，Snowflake 怎么保证全局不重复?', kind: 'choice',
        compute: () => ({ answer: '64 位里有一段"机器码"：每台机器的机器码不同，即使同一毫秒同一序号，拼出的 ID 也因机器码段不同而不同，所以不同机器绝不相撞、无需协调', step: 5, evidence: '机器码=dc<<5|worker，本机=34；这段嵌在 ID 中间' }),
        distractors: () => ['每台机器发 ID 前都去问中心发号器', '靠随机数碰运气不重复', '所有机器共用一个全局锁'],
      },
      {
        id: 'monotonic', label: 'Snowflake 的 ID 为什么趋势递增',
        ask: 'Snowflake 生成的 ID 为什么"越晚生成越大"（趋势递增），这有什么用?', kind: 'choice',
        compute: () => ({ answer: '毫秒时间戳放在最高位，所以时间越晚 ID 整体越大；对数据库 B+树索引友好——插入几乎是顺序追加，不会到处分裂页', step: 4, evidence: 't=1000→ID≈41.9亿，t=1001→ID≈41.99亿，时间戳一增 ID 跳一大截' }),
        distractors: () => ['因为序号一直自增不清零', '因为机器码每次都变大', '其实是随机的，不保证递增'],
      },
    ],
  },
  {
    id: 'vectorclock', title: '向量时钟', kernel: vectorclockKernel as Kernel<unknown>, doc: trivialDoc('vectorclock'),
    facts: [
      {
        id: 'causal_vs_concurrent', label: '怎么判两个事件是因果还是并发',
        ask: '向量时钟里，怎么判断事件 a 和 b 是"有先后因果"还是"并发"?', kind: 'choice',
        compute: () => ({ answer: 'V(a) 每一位都 ≤ V(b) 且不全等 → a 因果先于 b；若两个向量互相都不 ≤ 对方 → 二者并发（谁也没影响谁）', step: 7, evidence: 'a[1,0,0] 每位≤e[2,2,1]→a→e因果；f[3,0,0] 与 e[2,2,1] 互不≤→并发' }),
        distractors: () => ['比向量各位之和，大的在后', '比物理时间戳谁早', '比第一位 P0 谁大'],
      },
      {
        id: 'recv_rule', label: '收到消息时向量怎么更新',
        ask: '一个进程收到别人发来的消息（带着对方的向量）时，自己的向量时钟怎么更新?', kind: 'choice',
        compute: () => ({ answer: '逐位取 max(本地向量, 收到的向量)，把对方"见过的进度"并进来，然后再把自己那一位 +1', step: 5, evidence: 'P2 收到 [2,2,0]：max([0,0,0],[2,2,0])=[2,2,0]，再自己+1 → [2,2,1]' }),
        distractors: () => ['直接用收到的向量覆盖自己的', '只把自己那位 +1，忽略收到的', '逐位相加两个向量'],
      },
    ],
  },
  {
    id: 'quorum', title: 'Quorum NWR', kernel: quorumKernel as Kernel<unknown>, doc: trivialDoc('quorum'),
    facts: [
      {
        id: 'wr_gt_n', label: 'W+R>N 为什么能保证读到最新',
        ask: 'N=5 份副本，写 W=3 份、读 R=3 份。为什么这样一定能读到最新写?', kind: 'choice',
        compute: () => ({ answer: 'W+R=6>N=5，由鸽巢原理，读的 3 份和写的 3 份在 5 份里必有至少 1 份重叠；那份带着最新写，读取最新版本就一定读到它', step: 4, evidence: '写集{R0,R1,R2}、读集{R2,R3,R4}重叠 R2，R2 是最新 v2' }),
        distractors: () => ['因为写了多数派副本就够了', '因为读的时候会自动同步所有副本', '因为版本号会广播给所有副本'],
      },
      {
        id: 'tunable', label: 'NWR 三个旋钮怎么权衡',
        ask: 'Quorum 的 N/W/R 三个值是可调的，调它们在权衡什么?', kind: 'choice',
        compute: () => ({ answer: '在一致性和读写延迟之间权衡：W 大写慢读快、R 大读慢写快、W=R=N 最强一致但最慢、W+R≤N 最快但可能读到旧值', step: 5, evidence: 'R 调到 2 时 W+R=5≤5，读集{R3,R4}可能零重叠、读到旧 v1' }),
        distractors: () => ['只调容错能力，和一致性无关', '调副本存在哪个机房', 'W/R 越大一定越好'],
      },
    ],
  },
  {
    id: 'circuitbreaker', title: '熔断器状态机', kernel: circuitbreakerKernel as Kernel<unknown>, doc: trivialDoc('circuitbreaker'),
    facts: [
      {
        id: 'why_break', label: '熔断器 Open 态为什么"快速失败"',
        ask: '下游服务挂了，熔断器进入 Open 态后直接让请求快速失败、不打下游，这是为了什么?', kind: 'choice',
        compute: () => ({ answer: '避免级联雪崩：如果还一直打故障的下游，每个请求都卡到超时会耗光上游线程/连接池；快速失败既保护上游不被拖垮，也给下游喘息恢复的机会', step: 5, evidence: 'Open 态请求 fail-fast，根本不调用下游' }),
        distractors: () => ['为了让请求更快返回成功', '为了给下游发更多重试请求', '为了记录更多失败日志'],
      },
      {
        id: 'halfopen', label: 'Half-Open 态是干什么的',
        ask: '熔断器 Open 一段时间后进入 Half-Open 态，这个中间态的作用是?', kind: 'choice',
        compute: () => ({ answer: '放少量探测请求去试探下游恢复没有：探测成功就回 Closed 恢复正常，探测失败就退回 Open 再等——避免下游还没好就被全量流量再次打垮', step: 7, evidence: '探测请求成功 → 回 Closed 且失败计数清零' }),
        distractors: () => ['直接放全部流量进去试', '永久停在这个状态', '把所有历史失败请求重放一遍'],
      },
    ],
  },
  {
    id: 'joins', title: '三种 JOIN 算法', kernel: joinsKernel as Kernel<unknown>, doc: trivialDoc('joins'),
    facts: [
      {
        id: 'nlj_cost', label: '嵌套循环 JOIN 为什么表大就爆',
        ask: 'Nested Loop Join（嵌套循环连接）在大表上为什么代价高?', kind: 'choice',
        compute: () => ({ answer: '它是外表每行都去内表整个扫一遍，比较次数 = |外表| × |内表|，即 O(N×M)——两张十万行的表就是百亿次比较', step: 1, evidence: '本例 3×4=12 次；没有索引时随表规模平方爆炸' }),
        distractors: () => ['因为要先给两表排序', '因为要建很大的哈希表', '因为它只支持等值连接'],
      },
      {
        id: 'hash_best', label: 'Hash Join 适合什么场景',
        ask: '大表之间的等值连接（=），优化器通常选哪种 JOIN 算法、为什么?', kind: 'choice',
        compute: () => ({ answer: 'Hash Join：对小表建哈希表(build)、大表逐行 O(1) 探测(probe)，总代价 O(N+M)，远小于嵌套循环的 O(N×M)；代价是只支持等值连接、要额外内存放哈希表', step: 3, evidence: '本例 建3+探4=7 次，远少于 NLJ 的 12' }),
        distractors: () => ['Nested Loop，因为不用预处理', 'Sort-Merge，因为一定要排序', 'Hash Join 只适合小表'],
      },
    ],
  },
  {
    id: 'compositeindex', title: '复合索引·最左前缀', kernel: compositeindexKernel as Kernel<unknown>, doc: trivialDoc('compositeindex'),
    facts: [
      {
        id: 'leftmost', label: '复合索引 idx(a,b,c) 什么查询用不上',
        ask: '有复合索引 idx(a,b,c)。WHERE b=? （只按 b 查）为什么用不上这个索引?', kind: 'choice',
        compute: () => ({ answer: '违反最左前缀：索引在 B+树里是先按 a 排、a 相同再按 b 排，只按 b 查无法在树里定位（b 是散的）；必须从最左列 a 起、连续命中的等值条件才能用', step: 4, evidence: 'WHERE b=? 用到前缀[]→全表扫；而 WHERE a=? 用到 (a)、WHERE a=?AND b=? 用到 (a,b)' }),
        distractors: () => ['因为 b 不是主键', '因为 b 的区分度不够', '因为要 SELECT 的列不在索引里'],
      },
      {
        id: 'covering', label: '覆盖索引免回表是什么意思',
        ask: 'SELECT a,b WHERE a=? 用到 idx(a,b,c) 时"不回表"，而 SELECT a,b,d 就要回表，为什么?', kind: 'choice',
        compute: () => ({ answer: '覆盖索引：SELECT 需要的列(a,b)都在索引里，直接从索引叶子拿到数据就够了；而 d 不在索引里，必须拿主键再去主键树捞整行（回表），多一次查找', step: 6, evidence: 'SELECT a,b,c 覆盖不回表；SELECT a,b,d 含索引外列 d → 回表' }),
        distractors: () => ['回表是因为 WHERE 条件不够', '回表是因为索引失效了', '两者其实都要回表'],
      },
    ],
  },
  {
    id: 'rwlock', title: '读写锁 RWLock', kernel: rwlockKernel as Kernel<unknown>, doc: trivialDoc('rwlock'),
    facts: [
      {
        id: 'share_exclusive', label: '读写锁比互斥锁强在哪',
        ask: '读写锁相比普通互斥锁（一次只放一个），并发上强在哪里?', kind: 'choice',
        compute: () => ({ answer: '多个读者可以同时持有读锁（读读共享），因为读不改数据、并发读安全；只有写者需要独占。读多写少时吞吐远高于互斥锁', step: 2, evidence: 'R1、R2 同时持读锁 {R1,R2}，读并发不互相阻塞' }),
        distractors: () => ['写操作也能并发执行', '它永远不会阻塞任何请求', '它不需要任何锁就能保证安全'],
      },
      {
        id: 'writer_wait', label: '有读者时写者为什么要等',
        ask: 'R1、R2 正持有读锁，这时 W1 请求写锁，为什么 W1 必须等待?', kind: 'choice',
        compute: () => ({ answer: '写要独占：写期间如果有人在读，读者会读到写了一半的中间状态。所以 W1 必须等所有读者都释放读锁后，才能独占进入', step: 3, evidence: 'W1 请求写时 readers={R1,R2}，进等待队列；R1、R2 都释放后 W1 才获准' }),
        distractors: () => ['因为 W1 优先级低', '因为写锁比读锁慢', '其实不用等，可以和读者并发'],
      },
    ],
  },
  {
    id: 'aba', title: 'ABA 问题', kernel: abaKernel as Kernel<unknown>, doc: trivialDoc('aba'),
    facts: [
      {
        id: 'why_aba', label: 'CAS 的 ABA 问题是怎么发生的',
        ask: 'CAS 明明检查了"当前值 == 我读到的旧值"，为什么还会被 ABA 骗?', kind: 'choice',
        compute: () => ({ answer: 'CAS 只比较值本身。如果值从 A 被改成 B、又改回 A，CAS 看到当前还是 A、以为期间没人动过，其实中间变过两次——在无锁栈里可能把已释放又重分配的节点当成原来的', step: 4, evidence: 'T1 读到 100，T2 把 100→200→100，T1 的 CAS 期望 100、当前 100 → 误判成功' }),
        distractors: () => ['因为 CAS 本身有并发 bug', '因为读和写没加锁', '因为值溢出了'],
      },
      {
        id: 'stamp_fix', label: '版本号怎么修复 ABA',
        ask: '给 CAS 加一个版本号(stamp)，为什么就能识破 ABA?', kind: 'choice',
        compute: () => ({ answer: '版本号只增不减，每改一次就 +1。CAS 比较 (值, 版本) 一对：即使值绕回 A，版本也从 v1 变成了 v3、回不去，CAS 发现版本不符就正确失败。这就是 AtomicStampedReference', step: 8, evidence: 'T1 期望 (100,v1)、当前 (100,v3)，值同但版本不符 → CAS 失败' }),
        distractors: () => ['版本号让 CAS 变快了', '版本号把值锁住不让改', '版本号让 A 和 A 变得不相等'],
      },
    ],
  },
  {
    id: 'happensbefore', title: 'happens-before 可见性', kernel: happensbeforeKernel as Kernel<unknown>, doc: trivialDoc('happensbefore'),
    facts: [
      {
        id: 'why_stale', label: 'reader 为什么会读到旧值',
        ask: 'writer 先 data=42 再 ready=true，reader 看到 ready==true 却读到 data=0，为什么?', kind: 'choice',
        compute: () => ({ answer: '没有同步时，编译器/CPU 可能把 ready=true 重排到 data=42 之前生效，或 data 的新值还停在缓存没让 reader 看见；两条写的顺序和可见性对 reader 都不保证', step: 3, evidence: 'reader 见 ready=true 就读 data，却读到旧值 0——经典可见性/重排 bug' }),
        distractors: () => ['因为 reader 读得太快', '因为 data 被别的线程改成了 0', '因为 42 存不下'],
      },
      {
        id: 'volatile_hb', label: 'volatile 靠什么保证读到最新',
        ask: '把 ready 声明为 volatile 后，为什么 reader 就一定能读到 data=42?', kind: 'choice',
        compute: () => ({ answer: 'volatile 建立 happens-before：volatile 写(ready=true)是释放屏障、把之前的写(data=42)刷出；volatile 读(读 ready)是获取屏障、拿到最新。于是 data=42 先于 reader 读 data 被保证', step: 6, evidence: 'happens-before 传递：data=42 → ready=true → reader 见 ready → reader 读 data，必看见 42' }),
        distractors: () => ['volatile 给变量加了锁', 'volatile 让 data 也不能被改', 'volatile 只是让读写更快'],
      },
    ],
  },
  {
    id: 'actte', title: 'ACT · 动作分块 + 时序集成', kernel: actteKernel as Kernel<unknown>, doc: trivialDoc('actte'),
    facts: [
      {
        id: 'at_chunk', label: 'ACT 为什么一次预测一块动作',
        ask: 'ACT 为什么一次预测未来一"块"(K 个)动作，而不是每步一个?', kind: 'choice',
        compute: t => { const f = t as unknown as { K: number }[]; const k = f.find(x => x.K != null)?.K ?? 4; return ({ answer: `把有效时域从 T 缩到 T/K——需要自主决策的次数少 K 倍、复合误差(滚雪球)的机会砍到 1/K。这是 ACT 打赢单步 BC 的核心`, step: 1, evidence: `本例 K=${k}(LeRobot 真值 chunk_size=100)` }) },
        distractors: () => ['为了让模型跑得更快', '因为机械臂一次只能动一下', '为了省显存'],
      },
      {
        id: 'at_ensemble', label: '时序集成怎么算执行动作',
        ask: 'ACT 的时序集成(temporal ensembling)怎么算出每一步真正执行的动作?', kind: 'choice',
        compute: () => ({ answer: '每步都重预测一整块 → 同一个动作会被好几块预测到(重叠、互相不一致) → 把这些重叠预测加权平均：a_t = Σ w_i·P_i / Σ w_i，抹掉抖动', step: 3, evidence: '权重 w_i=exp(-m·i)、i=0 是最旧那条' }),
        distractors: () => ['只用最新那一块的预测', '取所有预测的最大值', '随机选一条预测'],
      },
      {
        id: 'at_weight', label: '时序集成的权重公式',
        ask: 'ACT 时序集成的权重 w_i = exp(-m·i)，其中 i=0 对应哪条预测，m 默认多少?', kind: 'choice',
        compute: t => { const f = t as unknown as { m: number }[]; const m = f.find(x => x.m != null && x.m > 0)?.m ?? 0.01; return ({ answer: `i=0 是**最旧**那条预测(LeRobot 代码 exp(-m·arange))；m 默认 ${m} → 权重近似均匀、还略偏旧(别过度信最新那条抖的，代码注释:激进上调新动作会削弱分块好处)`, step: 3, evidence: 'm 大→更信旧;m<0→更信新' }) },
        distractors: () => ['i=0 是最新那条、m 默认 1.0', 'i=0 是最旧、权重全相等(m 恒为 0)', 'i=0 是最重要那条、m 由模型学出'],
      },
      {
        id: 'at_default_off', label: 'LeRobot 默认开时序集成吗',
        ask: 'ACT 论文重点讲时序集成，那 LeRobot 里默认开启它吗?', kind: 'choice',
        compute: () => ({ answer: '默认不开！默认 n_action_steps=100、走队列(receding-horizon 执行完一块再预测)；要开集成得设 n_action_steps=1、每步重预测。经典"读配置别只读论文"陷阱', step: 5, evidence: 'temporal_ensemble_coeff 默认 None(关闭)' }),
        distractors: () => ['默认开启、不用配置', '论文和代码里都默认开', '默认开、但只在仿真里'],
      },
      {
        id: 'at_chunksize', label: 'LeRobot ACT 的动作块长',
        ask: 'LeRobot 里 ACT 的动作块长 chunk_size 默认是多少?', kind: 'number',
        compute: () => ({ answer: '100', step: 1, evidence: '本实验演示用 K=4 便于手算；LeRobot 真值 chunk_size=100、n_action_steps=100' }),
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'foc', title: 'FOC 磁场定向控制', kernel: focKernel as Kernel<unknown>, doc: trivialDoc('foc'),
    facts: [
      {
        id: 'foc_why', label: 'Park 变换关键在哪',
        ask: 'FOC 里 Park 变换(αβ→dq)最关键的作用是什么?为什么它让简单 PI 能用?', kind: 'choice',
        compute: () => ({ answer: 'Park 按转子电角把电流旋进"跟着转子转"的 dq 系，随转子转的正弦相电流在里面变成直流；PI 追不了正弦、却能把直流误差压到零稳态误差，所以两个简单 PI 就能分别控 i_d、i_q', step: 2, evidence: 'Clarke 先 3→2 降维、Park 再转进转子系:交流→直流是 FOC 能用 PI 的根本' }),
        distractors: () => ['把三相变两相、减少一个电流传感器', '把电流放大、提高转矩', '把直流变交流去驱动电机'],
      },
      {
        id: 'foc_id0', label: 'i_d 目标为什么设 0',
        ask: 'FOC 电流环里为什么把 i_d 的目标设成 0?', kind: 'choice',
        compute: () => ({ answer: '最大转矩每安培(MTPA)：表贴永磁/混合步进电机只有 i_q(交轴)产生转矩、i_d(直轴)只白白发热(I²R)不出力。i_d*=0 让每一安培都用在转矩上。唯一例外是高速弱磁时故意让 i_d<0', step: 3, evidence: 'τ=1.5·p·λ_m·i_q 只跟 i_q 走;i_d 只发热' }),
        distractors: () => ['为了让电机转得更快', '因为 i_d 测不准、干脆设 0', '为了让电流环更稳定'],
      },
      {
        id: 'foc_svpwm', label: 'SVPWM 比正弦 PWM 强在哪',
        ask: 'SVPWM(空间矢量 PWM)相比朴素正弦 PWM 好在哪?', kind: 'choice',
        compute: () => ({ answer: '在三相上注入一个共模(零序)偏置(中点钳位 −(max+min)/2)，把线电压顶得更高——比正弦 PWM 多约 15% 的母线电压利用率;相当于同样母线电压能输出更大转矩/转速', step: 4, evidence: '逆 Clarke 得三相电压后做中点钳位、就是 SVPWM' }),
        distractors: () => ['开关损耗更低、发热更少', '不需要测转子角度', '能省掉两个 PI 控制器'],
      },
      {
        id: 'foc_cascade', label: 'FOC 在级联 PID 的哪一环',
        ask: 'FOC 电流环在机器人关节的级联 PID 里处于哪一环?和 Dummy-Robot 的 FK/IK 什么关系?', kind: 'choice',
        compute: () => ({ answer: '最内环、带宽最高(20kHz):位置环→速度环→电流环，上一环的输出是下一环的设定值。FK/IK 把末端位姿解成关节角、下发到关节;这套 FOC 电流环就是把关节角指令变成协调的三相电流去执行的底层', step: 1, evidence: 'Dummy-Robot:STM32F4 解六轴 IK→CAN 下发→各关节 Ctrl-Step 电流环执行' }),
        distractors: () => ['最外环、直接接收位姿指令', '和 FK/IK 无关、是独立系统', '在速度环外面、管全局规划'],
      },
      {
        id: 'foc_idtarget', label: 'i_d 目标值是多少',
        ask: '为了最大转矩每安培(MTPA)，表贴永磁/步进电机 FOC 电流环里 i_d 的目标值 i_d* 设为多少?', kind: 'number',
        compute: t => { const f = t as unknown as { idTarget?: number }[]; const l = f[f.length - 1]; const v = l?.idTarget ?? 0; return ({ answer: String(v), step: 3, evidence: `i_d*=${v}:i_d 不产生转矩、只发热,设 0 让每安培都出力(MTPA);高速弱磁才 <0` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'miniduck', title: 'Open Duck Mini · 学会走路', kernel: miniduckKernel as Kernel<unknown>, doc: trivialDoc('miniduck'),
    facts: [
      {
        id: 'mk_reward_vs_learn', label: '模仿奖励 vs 模仿学习',
        ask: 'Open Duck Mini 的"模仿奖励"(imitation reward)和 ACT/BC 的"模仿学习"(imitation learning)是一回事吗?', kind: 'choice',
        compute: () => ({ answer: '不是，同词反机制。模仿奖励=RL 里一个奖励项，奖励跟踪相位对齐的参考步态(会探索、能从扰动恢复);模仿学习=监督克隆人类示教动作(漂出分布就累积误差 covariate shift、不会自恢复)', step: 1, evidence: '鸭子用 DeepMimic 式逐帧相位跟踪奖励、非 AMP(无判别器);走路是 Brax PPO 强化学习出来的' }),
        distractors: () => ['是，都是从示教数据克隆动作', '不是，模仿奖励更快但本质都是监督学习', '是，只是模仿奖励在仿真里、模仿学习在真机'],
      },
      {
        id: 'mk_paradigm', label: '为什么 locomotion 用 RL 不用 BC',
        ask: 'Open Duck Mini 的走路为什么用强化学习(PPO)训练，而不是像 ACT 那样行为克隆?', kind: 'choice',
        compute: () => ({ answer: '新形态没有现成示教者;接触富、混杂(每次落脚/离地都切换)的动力学;而且需要扰动恢复——BC 没有恢复能力、只会累积误差。RL 能探索并沿奖励梯度找到鲁棒步态', step: 1, evidence: '在 MuJoCo Playground 里 Brax PPO 训练、随机推搡教会"推不倒"' }),
        distractors: () => ['BC 太慢、RL 更快', '因为没有 GPU 只能用 RL', 'RL 不需要奖励函数、更省事'],
      },
      {
        id: 'mk_actorcritic', label: '非对称 actor-critic',
        ask: 'Open Duck Mini 的 actor(部署用)和 critic(只训练用)看到的观测为什么不一样?', kind: 'choice',
        compute: () => ({ answer: 'critic 训练时能看真值特权量(base 线速度、全参考帧、接触力),学得更稳更快;actor 只用真机测得到的量(IMU 陀螺/加速度、指令、关节位/速、动作历史、相位)——所以部署时不依赖任何特权量。base 线速度真机测不到、故意不给 actor', step: 1, evidence: '非对称 actor-critic:critic 用 privileged_state、actor 用可部署观测' }),
        distractors: () => ['actor 更聪明所以给它更多信息', '两者一样、只是网络大小不同', 'critic 看得少、防止过拟合'],
      },
      {
        id: 'mk_imit_term', label: '模仿奖励的主导项',
        ask: '模仿奖励里权重最大(主导)的是哪一项?它买来了什么?', kind: 'choice',
        compute: () => ({ answer: '关节位置跟踪项 −15·‖q_leg − q̂_leg‖²(权重 15、最狠)。它把训练拉向那条物理可行的参考步态 → 得到自然、对称、像 BD-X 的步态;去掉它,只奖励速度,策略会退化成能量最省的"丑走"', step: 4, evidence: '本例只velocity 模式 ‖q−q̂‖²=0.365 却不扣分→步态退化，证明模仿项买自然步态' }),
        distractors: () => ['存活奖励 alive、防止摔倒', '力矩惩罚、为了省电', '速度跟踪、为了走得快'],
      },
      {
        id: 'mk_alive', label: '直立这一步的存活奖励',
        ask: '带模仿奖励、机器人直立不倒时，这一步的存活(alive)奖励是多少?', kind: 'number',
        compute: t => { const f = t as unknown as { alive?: number }[]; const l = f[f.length - 1]; const a = l?.alive ?? 20; return ({ answer: String(a), step: 3, evidence: `alive=+${a}(站着不倒);摔了则 0——站着本身就值 ${a} 分,是"别摔"的最强激励` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'teleop', title: 'LeRobot · 主从遥操作', kernel: teleopKernel as Kernel<unknown>, doc: trivialDoc('teleop'),
    facts: [
      {
        id: 'tp_noik', label: 'follower 跟随为什么不用 IK',
        ask: 'SO-101 主从遥操作里 follower 跟随 leader，为什么通常不用逆运动学(IK)?', kind: 'choice',
        compute: () => ({ answer: '两臂同构(连杆尺寸完全相同)——直接把 leader 的关节角当 follower 目标，就复现同一末端位姿，无需 IK。只有两臂结构不同(如遥操作人形手)才要逆解/重定向(retargeting)', step: 1, evidence: '同构→关节空间直接复制；异构才需要 IK/retarget' }),
        distractors: () => ['IK 太慢，改用查表近似', 'follower 有专门的 IK 芯片代劳', 'follower 只是回放录像、不算 IK'],
      },
      {
        id: 'tp_calib', label: '原始舵机码怎么变成角度',
        ask: '舵机回报 0~4095 的原始码，怎么标定成关节角度?为什么需要 homing_offset?', kind: 'choice',
        compute: () => ({ answer: '角 = (码 − homing_offset) × (360/4096)。每个舵机装配时零位随机(舵盘花键任意插)，homing_offset 记录"这个电机 0°对应哪个码"；360/4096 是 12 位分辨率。标定还含 range/符号，把不同装配统一到同一角度约定', step: 2, evidence: '0~4095=12 位；homing_offset 消除装配零位差异' }),
        distractors: () => ['码直接就是角度(码/4096×360)、不用 homing', '按码的奇偶判正负', '每次上电现测、不存标定'],
      },
      {
        id: 'tp_maxrel', label: 'max_relative_target 防什么',
        ask: 'max_relative_target 每步把 follower 的移动限幅在 ±阈值内，防的是什么?', kind: 'choice',
        compute: () => ({ answer: '防通信抖动/丢包/leader 被碰导致目标角瞬间大跳变时，follower 一次危险急跳(甩臂撞坏)。goal=present+clamp(Δ,±阈值)，每步只挪一小段', step: 3, evidence: '本例腕转抖动 Δ≈90°；开钳→挪 15°平稳，关→急跳 90°危险' }),
        distractors: () => ['防舵机过热', '防关节角超出 0~360 范围', '让 follower 动得更快'],
      },
      {
        id: 'tp_data', label: '遥操作和示教数据的关系',
        ask: '主从遥操作和 ACT/Diffusion/BC 训练用的示教数据，是什么关系?', kind: 'choice',
        compute: () => ({ answer: '遥操作时同步录下 follower 的 (observation.state, observation.images, action)——这一串就是模仿学习(ACT/Diffusion/BC)训练用的示教数据集。遥操作是采集示教数据的核心入口', step: 4, evidence: '配合 delta_timestamps 取时序窗口、归一化统计量，喂进策略' }),
        distractors: () => ['没关系，示教数据是仿真里生成的', '遥操作只是调试、不产生训练数据', '示教数据靠强化学习自己探索出来'],
      },
      {
        id: 'tp_move', label: '被钳关节这一步挪多少度',
        ask: 'max_relative_target 阈值 15°，腕转一步要跳 Δ≈90° 被钳；follower 当前 -2°，这一步实际挪了多少度?', kind: 'number',
        compute: t => { const f = t as unknown as { joints?: { present: number; goal: number; clamped: boolean }[] }[]; const j = f.find(x => x.joints)?.joints?.find(x => x.clamped); const mv = j ? Math.round(Math.abs(j.goal - j.present)) : 15; return ({ answer: String(mv), step: 3, evidence: `Δ=89.89°>15° → 钳到 +15°；当前 -2°→目标 13°，实际只挪 |13−(−2)|=${mv}°(=阈值)` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'normstats', title: 'LeRobot · 数据集归一化', kernel: normstatsKernel as Kernel<unknown>, doc: trivialDoc('normstats'),
    facts: [
      {
        id: 'ns_when', label: '归一化统计量什么时候算',
        ask: 'LeRobot 的归一化统计量(μ/σ/min/max)是什么时候、算几遍的?和 BatchNorm 有何不同?', kind: 'choice',
        compute: () => ({ answer: '在整套数据集上离线算一遍、存进 meta/stats.json；归一化因此是固定、可逆的仿射变换，训练/部署完全一致。BatchNorm 是每个 batch 现算、训练和推理行为不同', step: 1, evidence: 'σ=√(E[x²]−μ²) 一遍聚合；换数据集要重算' }),
        distractors: () => ['每个 batch 现算(和 BatchNorm 一样)', '每个 epoch 重算一次', '推理时按当前样本实时算'],
      },
      {
        id: 'ns_meanstd', label: 'MEAN_STD 公式与适用',
        ask: 'MEAN_STD 归一化的公式是什么?通常给哪个策略、有什么好处?', kind: 'choice',
        compute: () => ({ answer: "x'=(x−μ)/(σ+eps)，拉成 ~0 均值、单位尺度；ACT 默认。对无界的关节角/力矩自然，对离群相对稳(离群只把 σ 拉大一点、不挤扁其它值)", step: 2, evidence: 'eps 防止除零；均值为 0 的特征归一化后保持符号' }),
        distractors: () => ["x'=x/max，缩到 [0,1]", "x'=(x−min)/(max−min)，缩到 [0,1]", "x'=log(x)，取对数"],
      },
      {
        id: 'ns_minmax', label: 'MIN_MAX 为什么给 Diffusion',
        ask: 'MIN_MAX 归一化映射到哪个区间?为什么 Diffusion Policy 用它、代价是什么?', kind: 'choice',
        compute: () => ({ answer: "x'=2(x−min)/(max−min)−1 映射到 [-1,1]；Diffusion 的加噪 schedule 假设数据在 [-1,1]。代价是离群敏感——一个离群值会把其它正常样本挤到紧贴边界、彼此难分", step: 3, evidence: '本例力矩离群 3.0→+1，正常样本 0.1~0.3 全挤到 -1 附近' }),
        distractors: () => ['映射到 [0,1]，因为图像像素是 [0,1]', '映射到 [-π,π]，因为是关节角', '映射到 [0,∞)，因为力矩非负'],
      },
      {
        id: 'ns_unnorm', label: '策略输出能不能直接发',
        ask: '策略网络预测出一串动作，能直接发给机器人吗?', kind: 'choice',
        compute: () => ({ answer: '不能。策略输出的是归一化空间的动作，必须用同一套存好的统计量反归一化(x=x′·σ+μ 或 x=(x′+1)/2·(max−min)+min)再发。漏了输出反归一化=动作幅度全错、像"没力气"，是部署最常见的静默 bug', step: 4, evidence: '两端各一次:输入归一化观测、输出反归一化动作，同一套统计量' }),
        distractors: () => ['能，网络输出就是真实动作值', '能，机器人固件会自己换算', '能，只要输入端归一化过就行'],
      },
      {
        id: 'ns_negcount', label: 'θ 归一化后几个负数',
        ask: '关节角 θ=[-2.8,-1.2,0,0.4,1.6,2.0] 均值恰为 0，经 MEAN_STD(=除以 σ)归一化后，有几个样本是负数?', kind: 'number',
        compute: t => { const f = t as unknown as { cols?: { name: string; ms: number[] }[] }[]; const c = f.find(x => x.cols)?.cols?.[0]; const n = c ? c.ms.filter(v => v < 0).length : 2; return ({ answer: String(n), step: 2, evidence: `μ=0 → 归一化保持符号；原始 -2.8、-1.2 为负 → 归一化后仍为负，共 ${n} 个(0 归一化后仍是 0)` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'deltats', title: 'LeRobotDataset · 时序窗口', kernel: deltatsKernel as Kernel<unknown>, doc: trivialDoc('deltats'),
    facts: [
      {
        id: 'dt_window', label: 'delta_timestamps 怎么把秒翻成帧',
        ask: '策略要一段时序窗口(如未来 0~0.08 秒的动作)，delta_timestamps 怎么把"秒"翻成"取哪些帧"?', kind: 'choice',
        compute: t => { const f = t as unknown as { fps: number }[]; const fps = f.find(x => x.fps != null)?.fps ?? 50; return ({ answer: `delta_idx = round(偏移 × fps)——fps=${fps} 时 -0.06s→-3 帧；再定位到"当前帧+偏移"。用 fps 换算让不同采集频率的数据集通用`, step: 1, evidence: '合法性 |偏移·fps−round|/fps ≤ 容差，保证偏移正好落在某帧' }) },
        distractors: () => ['直接按秒数当帧号用', '固定取前后各 3 帧、不管 fps', '按文件字节偏移取'],
      },
      {
        id: 'dt_boundary', label: '取的帧超出本轨迹末尾怎么办',
        ask: '取"未来动作块"时，有些帧超出了当前这条 episode 的末尾，怎么办?', kind: 'choice',
        compute: () => ({ answer: 'clamp 到本 episode 的边界帧(不跨到别条 episode、否则把两段无关轨迹拼一起)，并把这些越界帧标 is_pad=True', step: 2, evidence: '越界钳边界 + pad 掩码，两手都要' }),
        distractors: () => ['去借下一条 episode 开头的帧凑数', '报错、这个样本作废', '直接用零填充、不做标记'],
      },
      {
        id: 'dt_pad', label: 'pad 掩码干什么用',
        ask: 'delta_timestamps 给出的 is_pad 布尔掩码，训练时有什么用?', kind: 'choice',
        compute: () => ({ answer: '喂给 loss：把 padding(边界处钳出来的重复)帧排除，不让它们污染训练梯度。ACT/Diffusion 都用它', step: 3, evidence: '被钳的帧是"借来的"、不是真数据，必须从 loss 里剔掉' }),
        distractors: () => ['没什么用、只是记录', '用来给数据打分', '决定学习率'],
      },
      {
        id: 'dt_storage', label: 'LeRobotDataset 为什么图像走 mp4',
        ask: 'LeRobotDataset 为什么低维信号(state/action)存 parquet、而相机图像存 mp4?', kind: 'choice',
        compute: () => ({ answer: '图像占绝大多数体积，用视频编码(mp4)压得狠、解码也快；低维高频信号用列存 parquet(一个文件放很多 episode)高效读取', step: 4, evidence: '按数据特性分开存:图像走视频、低维走列存表' }),
        distractors: () => ['mp4 是唯一能存机器人数据的格式', '图像不重要所以随便存', 'parquet 存不了数字'],
      },
      {
        id: 'dt_padcount', label: '靠结尾采样动作块几个越界',
        ask: '本例当前帧 158、episode 到 160、动作块偏移未来 5 帧(0~4)，有几个帧越界被标 pad?', kind: 'number',
        compute: t => { const f = t as unknown as { act?: { pad: boolean }[] }[]; const d = f.find(x => x.act && x.act.some(c => 'pad' in c)); const n = d?.act?.filter(c => c.pad).length ?? 3; return ({ answer: String(n), step: 3, evidence: `158+2=160、+3=161、+4=162 都 ≥160(episode 末) → 钳到 159、标 pad，共 ${n} 个` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'lockstrategy', title: '乐观锁 vs 悲观锁', kernel: lockstrategyKernel as Kernel<unknown>, doc: trivialDoc('lockstrategy'),
    facts: [
      {
        id: 'optimistic_how', label: '乐观锁怎么发现冲突',
        ask: '乐观锁不加锁，两个事务同时改一行时，它靠什么发现"我读之后有人改过"?', kind: 'choice',
        compute: () => ({ answer: '靠版本号：读时记下 version，更新时 UPDATE … WHERE version=旧值。如果期间被别人改过、版本变了，这条 UPDATE 就匹配不到、影响 0 行 → 更新失败，于是重读重试', step: 5, evidence: 'T2 的 UPDATE WHERE version=1 匹配不到(版本已是2)→失败→重试' }),
        distractors: () => ['靠给行加锁', '靠数据库自动检测', '靠比较两个事务的时间戳'],
      },
      {
        id: 'when_which', label: '乐观锁和悲观锁各适合什么场景',
        ask: '乐观锁和悲观锁分别适合什么场景?', kind: 'choice',
        compute: () => ({ answer: '乐观锁适合读多写少、冲突罕见（不加锁并发高，偶尔重试代价小，如点赞数、MVCC）；悲观锁适合写多、冲突频繁、必须一次成功（先加锁串行，稳但并发低，如扣钱、抢票核心）', step: 11, evidence: '冲突少→乐观(重试便宜)；冲突多→悲观(重试太多、不如直接锁)' }),
        distractors: () => ['乐观锁任何场景都更好', '悲观锁任何场景都更好', '两者适用场景完全一样'],
      },
    ],
  },
  {
    id: 'bufferpool', title: '缓冲池 midpoint-LRU', kernel: bufferpoolKernel as Kernel<unknown>, doc: trivialDoc('bufferpool'),
    facts: [
      {
        id: 'scan_pollution', label: '普通 LRU 遇到全表扫描的问题',
        ask: '如果缓冲池用普通 LRU，一次全表扫描会造成什么问题?', kind: 'choice',
        compute: () => ({ answer: '全表扫描把海量只用一次的冷页塞到 LRU 头，把真正被反复访问的热点页挤到尾部淘汰——扫描完缓存全是没用的冷页、热点全没了（缓存污染）', step: 0, evidence: '普通 LRU 新页都进链表头，扫描页会顶掉热点' }),
        distractors: () => ['扫描会让缓存变大', '扫描其实对普通 LRU 没影响', '扫描会触发死锁'],
      },
      {
        id: 'midpoint_how', label: 'midpoint-LRU 怎么保护热点',
        ask: 'MySQL InnoDB 的 midpoint-LRU 靠什么让全表扫描冲不掉热点页?', kind: 'choice',
        compute: () => ({ answer: 'LRU 链分 young(热)+old(冷) 两段，新页插到中点(old 头)而非链表头，只有在 old 段再次被访问才升 young。扫描页只用一次、进不了 young，很快从 old 尾淘汰，young 里的热点不受影响', step: 5, evidence: '扫描 S1/S2/S3 全在 old 段进出，young[A,B,C] 毫发无损' }),
        distractors: () => ['把缓冲池扩大一倍', '扫描时暂时关掉 LRU', '给热点页加锁不让淘汰'],
      },
    ],
  },
  {
    id: 'feed', title: '设计 Feed 流', kernel: feedKernel as Kernel<unknown>, doc: trivialDoc('feed'),
    facts: [
      {
        id: 'push_pull', label: 'Feed 的推模型和拉模型差别',
        ask: 'Feed 时间线的"推（写扩散）"和"拉（读扩散）"，各快在哪、慢在哪?', kind: 'choice',
        compute: () => ({ answer: '推：发帖时写进每个粉丝收件箱，读时直接读自己收件箱→读 O(1)，但写 O(粉丝数)；拉：发帖只存自己 outbox，读时现拉所有关注人的帖归并→写 O(1)，但读要归并 O(关注数)', step: 6, evidence: '本例普通用户走推累计写 9 次(读O(1))，大V走拉省 2,000,000 次写(读时拉+归并)' }),
        distractors: () => ['推和拉都读快', '推写快、拉读快', '两者没区别'],
      },
      {
        id: 'big_v', label: '推拉结合怎么解决大 V 问题',
        ask: '大 V 有百万粉丝，推拉结合怎么避免他发帖时的写放大?', kind: 'choice',
        compute: () => ({ answer: '普通用户走推（读快）；大 V 走拉——发帖不推给百万粉丝、只存自己 outbox，粉丝刷时才现拉大 V 的帖、和收件箱归并。既避免写放大、普通场景又读快', step: 5, evidence: '本例大 V 100 万粉，2 帖走拉省下 2,000,000 次写' }),
        distractors: () => ['给大 V 更多服务器推', '禁止大 V 发帖太频繁', '大 V 也全量推、只是异步'],
      },
    ],
  },
  {
    id: 'contactlcp', title: '接触动力学 · 摩擦锥', kernel: contactlcpKernel as Kernel<unknown>, doc: trivialDoc('contactlcp'),
    facts: [
      {
        id: 'lcp_normal', label: '法向接触为什么是互补',
        ask: '物理引擎里法向接触为什么写成互补条件 0≤f_n⊥φ≥0、而不是一个普通函数?', kind: 'choice',
        compute: () => ({ answer: '因为接触非光滑/集值:要么分离(间隙 φ>0→支持力 f_n=0)、要么接触(φ=0→f_n≥0),二者必居其一且乘积为0;而且法向力只能推不能拉(面不会吸住物体)。没法写成一个光滑的 f_n(φ),只能用互补/LCP', step: 2, evidence: '互补=非光滑的来源;f_n≥0 只推不拉' }),
        distractors: () => ['因为接触力是常数、直接查表', '因为要节省计算、近似成互补', '因为法向力可以拉也可以推'],
      },
      {
        id: 'lcp_cone', label: '库仑摩擦锥是什么',
        ask: '库仑摩擦锥 |f_t|≤μf_n 里，粘(stick)和滑(slip)分别对应锥的什么位置?', kind: 'choice',
        compute: () => ({ answer: '粘(v_t=0):f_t 在锥内部(可取任意平衡外力的反作用力);滑:f_t 落在锥边界(=μf_n)、方向反着滑动阻滑。所以粘/滑就是摩擦锥的 KKT 开关:锥内→粘、锥边界→滑', step: 3, evidence: '最大静摩擦=μf_n;滑时摩擦饱和在边界' }),
        distractors: () => ['粘在边界、滑在内部', '粘和滑都在锥心', '摩擦力和法向力无关'],
      },
      {
        id: 'lcp_stickslip', label: '粘/滑怎么判定',
        ask: '滑块受水平推力 F、最大静摩擦 μf_n，怎么判定粘还是滑?加速度多少?', kind: 'choice',
        compute: () => ({ answer: '比 F 和 μf_n:F≤μf_n→粘(摩擦力 f_t=F 在锥内、净力 0、a=0);F>μf_n→滑(摩擦力饱和在 μf_n、a=(F−μf_n)/m)。本例重推 F=6>4.905→滑、a=(6−4.905)/1=1.095', step: 4, evidence: '粘 a=0、滑 a=(F−μf_n)/m' }),
        distractors: () => ['一直滑动、a=F/m', 'F 越大摩擦越大、永远粘住', '摩擦力总等于 F、a 恒为 0'],
      },
      {
        id: 'lcp_engine', label: '引擎每步怎么解接触',
        ask: '物理引擎(MuJoCo/Bullet)每步是怎么处理所有接触的?圆锥怎么进 LCP?', kind: 'choice',
        compute: () => ({ answer: '每步把所有接触组成一个线性互补问题(LCP)或凸 QP,变量是接触冲量(f_n、切向 β、滑动松弛 λ),用 PGS/Lemke/内点法解;圆锥常线性化成金字塔(几个切向方向 β≥0、Σβ≤μf_n)变成线性 LCP,面越多越准越慢', step: 5, evidence: '金字塔=圆锥的线性化;冲量级处理碰撞(Painlevé)' }),
        distractors: () => ['逐个接触独立用 ODE 积分', '忽略摩擦、只算法向', '用一次逆运动学求解'],
      },
      {
        id: 'lcp_accel', label: '重推时滑块加速度',
        ask: '重推 F=6N、滑动摩擦饱和在 μf_n≈4.9N、m=1kg，滑块加速度 a=(F−μf_n)/m 约多少?(m/s²，一位小数)', kind: 'number',
        compute: t => { const f = t as unknown as { accel?: number }[]; const l = f.find(x => x.accel != null && x.accel > 0); const v = l?.accel != null ? Math.round(l.accel * 10) / 10 : 1.1; return ({ answer: String(v), step: 4, evidence: `a=(6−4.905)/1=1.095≈${v} m/s²;粘住时则 a=0` }) },
        distractors: () => ['0', '0.5', '2.2', '6.0'],
      },
    ],
  },
  {
    id: 'computedtorque', title: '计算力矩控制', kernel: computedtorqueKernel as Kernel<unknown>, doc: trivialDoc('computedtorque'),
    facts: [
      {
        id: 'ct_errordyn', label: '代回后误差动力学变成什么',
        ask: '计算力矩控制 τ=M(q̈_d+Kd ė+Kp e)+Cq̇+G 代回被控对象后，误差动力学变成什么?', kind: 'choice',
        compute: () => ({ answer: 'ë + Kd·ė + Kp·e = 0：Cq̇+G 两边抵消、M 约掉,非线性耦合系统被线性化成每个关节独立、解耦的二阶线性系统。可任意配极点(Kp=ωₙ²、Kd=2ζωₙ)、一套增益全局适用(无需增益调度)', step: 5, evidence: '这就是"反馈线性化":用模型把非线性拉直' }),
        distractors: () => ['仍是原来的非线性耦合系统', '变成一阶线性系统 ė+Kp e=0', '变成随构型变的时变系统'],
      },
      {
        id: 'ct_vs_pid', label: '为什么比纯 PID 好',
        ask: '计算力矩控制相比纯 PID 好在哪?为什么纯 PID 高速时跟踪差?', kind: 'choice',
        compute: () => ({ answer: '纯 PID 用固定增益硬扛非线性(重力/惯性耦合/科氏∝q̇²),只能保守整定、高速大幅时误差长,重力还让它稳态下垂;计算力矩用模型 M/C/G 主动抵消这些非线性,误差动力学变线性解耦、增益可精确配、全局一致', step: 1, evidence: '模型based vs 纯调参;Cq̇+G 前馈抵消非线性' }),
        distractors: () => ['计算力矩不需要传感器', '计算力矩增益可以设得无穷大', '纯 PID 无法控制机械臂'],
      },
      {
        id: 'ct_gravcomp', label: '只重力补偿是什么档',
        ask: '只重力补偿(τ=Kp e+Kd ė+G)和全计算力矩相比，是什么定位?', kind: 'choice',
        compute: () => ({ answer: '"够用又省"的折中:只前馈掉重力 G(所以静止能定住、无稳态下垂),但没消掉惯性耦合和科氏 → 误差动力学仍非线性耦合。设定点调节(定位)够用、轨迹跟踪(高速)差', step: 4, evidence: '消重力=省下 M·v 和 Cq̇;设定点调节的最省档' }),
        distractors: () => ['和全计算力矩完全等价', '比全计算力矩更精确', '完全没用、不如纯 PID'],
      },
      {
        id: 'ct_rnea', label: '计算力矩里的前馈=什么',
        ask: '计算力矩控制里的 Cq̇+G 前馈项，工程上怎么高效算?', kind: 'choice',
        compute: () => ({ answer: '就是一次 RNEA(递归牛顿-欧拉)调用:令 q̈=q̈_d+Kd ė+Kp e(伺服律 v)、q̇=真实速度,RNEA 直接返回 τ=M·v+Cq̇+G。所以计算力矩控制复用了逆动力学 RNEA', step: 3, evidence: '整条 τ=M·v+Cq̇+G 就是 RNEA(q,q̇,v)' }),
        distractors: () => ['要显式组 M、C、G 三个矩阵再相乘', '用一次正向动力学', '查预先标定的力矩表'],
      },
      {
        id: 'ct_innerv', label: '伺服律算出的加速度指令',
        ask: '计算力矩伺服律 v=q̈_d+Kd ė+Kp e，关节1(q̈_d=0,Kd=20,ė₁=−0.2,Kp=100,e₁=0.1)算出 v₁=?', kind: 'number',
        compute: t => { const f = t as unknown as { innerV?: number[] }[]; const l = f.find(x => x.innerV); const v = l?.innerV ? Math.round(l.innerV[0]!) : 6; return ({ answer: String(v), step: 2, evidence: `v₁=0+20·(−0.2)+100·0.1=−4+10=${v}(PD 作用在加速度上、当"想要的 q̈")` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'fwddyn', title: '正向动力学 · 仿真', kernel: fwddynKernel as Kernel<unknown>, doc: trivialDoc('fwddyn'),
    facts: [
      {
        id: 'fwd_vs_inv', label: '正向 vs 逆动力学',
        ask: '正向动力学和逆动力学(RNEA)有什么区别?各用在哪?', kind: 'choice',
        compute: () => ({ answer: '逆动力学:给运动(q,q̇,q̈)求力矩 τ——用于控制(前馈力矩);正向动力学:给力矩 τ 求加速度 q̈=M⁻¹(τ−Cq̇−G)——用于仿真。二者互逆(把 RNEA 算出的 τ 喂回正向动力学会精确还原 q̈)', step: 1, evidence: '逆=控制、正=仿真;round-trip 精确还原' }),
        distractors: () => ['一样，只是叫法不同', '正向算位置、逆向算速度', '正向用于真机、逆向用于仿真'],
      },
      {
        id: 'fwd_invert', label: 'M 为什么可逆却不显式求逆',
        ask: '正向动力学 q̈=M⁻¹(τ−Cq̇−G) 里，为什么 M 一定可逆、工程上却不显式求逆?', kind: 'choice',
        compute: () => ({ answer: 'M 对称正定(是动能度规 T=½q̇ᵀMq̇)→ det M≠0 必可逆、正向动力学良定义。但实际不显式求逆——对 SPD 矩阵用 Cholesky 分解解 M q̈=(τ−b) 更快更稳;大自由度用 ABA(O(n))连 M 都不组', step: 2, evidence: 'SPD→Cholesky;显式求逆慢又不稳' }),
        distractors: () => ['M 不一定可逆、要加正则项', 'M 是对角阵、直接取倒数', 'M 可逆但求逆是唯一办法'],
      },
      {
        id: 'fwd_bias', label: '偏置 b 怎么算',
        ask: '正向动力学里的偏置 b(与加速度无关的部分)是什么?怎么高效算?', kind: 'choice',
        compute: () => ({ answer: 'b = C(q,q̇)q̇ + G(q)(科氏/离心 + 重力)。工程上用一次 RNEA 调用(令 q̈=0)算:RNEA 返回 τ=M·0+Cq̇+G=b。所以正向动力学复用了逆动力学(RNEA)', step: 1, evidence: 'b=Cq̇+G;一次 q̈=0 的 RNEA 直接给出' }),
        distractors: () => ['b 就是重力 G、不含科氏', 'b 是常数、不随状态变', 'b 需要单独组 C 和 G 矩阵才能算'],
      },
      {
        id: 'fwd_simloop', label: '正向动力学连到什么',
        ask: '正向动力学 + 积分一步，等于什么?它是哪些系统的核心?', kind: 'choice',
        compute: () => ({ answer: '等于物理仿真器循环里的一次迭代:读力矩→正向动力学求 q̈→半隐式欧拉积分(q̇←q̇+q̈dt、q←q+q̇dt)→下一帧。MuJoCo/Bullet/Drake 核心就是它;MPC 靠它预测未来;RL 训练在仿真里跑的也是它', step: 4, evidence: '仿真=反复跑正向动力学+积分;MPC/RL 都建在其上' }),
        distractors: () => ['等于一次逆运动学求解', '只用于离线分析、不用于实时', '是 SLAM 的核心循环'],
      },
      {
        id: 'fwd_det', label: '质量矩阵行列式',
        ask: '本例两连杆臂 q=[30°,45°]，质量矩阵 M 的行列式 det M(两位小数)约为多少?(它≠0 保证 M 可逆)', kind: 'number',
        compute: t => { const f = t as unknown as { detM?: number }[]; const l = f.find(x => x.detM != null); const v = l?.detM != null ? Math.round(l.detM * 100) / 100 : 0.32; return ({ answer: String(v), step: 2, evidence: `det M=M₁₁M₂₂−M₁₂²=2.37·0.33−0.69²≈${v}≠0,M 对称正定必可逆` }) },
        distractors: () => ['0.12', '0.68', '1.00', '0.05'],
      },
    ],
  },
  {
    id: 'rnea', title: '递归牛顿-欧拉 RNEA', kernel: rneaKernel as Kernel<unknown>, doc: trivialDoc('rnea'),
    facts: [
      {
        id: 'rnea_what', label: 'RNEA 的两次扫描做什么',
        ask: 'RNEA(递归牛顿-欧拉)的两次扫描分别在做什么?', kind: 'choice',
        compute: () => ({ answer: '外向(基→梢)传运动:ω_i=ω_{i−1}+q̇_i、质心线加速度 a=a_prev+α×r−ω²r 逐连杆往外传;内向(梢→基)传力:牛顿 F=m·a_c、欧拉 N=I·α,力/力矩往里传、投影关节轴得 τ。O(n)、不显式组 M/C/G', step: 1, evidence: '外向传运动学、内向传静力学,把牛顿-欧拉沿链递归组织' }),
        distractors: () => ['第一遍算 M、第二遍算 C 和 G', '第一遍前向、第二遍反向传播梯度', '两遍都从基座到梢、取平均'],
      },
      {
        id: 'rnea_gravity', label: 'RNEA 怎么把重力算进去',
        ask: 'RNEA 里重力是怎么算进去的?', kind: 'choice',
        compute: () => ({ answer: '重力技巧:给基座一个假加速度 a₀=−g(向上 g)。于是外向扫描时每根连杆都自动感到一个等于自重的惯性力,整条链免去单列的重力项——一行代码搞定重力', step: 2, evidence: '切无重力(a₀=0)时 τ 正好少掉一个 G,验证这个技巧' }),
        distractors: () => ['每根连杆单独加一项 m·g', '在最后的 τ 上统一加一个常数', '用一个单独的重力扫描'],
      },
      {
        id: 'rnea_complexity', label: 'RNEA 为什么比显式组 M 快',
        ask: 'RNEA 相比"显式组质量矩阵 M/C/G 再相乘"为什么更适合实时?', kind: 'choice',
        compute: () => ({ answer: 'RNEA 两次扫描 O(n) 时间、O(n) 内存、不组任何矩阵;显式组 M 是 O(n²)、还要存矩阵再相乘。自由度越多 RNEA 优势越大,是实时前馈力矩的主力。两者结果完全一致', step: 4, evidence: 'RNEA 结果 = M q̈+C q̇+G,只是算法更高效' }),
        distractors: () => ['RNEA 是近似算法、牺牲精度换速度', 'RNEA 用了 GPU 并行', 'RNEA 忽略了科氏项所以快'],
      },
      {
        id: 'rnea_building', label: 'RNEA 是哪些算法的构件',
        ask: 'RNEA 除了直接算逆动力学,还是哪些算法的构件?', kind: 'choice',
        compute: () => ({ answer: '①计算力矩控制的 Cq̇+G 前馈=一次 RNEA(令 q̈=q̈_d+Kd ė+Kp e);②CRBA 组质量矩阵 M:对每关节 j 调 RNEA(q̈=eⱼ、q̇=0、g=0)读出 M 的第 j 列;③ABA 正向动力学也是同套空间递归的延伸', step: 4, evidence: 'RNEA 是逆动力学基元,被控制和正向动力学复用' }),
        distractors: () => ['只能算逆动力学、别的用不上', '是 SLAM 的构件', '是路径规划的构件'],
      },
      {
        id: 'rnea_tau1', label: '含重力关节1的力矩',
        ask: '本例两连杆臂 q=[30°,45°]、q̇=[1,1]、q̈=[0.5,−0.5]、含重力，RNEA 算出关节1 力矩 τ₁(取整,N·m)?', kind: 'number',
        compute: t => { const f = t as unknown as { tau?: number[] }[]; const l = f.find(x => x.tau && x.tau[0] !== 0); const v = l?.tau ? Math.round(l.tau[0]!) : 14; return ({ answer: String(v), step: 3, evidence: `RNEA τ₁=13.8≈${v} N·m,与 M q̈+C q̇+G 完全一致;无重力则 τ₁=−0.22(少一个 G₁=14.01)` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'dyneom', title: '机械臂运动方程', kernel: dyneomKernel as Kernel<unknown>, doc: trivialDoc('dyneom'),
    facts: [
      {
        id: 'dyn_notindep', label: '能不能每关节独立 PID',
        ask: '机械臂能不能"一个电机管一个关节、各自独立 PID"就行?', kind: 'choice',
        compute: () => ({ answer: '不能。各关节被惯性(质量矩阵非对角=耦合)、科氏/离心、重力强耦合,全写进一条运动方程 M(q)q̈+C(q,q̇)q̇+G(q)=τ。独立 PID 会被这些非线性耦合项拖累(尤其高速+重力)', step: 1, evidence: '动关节1 会通过 M₂₁ 在关节2 上生力矩;举在半空要 G;转得快有科氏' }),
        distractors: () => ['能，关节之间互不影响', '能，只要 PID 增益调大', '能，加个前馈就等价了'],
      },
      {
        id: 'dyn_mass', label: '质量矩阵非对角项是什么',
        ask: '机械臂质量矩阵 M(q) 的非对角项代表什么?M 有什么性质?', kind: 'choice',
        compute: t => { const f = t as unknown as { M?: number[][] }[]; const M = f.find(x => x.M)?.M; const off = M ? M[0]![1] : 0.69; return ({ answer: `非对角项(本例 M₁₂=${off})是**关节间的惯性耦合**——给一个关节加速度会在另一个关节上产生力矩;非对角≠0 就是耦合。M 还随构型变(cos q2)、且恒对称正定(是动能度规、故一定可逆)`, step: 2, evidence: 'M 对称正定→正向动力学良定义;非对角=耦合' }) },
        distractors: () => ['非对角是测量噪声、应忽略', '非对角是重力项', 'M 是常数矩阵、与姿势无关'],
      },
      {
        id: 'dyn_coriolis', label: '科氏离心项什么时候出现',
        ask: '运动方程里的 C(q,q̇)q̇(科氏+离心)项什么时候出现?为什么静态标定测不到?', kind: 'choice',
        compute: () => ({ answer: '只在运动时出现、与速度平方成正比(离心 q̇² + 科氏 q̇ᵢq̇ⱼ 交叉项);q̇=0 时全为 0。静态标定只能测到重力/摩擦、测不到这项,所以它是高速下丢精度/振动的元凶', step: 3, evidence: 'C·q̇=[−h(2q̇1q̇2+q̇2²), h q̇1²]、h=β sin q2;q̇=0→0' }),
        distractors: () => ['一直存在、即使静止', '只在有外力时出现', '只和重力方向有关'],
      },
      {
        id: 'dyn_gravcomp', label: '静止举着要不要力矩',
        ask: '机械臂静止(q̇=q̈=0)地举在半空，关节要不要输出力矩?这引出什么控制手段?', kind: 'choice',
        compute: () => ({ answer: '要,τ=G(q) 顶住重力(本例关节1 要 14.01 N·m)。这引出"重力补偿":把 G 项前馈掉,否则纯 PID 得靠积分硬扛、必然稳态下垂。更完整的是计算力矩控制 τ=M(q̈_d+Kd ė+Kp e)+Cq̇+G 抵消全部非线性', step: 4, evidence: '静止也要 τ=G;重力补偿=只前馈 G 的省档' }),
        distractors: () => ['不要，不动就不费力', '要，但只需静摩擦力矩', '要，但和构型无关、是常数'],
      },
      {
        id: 'dyn_gtorque', label: '静止举着关节1的重力力矩',
        ask: '本例两连杆臂静止举在 q=[30°,45°]，关节1 需要多大重力力矩顶住(N·m,取整)?', kind: 'number',
        compute: t => { const f = t as unknown as { G?: number[] }[]; const G = f.find(x => x.G)?.G; const v = G ? Math.round(G[0]!) : 14; return ({ answer: String(v), step: 4, evidence: `G₁=(m1 lc1+m2 l1)g cos q1+m2 lc2 g cos(q1+q2)=14.01≈${v} N·m;不补重力 PID 会稳态下垂` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'fk', title: '正向运动学 FK', kernel: fkKernel as Kernel<unknown>, doc: trivialDoc('fk'),
    facts: [
      {
        id: 'cum_angle', label: '累计朝向 cumθ 怎么算',
        ask: '三连杆机械臂 θ=[30°,60°,-30°]，正向运动学里"累计朝向 cumθ"是怎么来的、关节2 之后是多少?', kind: 'choice',
        compute: () => ({ answer: 'cumθᵢ = θ₁+θ₂+…+θᵢ，是从基座到当前关节的转角累加；关节2 之后 cumθ = 30+60 = 90°，所以那一节竖直向上走', step: 2, evidence: '关节2 后 cumθ=90°，从 (1.732,1) 沿 90° 走 L=2 → (1.732, 3)' }),
        distractors: () => ['只看当前关节角，关节2 后是 60°', 'cumθ 是各连杆长度之和', '累计朝向不影响末端位置'],
      },
      {
        id: 'fk_vs_ik', label: 'FK 和 IK 的区别',
        ask: '正向运动学 FK（关节角→末端）和逆运动学 IK（末端→关节角），难度和解的性质有什么本质区别?', kind: 'choice',
        compute: () => ({ answer: 'FK 是唯一解：关节角定了，沿连杆链 cos/sin 累加，末端位姿唯一确定（本例算出 (2.232,3.866)、朝向60°）。IK 反过来求关节角，可能多解、无解(够不到)或奇异，难得多', step: 3, evidence: 'FK 末端 (2.232,3.866) 由关节角唯一算出；IK 是反问题、不唯一' }),
        distractors: () => ['FK 和 IK 都是唯一解', 'IK 更简单因为直接读末端', '两者完全等价、可互相替代'],
      },
    ],
  },
  {
    id: 'ik', title: '逆运动学 IK', kernel: ikKernel as Kernel<unknown>, doc: trivialDoc('ik'),
    facts: [
      {
        id: 'multi_solution', label: 'IK 为什么会有多个解',
        ask: '二连杆机械臂逆运动学，用余弦定理算出 cosθ2 后 θ2=±acos(...)，这个±号意味着什么?', kind: 'choice',
        compute: () => ({ answer: '±两支对应两种姿势：肘朝下和肘朝上，两组关节角够到同一个末端点。这就是 IK 的"多解"——FK(唯一解)永远没有', step: 2, evidence: '本例 cosθ2=0 → θ2=±90° → 肘朝下(0°,90°) 与 肘朝上(90°,−90°) 都到 (2,2)' }),
        distractors: () => ['计算出错了，正确答案只有一个', '±号可以随意丢弃一个', '正负号表示误差范围'],
      },
      {
        id: 'reachable', label: 'IK 什么时候无解',
        ask: '给二连杆机械臂(L1=L2=2)一个末端目标，什么情况下逆运动学无解(够不到)?', kind: 'choice',
        compute: () => ({ answer: '目标到基座距离 r 超出可达范围 [|L1−L2|, L1+L2]=[0,4] 时无解：太远(r>4)伸直也够不到、太近(r<|L1−L2|)缩不进去。本例目标(2,2) r=2.828 在范围内够得到；(4.5,0) r=4.5>4 就无解', step: 1, evidence: 'r=2.828 ∈ [0,4] 够得到；r=4.5 > 4 手臂伸直也够不到' }),
        distractors: () => ['IK 永远有解，机械臂能到任何点', '只有目标在原点时无解', '关节数不够时才无解，和距离无关'],
      },
    ],
  },
  {
    id: 'trajectory', title: '轨迹规划', kernel: trajectoryKernel as Kernel<unknown>, doc: trivialDoc('trajectory'),
    facts: [
      {
        id: 'why_not_linear', label: '为什么不能匀速(线性插值)走',
        ask: '机器人关节从一个角度到另一个角度，为什么不能简单地线性插值(匀速)走过去?', kind: 'choice',
        compute: () => ({ answer: '匀速意味着速度在起点从 0 突跳到匀速值、终点又突跳回 0，那一瞬间加速度无穷大 → 电机顿挫、机械抖动。要平滑必须让速度在两端连续(为 0)', step: 1, evidence: '本例线性速度恒 45°/s，但起终点从 0 突跳=无穷加速度' }),
        distractors: () => ['匀速走速度太慢', '线性插值算不出中间位置', '匀速会走过头'],
      },
      {
        id: 'cubic_traj', label: '三次多项式怎么平滑起停',
        ask: '三次多项式轨迹 θ(t)=a0+a1t+a2t²+a3t³ 靠什么保证起停平滑？它的位置和速度曲线什么形状?', kind: 'choice',
        compute: () => ({ answer: '用 4 个边界条件定 4 个系数：两端位置 + 两端速度=0(起停静止)。于是位置走平滑 S 曲线、速度呈钟形(两端归零、中点最大)、加速度有限(不再无穷)', step: 8, evidence: '本例 a=[0,0,67.5,-22.5]，速度 0→64.8→0，t=2s 到位且速度归零' }),
        distractors: () => ['靠调大 T 让它慢慢走', '位置和速度都是直线', '三次多项式和线性插值效果一样'],
      },
    ],
  },
  {
    id: 'quat', title: '位姿与四元数', kernel: quatKernel as Kernel<unknown>, doc: trivialDoc('quat'),
    facts: [
      {
        id: 'quat_unit', label: '四元数为什么单位、几个数',
        ask: '机器人用四元数表示旋转，绕单位轴转 θ 的四元数怎么写、有什么约束?', kind: 'choice',
        compute: () => ({ answer: 'q=(w,x,y,z)=(cos(θ/2), sin(θ/2)·轴)，始终 |q|=1(单位四元数)。只用 4 个数编码一个旋转，比旋转矩阵的 9 个数(带 6 个正交约束)紧凑得多', step: 1, evidence: '本例绕 z 转 90° → q=(0.707,0,0,0.707)，|q|²=0.707²+0.707²=1' }),
        distractors: () => ['q=(θ, 轴)，共 4 个数、无约束', '四元数是 3 个数、和欧拉角一样', 'q 的模可以是任意值'],
      },
      {
        id: 'gimbal_lock', label: '万向锁：为什么不用欧拉角',
        ask: '欧拉角(roll/pitch/yaw)表示旋转有个致命问题叫"万向锁"，它具体是什么、什么时候发生?', kind: 'choice',
        compute: () => ({ answer: 'pitch=±90° 时 yaw 和 roll 变成绕同一根轴转，只剩它们的差起作用 → 丢一个自由度，本该三个独立角变两个。四元数和旋转矩阵没有这个奇异', step: 5, evidence: '本例 pitch=90° 时 (30,90,0)、(60,90,30)、(50,90,20) 三组不同角给出同一个旋转矩阵' }),
        distractors: () => ['欧拉角超过 360° 会溢出', '欧拉角计算量太大', '万向锁只发生在四元数上'],
      },
    ],
  },
  {
    id: 'jacobian', title: '雅可比矩阵', kernel: jacobianKernel as Kernel<unknown>, doc: trivialDoc('jacobian'),
    facts: [
      {
        id: 'jaco_meaning', label: '雅可比矩阵是什么',
        ask: '机器人学里的雅可比矩阵 J 把什么映射成什么？它的每一列代表什么?', kind: 'choice',
        compute: () => ({ answer: 'J 把关节角速度线性映成末端线速度：ẋ=Jθ̇，J=末端(x,y)对关节(θ1,θ2)的偏导。每一列 = 只转那个关节时末端往哪动；反着用 J⁻¹ 就是速度层 IK', step: 1, evidence: '本例 J=[[-2.732,-1.732],[0.732,-1]]；θ̇=[1,0]→末端速度=第1列(-2.732,0.732)' }),
        distractors: () => ['把末端位置映成关节角(那是 IK)', '把力映成加速度', 'J 是常数矩阵，和构型无关'],
      },
      {
        id: 'singularity', label: '奇异构型：det(J)=0',
        ask: '二连杆机械臂 det(J)=L1·L2·sinθ2，什么构型下 J 奇异、末端会丢一个自由度?', kind: 'choice',
        compute: () => ({ answer: 'θ2=0(手臂完全伸直)或 180°(对折)时 sinθ2=0 → det(J)=0、J 奇异：两列平行，末端此刻只能沿一个方向动、丢一个自由度，J⁻¹ 爆炸。工程上要绕开或用阻尼最小二乘', step: 5, evidence: '本例 θ2=90° 时 det=4 可逆；θ2=0 伸直时 det=0 奇异、两列平行' }),
        distractors: () => ['θ1=0 时奇异', '关节速度过大时奇异', 'J 永远可逆、不会奇异'],
      },
    ],
  },
  {
    id: 'slam', title: 'SLAM 回环校正', kernel: slamKernel as Kernel<unknown>, doc: trivialDoc('slam'),
    facts: [
      {
        id: 'odom_drift', label: '为什么里程计会漂移',
        ask: 'SLAM 里机器人靠里程计推算位置，走一圈回到起点却以为自己在别处，为什么?', kind: 'choice',
        compute: () => ({ answer: '里程计有系统误差(轮子打滑、标定偏差)，每步累积一点点、越走越偏。走一圈本该回到起点，里程计终点却偏出一个缺口，这个缺口就是累计漂移', step: 9, evidence: '本例走八边形一圈，里程计终点 (2.45,0.82) 而非起点 (0,0)，累计漂移 2.58' }),
        distractors: () => ['里程计没误差，是地图错了', '机器人真的走到了别处', '因为没有 GPS'],
      },
      {
        id: 'loop_closure', label: '回环校正怎么提升精度',
        ask: 'SLAM 的"回环检测+位姿图优化"怎么把累计漂移大幅抹平?', kind: 'choice',
        compute: () => ({ answer: '机器人认出回到走过的地方(相同地标)，加一条强约束"终点=起点"；位姿图优化把这个回环误差分摊回整条轨迹(每个位姿按比例拉回)→环闭合、之前的漂移被抹平', step: 10, evidence: '本例回环校正把漂移分摊回去，轨迹平均误差从 1.26 骤降到 0.25、环闭合' }),
        distractors: () => ['重新走一遍取平均', '把里程计误差直接设为 0', '只修正终点、中间不管'],
      },
    ],
  },
  {
    id: 'icp', title: 'ICP 点云配准', kernel: icpKernel as Kernel<unknown>, doc: trivialDoc('icp'),
    facts: [
      {
        id: 'icp_two_steps', label: 'ICP 的两步迭代',
        ask: 'ICP 并不知道两片点云的点怎么对应，它靠什么把点云对齐?', kind: 'choice',
        compute: () => ({ answer: '两步反复迭代：① 每个源点找目标里欧氏最近的点当对应(一开始会猜错几个)；② 用这批点对算最佳刚体变换(Kabsch/SVD)搬过去。对应和变换互相改进、误差单调下降', step: 1, evidence: '本例对应从 00134 逐轮修正到 01234，误差 0.72→0.55→0.22→0.01' }),
        distractors: () => ['穷举所有点的配对组合找最优', '需要人工标注每个点的对应关系', '直接用一次最小二乘就能对齐'],
      },
      {
        id: 'icp_local', label: 'ICP 为什么依赖初值',
        ask: 'ICP 有个著名的局限：依赖初值。为什么初始差太多会失败?', kind: 'choice',
        compute: () => ({ answer: '初始差太大时，欧氏最近点算出的对应会系统性地错(点连到错误的目标点)，基于错对应求出的变换把点云带向错误方向 → 陷入局部最优。所以实际先用粗配准(特征匹配/IMU 里程计)给个好初值再上 ICP 精配', step: 4, evidence: '本例初始 25° 尚可收敛；若初始偏差过大对应全错就收不回来' }),
        distractors: () => ['ICP 从不失败、总能全局最优', '初值只影响速度、不影响结果', 'ICP 需要初值是因为要设旋转角'],
      },
    ],
  },
  {
    id: 'complementary', title: '互补滤波 · IMU 姿态', kernel: complementaryKernel as Kernel<unknown>, doc: trivialDoc('complementary'),
    facts: [
      {
        id: 'comp_gyro', label: '为什么不能只用陀螺',
        ask: '为什么不能只用陀螺仪(积分角速度)来测倾角?', kind: 'choice',
        compute: () => ({ answer: '陀螺测角速度、积分得角度,短期很准很平滑,但它有 bias,积分会把 bias 累积成漂移(逐秒偏、且没有绝对参考、回不来)。几十秒就漂出好几度', step: 2, evidence: '积分累积 bias→无限漂;无绝对参考' }),
        distractors: () => ['陀螺测不了角度、只能测加速度', '陀螺太贵、只用加速度更省', '陀螺噪声太大、抖得没法用'],
      },
      {
        id: 'comp_accel', label: '加速度计的长短板',
        ask: '加速度计测倾角有什么优点和缺点?', kind: 'choice',
        compute: () => ({ answer: '优点:静止时测重力方向→算出绝对倾角、不会漂(重力是天然绝对参考)。缺点:噪声大、抖动厉害,机器人一运动线加速度混进来污染读数。所以只用加速度计角度跳个不停', step: 3, evidence: '绝对不漂 vs 噪声大抖、运动污染' }),
        distractors: () => ['优点是平滑、缺点是会漂', '优点缺点都和陀螺一样', '加速度计不能测倾角'],
      },
      {
        id: 'comp_fuse', label: '互补滤波怎么融',
        ask: '互补滤波 θ=α·(θ_prev+ω·dt)+(1−α)·θ_acc 是怎么融合两个传感器的?', kind: 'choice',
        compute: () => ({ answer: 'α·陀螺项=高通(短期信陀螺、平滑不抖)、(1−α)·加速度项=低通(长期用加速度的绝对参考慢慢纠陀螺的漂移)。两信号频段互补(gyro 管高频、accel 管低频)、合起来既平滑又不漂', step: 4, evidence: '高通陀螺+低通加速度、频段互补' }),
        distractors: () => ['取两者平均、各占一半', '谁噪声小用谁、二选一', '把两者相乘'],
      },
      {
        id: 'comp_alpha', label: 'α 怎么取舍',
        ask: '互补滤波的 α 该取大还是小?有什么取舍?', kind: 'choice',
        compute: () => ({ answer: 'α 大(≈0.98)偏信陀螺→平滑抗抖,但靠很小的加速度权重纠漂、纠得慢;α 小偏信加速度→压漂快但跟着抖。工程常取 α≈0.98(采样越快 α 越接近 1)。它是定增益,和卡尔曼自适应增益不同', step: 4, evidence: 'α 大平滑纠漂慢、小压漂快但抖' }),
        distractors: () => ['α 越大越好、取 1 最优', 'α 越小越好、取 0 最优', 'α 必须精确等于 0.5'],
      },
      {
        id: 'comp_num', label: '融合倾角',
        ask: '陀螺积分得 30.2°、加速度得 32°、α=0.98，互补融合 θ=α·30.2+(1−α)·32 约为多少?(一位小数)', kind: 'number',
        compute: t => { const f = t as unknown as { fused?: number }[]; const l = f.find(x => x.fused != null); const v = l?.fused != null ? Math.round(l.fused * 10) / 10 : 30.2; return ({ answer: String(v), step: 4, evidence: `θ=0.98×30.2+0.02×32=29.596+0.64≈${v}°(几乎跟陀螺、只被加速度拉一点点)` }) },
        distractors: () => ['32.0', '31.1', '30.0', '29.0'],
      },
    ],
  },
  {
    id: 'ukf', title: '无迹卡尔曼滤波 UKF', kernel: ukfKernel as Kernel<unknown>, doc: trivialDoc('ukf'),
    facts: [
      {
        id: 'ukf_core', label: 'UKF 和 EKF 的区别',
        ask: 'UKF 处理非线性和 EKF 最本质的区别是什么?', kind: 'choice',
        compute: () => ({ answer: 'EKF 在估计点求雅可比、把非线性函数线性化(要求导、只一阶近似);UKF 挑一组确定性 sigma 点、让它们原样穿过真非线性函数、再从变换后的点重组均值/协方差。名言:近似分布比近似函数容易', step: 1, evidence: 'sigma 点过真非线性 vs 雅可比切线' }),
        distractors: () => ['UKF 用二阶泰勒、要算 Hessian', 'UKF 用一堆随机粒子、和粒子滤波一样', 'UKF 只是 EKF 换了个名字'],
      },
      {
        id: 'ukf_sigma', label: 'sigma 点怎么取',
        ask: 'UKF 的 sigma 点是怎么取的?为什么是确定性的?', kind: 'choice',
        compute: t => { const f = t as unknown as { sigmas?: unknown[] }[]; const l = f.find(x => x.sigmas); const n = l?.sigmas?.length ?? 3; return ({ answer: `n 维状态取 2n+1 个点(本例 n=1→${n} 个):X₀=μ、Xᵢ=μ±(√((n+λ)P))ᵢ,围绕均值、按协方差铺开。是算出来的确定性点(不是随机采样),能精确捕捉均值和协方差、过非线性后还能到高阶精度`, step: 2, evidence: `2n+1 个;X₀=μ、两侧 μ±√((n+λ)P)` }) },
        distractors: () => ['随机采 N 个点、和粒子滤波一样', '只取均值一个点', '取协方差矩阵的特征向量'],
      },
      {
        id: 'ukf_vs_ekf_when', label: 'UKF 何时比 EKF 强',
        ask: 'UKF 在什么情况下明显比 EKF 好?什么情况下差不多?', kind: 'choice',
        compute: () => ({ answer: '不确定大(协方差大)/非线性强时 UKF 明显更好:sigma 点铺得开、把函数曲率算进来,而 EKF 的一阶线性化误差大。不确定小/局部近似线性时两者几乎一样(sigma 点靠得近)。所以 UKF 的优势在强非线性/大不确定时才显现', step: 5, evidence: '本例 P 大时 UKF/EKF 分道、P 小时≈' }),
        distractors: () => ['UKF 永远比 EKF 好几个数量级', 'UKF 只在测量噪声大时更好', '两者任何情况都完全相同'],
      },
      {
        id: 'ukf_family', label: '滤波家族怎么选',
        ask: 'KF/EKF/UKF/粒子滤波这个贝叶斯滤波家族，怎么选?', kind: 'choice',
        compute: () => ({ answer: '线性→卡尔曼 KF;弱非线性/要快→EKF(雅可比);强非线性/难求导→UKF(sigma 点、免求导、捕捉曲率);多峰/非高斯(如全局定位)→粒子滤波(一堆样本)。KF/EKF/UKF 都是单高斯(单峰)、PF 能表任意分布', step: 5, evidence: '单峰高斯(KF/EKF/UKF)vs 多峰样本(PF)' }),
        distractors: () => ['永远用粒子滤波最准', '永远用 EKF 最快最好', '它们完全等价、随便选'],
      },
      {
        id: 'ukf_nsigma', label: 'sigma 点个数',
        ask: '一维状态(n=1)的 UKF，需要取几个 sigma 点?(2n+1)', kind: 'number',
        compute: t => { const f = t as unknown as { sigmas?: unknown[] }[]; const l = f.find(x => x.sigmas); const n = l?.sigmas?.length ?? 3; return ({ answer: String(n), step: 2, evidence: `2n+1=2·1+1=${n}:中心点 μ 加两侧 μ±√((n+λ)P)` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'particlefilter', title: '粒子滤波 · 蒙特卡洛定位', kernel: particlefilterKernel as Kernel<unknown>, doc: trivialDoc('particlefilter'),
    facts: [
      {
        id: 'pf_why', label: '粒子滤波比 EKF 强在哪',
        ask: '粒子滤波相比卡尔曼/EKF，能表示什么它们表示不了的?', kind: 'choice',
        compute: () => ({ answer: 'KF/EKF 用一个高斯(均值+协方差)只能表单峰;粒子滤波用 N 个带权粒子近似任意分布,能表多峰/非高斯(如全局定位"我可能在长得一样的走廊 A 或 B"、绑架问题),且不需要线性化', step: 1, evidence: '一堆样本 vs 一个高斯;多峰/非高斯' }),
        distractors: () => ['粒子滤波更快、算力更省', '粒子滤波不需要观测模型', '粒子滤波精度总是更高'],
      },
      {
        id: 'pf_weight', label: '粒子权重怎么定',
        ask: '粒子滤波里每个粒子的权重是怎么定的?', kind: 'choice',
        compute: () => ({ answer: '权重 ∝ 观测似然 p(z|x_i):粒子预测的测量和实测越接近、权重越高。本例位置测量、似然高斯 w_i=exp(−(z−x_i)²/(2σ²)),离 z 近的粒子权重大。相当于用测量给粒子打分', step: 2, evidence: '加权=测量更新;w∝似然' }),
        distractors: () => ['权重都相等、不变', '权重按粒子离原点的距离', '权重是随机分配的'],
      },
      {
        id: 'pf_resample', label: '为什么要重采样',
        ask: '粒子滤波为什么每隔几步要重采样?不重采样会怎样?', kind: 'choice',
        compute: () => ({ answer: '不重采样,迭代几步后权重会全集中到极少数粒子(其余趋近 0、有效样本数 N_eff→1),粒子退化(degeneracy)、大量粒子浪费在低概率区。重采样(高权复制、低权淘汰、权重重置均匀)把算力聚到高概率区。判据:N_eff<N/2 就重采样', step: 4, evidence: 'N_eff=1/Σw²;退化 vs 聚拢' }),
        distractors: () => ['为了增加粒子数量提高精度', '为了把粒子随机打散增加探索', '重采样只是为了好看、可省略'],
      },
      {
        id: 'pf_neff', label: '有效样本数 N_eff',
        ask: '有效样本数 N_eff=1/Σw² 衡量什么?什么时候触发重采样?', kind: 'choice',
        compute: () => ({ answer: '衡量"实际有多少粒子在起作用":权重均匀时 N_eff≈N(满值)、权重集中到一个粒子时 N_eff→1。标准做法是 N_eff<N/2 就重采样。它是判断粒子退化程度的指标', step: 3, evidence: 'N_eff∈[1,N];<N/2 触发重采样' }),
        distractors: () => ['衡量粒子的平均位置', '衡量测量噪声大小', 'N_eff 越小说明估计越准'],
      },
      {
        id: 'pf_neff_num', label: '本例有效样本数',
        ask: '本例 6 个粒子、权重集中在中间几个，有效样本数 N_eff=1/Σw² 约为多少?(一位小数，满值为 6)', kind: 'number',
        compute: t => { const f = t as unknown as { neff?: number }[]; const l = f.find(x => x.neff != null); const v = l?.neff != null ? Math.round(l.neff * 10) / 10 : 3.7; return ({ answer: String(v), step: 3, evidence: `N_eff=1/Σw²≈${v}(满值 6);权重集中让它从 6 掉下来、接近 N/2=3 阈值` }) },
        distractors: () => ['6.0', '1.0', '5.5', '2.0'],
      },
    ],
  },
  {
    id: 'pinhole', title: '针孔相机 · 投影与畸变', kernel: pinholeKernel as Kernel<unknown>, doc: trivialDoc('pinhole'),
    facts: [
      {
        id: 'pin_perspective', label: '投影最关键的一步',
        ask: '针孔相机把 3D 点 (X,Y,Z) 投到像素，最关键的一步是什么?', kind: 'choice',
        compute: () => ({ answer: '除以深度 Z:透视投影 x_n=X/Z、y_n=Y/Z。同样大的东西 Z 越大(越远)投影越小=近大远小;这一步是非线性的(除法),也是单张图丢深度的原因(不同 Z、同 X/Z 投到同一像素、单目测不了绝对尺度)', step: 2, evidence: '除以深度=近大远小、丢深度' }),
        distractors: () => ['乘以焦距', '加上畸变系数', '旋转到相机坐标系'],
      },
      {
        id: 'pin_intrinsic', label: '内参是什么',
        ask: '相机内参 K 里的 fx,fy,cx,cy 分别是什么?', kind: 'choice',
        compute: () => ({ answer: 'fx,fy 是焦距(像素单位),把归一化坐标放大到像素;cx,cy 是主点(光轴与像平面的交点、≈图像中心)。像素 u=fx·x_n+cx、v=fy·y_n+cy。K=[[fx,0,cx],[0,fy,cy],[0,0,1]]', step: 3, evidence: 'fx,fy 焦距;cx,cy 主点' }),
        distractors: () => ['fx,fy 是畸变系数、cx,cy 是位姿', 'fx,fy 是图像宽高、cx,cy 是深度', '都是外参'],
      },
      {
        id: 'pin_distortion', label: '径向畸变的特点',
        ask: '径向畸变 x_d=x_n(1+k1 r²+k2 r⁴) 有什么特点?', kind: 'choice',
        compute: () => ({ answer: '离图像中心(主点)越远、r 越大、畸变越明显(桶形/枕形):图像边缘的直线被拍弯、中心几乎不变。这是真镜头非理想造成的,用图前要去畸变把像素纠回理想针孔位置', step: 4, evidence: 'r 越大越弯;边缘明显中心不变' }),
        distractors: () => ['所有像素均匀偏移', '离中心越近越弯', '和焦距无关的常数偏移'],
      },
      {
        id: 'pin_calib', label: '相机标定怎么做',
        ask: '相机内参和畸变系数是怎么求出来的(标定)?', kind: 'choice',
        compute: () => ({ answer: '拍多张棋盘格:棋盘格角点的 3D 位置已知、在图上检测到对应的 2D 像素,用一堆已知 3D↔2D 对应反求 fx,fy,cx,cy,k1,k2(张正友标定法最常用)。标定是所有视觉测量的前提', step: 4, evidence: '棋盘格已知3D↔2D反求;张正友法' }),
        distractors: () => ['从相机说明书直接读', '用深度传感器测', '不需要标定、假设理想针孔'],
      },
      {
        id: 'pin_num', label: '理想像素坐标',
        ask: '相机系点 X=(3,2,5)、fx=500、cx=320，无畸变时像素 u=fx·(X/Z)+cx 是多少?', kind: 'number',
        compute: t => { const f = t as unknown as { uIdeal?: number }[]; const l = f.find(x => x.uIdeal != null); const v = l?.uIdeal != null ? Math.round(l.uIdeal) : 620; return ({ answer: String(v), step: 3, evidence: `x_n=3/5=0.6、u=500·0.6+320=${v}(透视除以深度再乘焦距加主点)` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'pointcloud', title: '点云预处理 · 下采样+法线', kernel: pointcloudKernel as Kernel<unknown>, doc: trivialDoc('pointcloud'),
    facts: [
      {
        id: 'pc_normal', label: '法线是哪个特征向量',
        ask: '点云法线估计(PCA):一个点的表面法线对应邻域协方差矩阵的哪个特征向量?', kind: 'choice',
        compute: () => ({ answer: '最小特征值对应的特征向量。表面法线方向上点云几乎没铺开(方差最小),所以是最小特征值那个方向;最大特征值的特征向量是表面切向(点云铺开的方向)', step: 5, evidence: '最小 λ 的特征向量=法线(方差最小方向⊥面)' }),
        distractors: () => ['最大特征值对应的特征向量', '所有特征向量的平均', '协方差矩阵的对角线'],
      },
      {
        id: 'pc_voxel', label: '体素下采样怎么做',
        ask: '体素下采样(voxel grid)是怎么把点云降密度的?', kind: 'choice',
        compute: () => ({ answer: '把空间切成边长 L 的网格,点落哪格看 ⌊坐标/L⌋,每个被占用的体素只保留落在里面所有点的质心(平均位置)、其余丢掉。效果是点数下降且密度变均匀;L 越大越粗(点更少、细节丢更多)', step: 1, evidence: '网格分箱、每格取质心;L 控制粗细' }),
        distractors: () => ['随机删掉一半点', '只保留每格里第一个点', '按距离排序取前 N 个'],
      },
      {
        id: 'pc_lambda', label: 'λ 的比说明什么',
        ask: '法线估计里,邻域协方差的特征值 λ 之间的比(λ小/λ大)能说明什么?', kind: 'choice',
        compute: () => ({ answer: '局部形状(曲率):λ小/λ大≈0→局部很平(法线可靠);若几个 λ 都不小→是边/角、点云在多个方向都铺开、法线不确定。本例 λ=0.687/0.013、比≈0.02→局部很平', step: 5, evidence: 'λ 比≈0 平面、都不小=边/角' }),
        distractors: () => ['点云的颜色', '相机到点的距离', '下采样用的 L 大小'],
      },
      {
        id: 'pc_why', label: '为什么要算法线',
        ask: '配准/建图前为什么要给每个点算表面法线?', kind: 'choice',
        compute: () => ({ answer: '点到面(point-to-plane)ICP 的误差要用法线(比点到点收敛快)、法向一致性用来剔除外点/错匹配、曲面重建和抓取姿态也都要法线。法线是点云几何的基本局部特征', step: 5, evidence: '点到面 ICP、剔外点、重建/抓取都要法线' }),
        distractors: () => ['为了给点云上色', '为了压缩点云体积', '法线只是可视化好看、算法不用'],
      },
      {
        id: 'pc_num', label: '下采样后点数',
        ask: '8 个点做体素下采样、L=1(细)时下采样到几个点?(每个占用体素取质心)', kind: 'number',
        compute: t => { const f = t as unknown as { voxels?: unknown[]; L?: number }[]; const l = f.find(x => x.L === 1 && x.voxels); const v = l?.voxels?.length ?? 5; return ({ answer: String(v), step: 1, evidence: `L=1 网格下 8 点占 ${v} 个体素、每格取质心 → ${v} 个下采样点` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'stereo', title: '双目立体视觉 · 视差求深度', kernel: stereoKernel as Kernel<unknown>, doc: trivialDoc('stereo'),
    facts: [
      {
        id: 'st_depth', label: '深度和视差的关系',
        ask: '双目立体视觉里,深度 Z 和视差 d 是什么关系?', kind: 'choice',
        compute: () => ({ answer: 'Z = f·b / d(f 焦距、b 基线、d 视差)。因为视差 d=f·b/Z、反过来就是 Z=f·b/d。视差越大越近、测出视差就得深度。标定好 f、b 后,逐像素测视差就得整幅深度图', step: 3, evidence: 'Z=f·b/d;视差越大越近' }),
        distractors: () => ['Z=f·b·d,视差越大越远', 'Z 和视差无关、要另外测', 'Z=d/(f·b)'],
      },
      {
        id: 'st_disp', label: '视差为什么∝1/Z',
        ask: '视差 d=x_L−x_R 为什么只和深度有关、且近大远小?', kind: 'choice',
        compute: () => ({ answer: 'x_L=f·X/Z+cx、x_R=f·(X−b)/Z+cx,相减 d=f·b/Z——横坐标 X 抵消了、只剩 f·b/Z,所以视差 ∝1/Z(近大远小、和 X 无关)。像手指凑到眼前左右眼差很大、看远山几乎没差', step: 2, evidence: 'd=f·b/Z、X 抵消、∝1/Z' }),
        distractors: () => ['视差和横坐标 X 成正比', '视差是个常数、和深度无关', '视差∝Z、越远越大'],
      },
      {
        id: 'st_prec', label: '为什么远处不准',
        ask: '双目测深度为什么远处越来越不准?', kind: 'choice',
        compute: () => ({ answer: '对 Z=f·b/d 求导:ΔZ≈(Z²/(f·b))·Δd,深度误差随距离的平方增长(∝Z²)。视差是离散像素、总有 ~1px 误差,近处 1px 只差几厘米、远处同样 1px 就差几十厘米。所以双目擅长近处、远处退化', step: 5, evidence: 'ΔZ∝Z²、远处误差随距离平方涨' }),
        distractors: () => ['远处光线弱、噪声大而已', '远处视差大、反而更准', '和距离无关、都一样准'],
      },
      {
        id: 'st_improve', label: '怎么测更远更准',
        ask: '想让双目测得更远、更准,可以怎么做?', kind: 'choice',
        compute: () => ({ answer: '加大基线 b 或焦距 f(都让同样深度的视差变大、精度提高),或做亚像素视差(把视差误差 Δd 压到 <1px)。因为 ΔZ≈Z²/(f·b)·Δd,增大 f·b、减小 Δd 都能降低深度误差。代价:大基线两图重叠区变小、近处盲区变大', step: 5, evidence: '加大 b/f 或亚像素视差(降 Δd)' }),
        distractors: () => ['缩小基线 b', '缩短焦距 f', '把两个相机叠在一起'],
      },
      {
        id: 'st_num', label: '还原深度',
        ask: 'f=500px、基线 b=0.1m、测得视差 d=25px，深度 Z=f·b/d 是多少米?', kind: 'number',
        compute: t => { const f = t as unknown as { disp?: number; Zrec?: number }[]; const l = f.find(x => x.disp === 25 && x.Zrec != null); const v = l?.Zrec ?? 2; return ({ answer: String(v), step: 3, evidence: `Z=f·b/d=500·0.1/25=50/25=${v}m` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'handeye', title: '手眼标定 AX=XB', kernel: handeyeKernel as Kernel<unknown>, doc: trivialDoc('handeye'),
    facts: [
      {
        id: 'he_what', label: '手眼标定求什么',
        ask: '手眼标定(AX=XB)要求解的 X 是什么?', kind: 'choice',
        compute: () => ({ answer: '相机坐标系和夹爪(手)坐标系之间的固定变换(位置+朝向)。相机装在手腕上(eye-in-hand),要用相机看到的东西指挥手去抓,必须先知道这个固定关系 X', step: 1, evidence: 'X=相机↔夹爪的固定变换' }),
        distractors: () => ['相机的内参(焦距、主点)', '机器人每个关节的角度', '标定板在世界里的位置'],
      },
      {
        id: 'he_data', label: 'A 和 B 怎么来',
        ask: '手眼方程 A·X=X·B 里,A 和 B 分别怎么得到?', kind: 'choice',
        compute: () => ({ answer: '机器人动几下:A=夹爪的相对运动,由关节角+正运动学 FK 算(机器人自己知道);B=相机的相对运动,让相机盯着一块固定标定板、从图像算出相机动了多少。相机固连夹爪→A·X=X·B', step: 1, evidence: 'A 靠 FK、B 靠看固定标定板' }),
        distractors: () => ['A、B 都由相机测', 'A 是标定板位置、B 是相机内参', 'A、B 都由关节编码器直接给'],
      },
      {
        id: 'he_angle', label: '为什么 θ_A=θ_B',
        ask: '手眼标定里,为什么每组运动 A 的旋转角必须等于 B 的旋转角?', kind: 'choice',
        compute: () => ({ answer: '因为 R_B=R_X⁻¹ R_A R_X,R_A 和 R_B 是相似矩阵、相似矩阵旋转角相等,所以 θ_A=θ_B 是硬约束。可当自检:哪组 θ_A≠θ_B 就是这组数据配错了(时间戳没对齐/标定板没看准)、该剔除', step: 3, evidence: 'R_A~R_B 相似、角相等、可自检' }),
        distractors: () => ['巧合、不一定相等', 'A 的角总是 B 的两倍', '因为转轴一样'],
      },
      {
        id: 'he_solve', label: '旋转和平移怎么解',
        ask: '手眼标定 AX=XB 通常怎么解?', kind: 'choice',
        compute: () => ({ answer: '拆两步:①先解旋转 R_X——R_X 把 B 的转轴转到 A 的转轴(n_A=R_X n_B)、≥2 组不共线运动定出 R_X;②再解平移 t_X——(R_A−I)t_X=R_X t_B−t_A 是线性方程、≥2 组凑满秩解出。多组做最小二乘去噪(Tsai-Lenz/Park-Martin)', step: 4, evidence: '先旋转(轴对应)后平移(线性)' }),
        distractors: () => ['一步直接矩阵求逆 X=A⁻¹XB', '只解旋转、平移不用管', '随机搜索直到 AX≈XB'],
      },
      {
        id: 'he_eih', label: 'eye-in-hand vs eye-to-hand',
        ask: 'eye-in-hand 和 eye-to-hand 有什么区别?', kind: 'choice',
        compute: () => ({ answer: 'eye-in-hand=相机装在手腕/夹爪上、跟着手一起动(本实验就是,方程 AX=XB 求相机↔夹爪);eye-to-hand=相机固定在外面看着机器人(求相机↔机器人基座)。两者方程形式类似、但 X 的含义和数据采法不同', step: 5, evidence: 'in-hand相机在手上动、to-hand相机在外固定' }),
        distractors: () => ['一个用单目、一个用双目', 'eye-to-hand 不需要标定', '只是叫法不同、完全一样'],
      },
    ],
  },
  {
    id: 'vo', title: '视觉里程计 · 对极几何', kernel: voKernel as Kernel<unknown>, doc: trivialDoc('vo'),
    facts: [
      {
        id: 'vo_essential', label: '本质矩阵是什么',
        ask: '对极几何里的本质矩阵 E 打包了什么?', kind: 'choice',
        compute: () => ({ answer: 'E=[t]×R,在归一化坐标下打包相机的相对旋转 R 和平移方向 t([t]× 是 t 的反对称叉乘矩阵)。带内参的像素坐标对应基础矩阵 F=K⁻ᵀE K⁻¹。E 秩 2、5 个自由度(3 旋转+2 平移方向、尺度未定)', step: 1, evidence: 'E=[t]×R、打包相对旋转+平移方向' }),
        distractors: () => ['相机的内参 K(焦距、主点)', '两帧之间的时间差', '3D 点的绝对坐标'],
      },
      {
        id: 'vo_constraint', label: '对极约束与 8 点法',
        ask: '对极约束 x2ᵀE x1=0 为什么能用来解本质矩阵 E?', kind: 'choice',
        compute: () => ({ answer: '因为 x2ᵀE x1=0 对 E 的 9 个元素是线性的,每对匹配点给一个线性方程,给 ≥8 对匹配就能线性解出 E(8 点法,Longuet-Higgins)。实际有误匹配,用 RANSAC 稳健估计', step: 2, evidence: '对 E 线性、≥8 对匹配解 E(8 点法)' }),
        distractors: () => ['它是非线性的、要迭代优化', '一对匹配点就能解出 E', '它给出 3D 点的深度'],
      },
      {
        id: 'vo_epi', label: '对极线和极点',
        ask: '对极线 l2=E x1 和极点是什么?有什么用?', kind: 'choice',
        compute: () => ({ answer: 'l2=E x1 是 x1 在第二帧的对极线,x2 必落在它上面;所有对极线交于极点 e2(=平移方向的像)。用处:找 x1 在第二帧的匹配只需沿这一条对极线搜、不用搜整幅图,极大加速。前进平移时极点是图心扩张焦点 FOE、线放射;横向平移时极点在无穷远、线水平', step: 3, evidence: 'x2 在对极线上、沿线搜匹配、交于极点' }),
        distractors: () => ['对极线是 3D 点的轨迹', '极点是图像最亮的点', '和匹配无关、只是可视化'],
      },
      {
        id: 'vo_scale', label: '单目为什么无尺度',
        ask: '单目视觉里程计从两帧为什么只能定平移方向、定不了绝对尺度?', kind: 'choice',
        compute: () => ({ answer: '因为本质矩阵 E 对 t 的尺度是齐次的——E 和 2E(即 t 和 2t)给出完全相同的对极约束,尺度不可观。所以单目只能定平移方向、不知道是小场景走 1 米还是大场景走 100 米。要定尺度靠双目基线、IMU、已知物体大小或回环', step: 5, evidence: 'E 与 2E 同约束、尺度不可观' }),
        distractors: () => ['相机分辨率不够高', '因为没有 GPS', '因为只用了 8 个点'],
      },
      {
        id: 'vo_recover', label: '从 E 恢复位姿',
        ask: '从本质矩阵 E 恢复相机运动 (R,t) 怎么做?', kind: 'choice',
        compute: () => ({ answer: '对 E 做 SVD 分解,得到 4 组 (R,t) 候选(旋转 2 种×平移 ±方向);用手性检验(cheirality)——真正那组必须让三角化出的 3D 点在两个相机前方(深度为正)——选出唯一解。之后三角化匹配点建 3D 地图、接成轨迹', step: 5, evidence: 'SVD 得 4 解、手性(点在相机前方)选唯一' }),
        distractors: () => ['直接矩阵求逆 (R,t)=E⁻¹', 'E 已经就是 (R,t)、不用分解', '随机搜索直到满足约束'],
      },
    ],
  },
  {
    id: 'pnp', title: 'PnP · 6D 位姿估计', kernel: pnpKernel as Kernel<unknown>, doc: trivialDoc('pnp'),
    facts: [
      {
        id: 'pnp_what', label: 'PnP 求什么',
        ask: 'PnP(Perspective-n-Point)要解的是什么?', kind: 'choice',
        compute: () => ({ answer: '已知 n 个 3D 点(物体系坐标)+它们的 2D 像素+内参 K,求相机相对物体的 6 自由度位姿 (R,t)(3 旋转+3 平移)。3D 点来自 CAD 模型角点或 SLAM 地图点', step: 1, evidence: '2D-3D 对应 + K → 6 自由度位姿' }),
        distractors: () => ['求相机的内参 K', '求 3D 点之间的距离', '求图像的深度图'],
      },
      {
        id: 'pnp_crit', label: 'PnP 的准则',
        ask: 'PnP 求位姿要最小化的量(准则)是什么?', kind: 'choice',
        compute: () => ({ answer: '重投影误差 Σ‖投影(X_i;R,t)−观测像素_i‖²。真正的位姿能把 3D 点按 u=K[R|t]X 投影后正好落在观测像素上、误差=0;位姿越偏、各点像素残差越大。PnP 就是找让这个误差最小的位姿', step: 2, evidence: '最小化重投影误差、真位姿处=0' }),
        distractors: () => ['3D 点两两之间的距离', '图像的亮度差', '相机移动的速度'],
      },
      {
        id: 'pnp_p3p', label: 'P3P 为什么 4 解',
        ask: 'P3P(用 3 个点的最小 PnP)有什么特点?', kind: 'choice',
        compute: () => ({ answer: '3 个点是求位姿的最小情形,几何上一般解出 4 组候选位姿(有歧义),需要用第 4 个点的投影一致性来消歧、选出唯一解。是很多 RANSAC-PnP 的最小样本', step: 4, evidence: '3 点给 4 组候选、第 4 点消歧' }),
        distractors: () => ['3 点直接给唯一解、不用消歧', 'P3P 需要至少 6 个点', 'P3P 只能求平移不能求旋转'],
      },
      {
        id: 'pnp_methods', label: 'PnP 的解法',
        ask: '常见的 PnP 解法有哪些?', kind: 'choice',
        compute: () => ({ answer: 'P3P(3 点 4 解、第 4 点消歧)、DLT/线性 PnP(≥6 点、把投影排成线性方程 SVD 解)、EPnP(把点表成 4 个控制点、O(n)、OpenCV solvePnP 常用),最后用高斯-牛顿/LM 迭代最小化重投影误差精修、配 RANSAC 去外点', step: 4, evidence: 'P3P/DLT/EPnP + 高斯牛顿精修 + RANSAC' }),
        distractors: () => ['只有暴力搜索一种', '直接矩阵求逆', '必须用深度学习'],
      },
      {
        id: 'pnp_use', label: 'PnP 的用途',
        ask: 'PnP 在机器人/SLAM 里典型用在哪?', kind: 'choice',
        compute: () => ({ answer: 'VO/SLAM 建好 3D 地图后、新一帧靠 PnP 用 2D-3D 对应快速重定位(比重做对极几何稳);机械臂抓取先求物体 6D 位姿(2D-3D 或 CAD 模型)才能规划抓;AR 标记/物体跟踪。是把图像观测对齐到已知 3D 结构的标准工具', step: 5, evidence: 'SLAM 重定位、抓取求 6D 位姿、AR 跟踪' }),
        distractors: () => ['给点云做下采样', '标定相机内参', '生成深度图'],
      },
    ],
  },
  {
    id: 'ekf', title: '扩展卡尔曼滤波 EKF', kernel: ekfKernel as Kernel<unknown>, doc: trivialDoc('ekf'),
    facts: [
      {
        id: 'ekf_core', label: 'EKF 和线性卡尔曼的区别',
        ask: 'EKF(扩展卡尔曼滤波)和线性卡尔曼滤波最本质的区别是什么?', kind: 'choice',
        compute: () => ({ answer: 'EKF 在当前估计点对非线性的运动/观测函数 f/h 求雅可比(F/H)、用一阶泰勒就地线性化,再套原来的卡尔曼预测-更新公式。其余完全一样', step: 1, evidence: '唯一不同=雅可比线性化;非线性时能用卡尔曼' }),
        distractors: () => ['EKF 用神经网络代替线性模型', 'EKF 不需要预测步、只有更新', 'EKF 用二阶导数、更精确'],
      },
      {
        id: 'ekf_jacobian', label: '观测雅可比 H 是什么',
        ask: 'EKF 里观测雅可比 H=∂h/∂x 的物理意义是什么?', kind: 'choice',
        compute: t => { const f = t as unknown as { H?: number }[]; const l = f.find(x => x.H != null); const h = l?.H ?? -0.707; return ({ answer: `状态每变一点、测量随之变多少(测量对状态的局部线性灵敏度)。本例 H=${h}(负):机器人往右 x↑ 会离地标更近、距离↓,所以斜率为负。它把非线性距离测量翻译成局部线性关系、让卡尔曼公式能用`, step: 3, evidence: 'H=−(L−x̂)/h;符号=往哪动测量怎么变' }) },
        distractors: () => ['测量噪声的大小', '机器人的速度', '卡尔曼增益本身'],
      },
      {
        id: 'ekf_trust', label: '测量噪声 R 的作用',
        ask: 'EKF 更新里,测量噪声 R 变大变小对卡尔曼增益 K 和结果有什么影响?', kind: 'choice',
        compute: () => ({ answer: 'R 小(信测量)→ K 大、状态被测量拉得多、方差 P 收得狠;R 大(信测量糙)→ K 小、状态几乎不动、更信预测、P 收得少。这和线性卡尔曼一个道理', step: 4, evidence: 'K=PH/(H²P+R);R↑则 K↓' }),
        distractors: () => ['R 只影响预测步、不影响更新', 'R 越大 K 越大、越信测量', 'R 和 K 无关'],
      },
      {
        id: 'ekf_fail', label: 'EKF 什么时候失效',
        ask: 'EKF 什么时候会失效?有哪些替代?', kind: 'choice',
        compute: () => ({ answer: 'EKF 只做一阶线性化,若非线性很强、或估计点离真值远,线性化误差会让协方差失真甚至发散。替代:UKF(无迹卡尔曼,传 sigma 点过非线性、不求雅可比、对强非线性更准);粒子滤波(采样、能表多峰/非高斯,如全局定位绑架问题)', step: 5, evidence: '一阶线性化的局限;UKF/粒子滤波各补一块' }),
        distractors: () => ['EKF 永不失效、总是最优', '只在测量噪声大时失效、加大 R 即可', '失效时改用线性卡尔曼'],
      },
      {
        id: 'ekf_hpred', label: '预测测量距离',
        ask: '机器人估计在 x=5、地标在(10,5)，EKF 算的预测测量 h(x̂)=√((10−5)²+5²) 约为多少?(取整)', kind: 'number',
        compute: t => { const f = t as unknown as { hPred?: number }[]; const l = f.find(x => x.hPred != null); const v = l?.hPred != null ? Math.round(l.hPred) : 7; return ({ answer: String(v), step: 2, evidence: `h=√(25+25)=√50≈7.07≈${v};创新 y=z−h=8−7.07=0.93` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'kalman', title: '卡尔曼滤波', kernel: kalmanKernel as Kernel<unknown>, doc: trivialDoc('kalman'),
    facts: [
      {
        id: 'predict_update', label: '卡尔曼的两拍：预测涨、校正缩',
        ask: '卡尔曼滤波每步 predict 和 update 两拍，位置估计的不确定度(方差 P)分别怎么变、为什么?', kind: 'choice',
        compute: () => ({ answer: 'Predict 用运动模型前推(x\'=x+u)，推得越久越不确定 → 方差涨 P\'=P+Q；Update 用观测校正，观测带来新信息 → 方差缩 P=(1−K)P\'。所以 P 呈锯齿、收敛到稳态', step: 1, evidence: '本例 P: 1→predict 1.5→update 0.6→predict 1.1→update 0.524…收敛~0.5' }),
        distractors: () => ['predict 和 update 都让方差变小', '方差一直不变', 'predict 缩、update 涨'],
      },
      {
        id: 'kalman_gain', label: '卡尔曼增益 K 是什么权重',
        ask: '卡尔曼增益 K=P\'/(P\'+R) 决定什么？什么时候更信 GPS 观测、什么时候更信运动预测?', kind: 'choice',
        compute: () => ({ answer: 'K 是"信预测还是信观测"的权重：x=x\'+K(z−x\')。观测噪声 R 小(GPS 准)→K 大→多信观测；预测方差 P\' 小(预测准)→K 小→多信预测。融合估计比单独任一个都准', step: 8, evidence: '本例 R=1，K 从 0.6 收敛到 ~0.5；估计一路贴真值(误差≤0.13)' }),
        distractors: () => ['K 是固定常数、与方差无关', 'K 越大越好、永远多信观测', 'K 只和步数有关'],
      },
    ],
  },
  {
    id: 'lerobot', title: 'LeRobot × SO-101 开源实战', kernel: lerobotKernel as Kernel<unknown>, doc: trivialDoc('lerobot'),
    facts: [
      {
        id: 'lerobot_pipeline', label: 'SO-101+LeRobot 自主抓取的全链路',
        ask: '用 SO-101 机械臂 + LeRobot 做一个会自主抓取的策略，要走哪几步？训练数据从哪来?', kind: 'choice',
        compute: () => ({ answer: '模仿学习全链路：装配标定→手推 leader 臂遥操 follower、用 lerobot-record 录≥50 段示范(相机+关节+动作)→lerobot-train 训一个策略(默认 ACT 动作分块 Transformer)→lerobot-rollout 部署让 follower 臂自主执行。训练数据来自你自己遥操作采集的示范', step: 8, evidence: '本例走完 硬件→装配标定→采集→训练ACT→部署抓取 全链路，含真实 CLI 命令' }),
        distractors: () => ['训练数据从网上下载现成的，不用自己采', '手写规则程序控制、不用学习', '只需要一条臂、不用 leader/follower'],
      },
      {
        id: 'so101_hardware', label: 'SO-101 硬件与主从臂',
        ask: 'SO-101 机械臂的 leader 和 follower 两条臂各是干什么的？它有几个自由度?', kind: 'choice',
        compute: () => ({ answer: 'follower(从臂)真干活、执行任务；leader(主臂)当你手里的遥操作手柄(用不同减速比让你轻松推动)，你推 leader、follower 跟随来采集示范。6 颗 STS3215 舵机、6 关节=5 自由度+夹爪', step: 1, evidence: 'SO-101：5 自由度+夹爪、6 舵机、leader/follower 主从两条臂' }),
        distractors: () => ['leader 和 follower 是两个独立机器人、各干各的', '只有一条臂、没有主从之分', 'leader 负责计算、follower 负责供电'],
      },
    ],
  },
  {
    id: 'vla', title: 'VLA 视觉-语言-动作', kernel: vlaKernel as Kernel<unknown>, doc: trivialDoc('vla'),
    facts: [
      {
        id: 'vla_action_token', label: 'VLA 怎么让大模型"说出"动作',
        ask: 'RT-2 这类 VLA 怎么让视觉-语言大模型输出连续的机器人动作?', kind: 'choice',
        compute: () => ({ answer: '动作 token 化：把连续动作(Δx/Δy/Δz/夹爪)每一维按范围离散成 256 个格子、每格=一个 token id，动作就变成一串"词"；大模型像预测下一个单词一样自回归吐出这串动作 token，机器人端再反 token 化回连续位姿执行。动作和语言共用词表', step: 3, evidence: '本例 Δpose→动作 token [204,96,77,255]，反解误差≈0' }),
        distractors: () => ['大模型直接输出电机电压', '动作由另一个独立规则程序算', '每个动作硬编码成一个固定指令'],
      },
      {
        id: 'vla_generalize', label: 'VLA 为什么能泛化',
        ask: 'VLA 能听懂机器人示范数据里从没出现过的物体/指令(如"拿起紫色的杯子")，为什么?', kind: 'choice',
        compute: () => ({ answer: '骨干是在海量网络图文上预训练的视觉-语言大模型，早就见过无数紫色的、无数杯子、懂各种概念和语言——这份世界知识让它能把没在机器人数据里出现过的新概念直接接到动作上。从零训练的策略没有这份知识就做不到', step: 5, evidence: '本例换成没训过的"紫色的杯子"，靠骨干网络知识仍能理解并伸手去拿' }),
        distractors: () => ['因为机器人数据其实覆盖了所有物体', '因为动作 token 化', '靠随机试探碰运气'],
      },
    ],
  },
  {
    id: 'diffpolicy', title: 'Diffusion Policy', kernel: diffpolicyKernel as Kernel<unknown>, doc: trivialDoc('diffpolicy'),
    facts: [
      {
        id: 'bc_multimodal', label: 'BC 为什么把多解平均成撞',
        ask: '绕障碍向左或向右都对，为什么行为克隆(BC)会预测"直行"撞上去?', kind: 'choice',
        compute: () => ({ answer: 'BC 是回归、只输出一个动作，训练最小化均方误差→最优单点预测就是均值。左(−1)和右(+1)平均=0(直行)→正好撞障碍。这是"回归求均值"的结构缺陷，加大网络也没用', step: 1, evidence: '本例双峰动作 ±1，BC 均值落在 0(直行撞)' }),
        distractors: () => ['BC 训练不够', '专家示范里没有绕障数据', 'BC 网络太小'],
      },
      {
        id: 'diffusion_multimodal', label: 'Diffusion Policy 怎么治多峰',
        ask: 'Diffusion Policy 怎么解决 BC 把多峰动作平均成错解的问题?', kind: 'choice',
        compute: () => ({ answer: '换成生成模型：不预测单个动作，而是建整个动作分布(可多峰)，从随机噪声沿学到的能量/分数去噪采样，落到某一个模态而非平均。不同噪声→不同模态，都是有效解', step: 6, evidence: '本例两个噪声种子去噪分别收敛到 +0.99(右绕)/−0.99(左绕)，BC 却给 0(撞)' }),
        distractors: () => ['给 BC 加更多层', '把左右两个动作都执行', '只保留一个方向的示范'],
      },
    ],
  },
  {
    id: 'bc', title: '模仿学习 · 行为克隆', kernel: bcKernel as Kernel<unknown>, doc: trivialDoc('bc'),
    facts: [
      {
        id: 'bc_what', label: '行为克隆 BC 是什么',
        ask: '模仿学习里的"行为克隆(BC)"是怎么让机器人学技能的?', kind: 'choice',
        compute: () => ({ answer: '收集专家示范(状态→动作的数据对)，用监督学习把"状态→动作"当回归/分类拟合出一个策略。简单、可扩展，是 VLA 的训练基石', step: 0, evidence: '本例专家在中线附近示范状态→动作，BC 拟合它' }),
        distractors: () => ['让机器人自己试错、拿奖励强化(那是强化学习)', '手写 if-else 规则', '让机器人随机探索'],
      },
      {
        id: 'bc_compound', label: 'BC 的致命伤：复合误差',
        ask: 'BC 有个著名的致命伤，会让小误差滚成大祸(如开车冲出车道)，它是什么、根因是什么?', kind: 'choice',
        compute: () => ({ answer: '分布漂移/复合误差：BC 只在专家示范过的状态学得好，自己的小误差把它带到没示范过的状态→欠修正→漂更远→错上加错(代价 O(εT²))。根因是训练分布≠测试时自己走出的分布', step: 6, evidence: '本例专家稳在 0.66(道内)，BC 漂出示范区(0.5)后复合误差冲到 1.76(出车道)' }),
        distractors: () => ['网络太小、拟合能力不够', '专家示范数据有噪声', 'BC 学习率设太大'],
      },
    ],
  },
  {
    id: 'mpc', title: 'MPC 模型预测控制', kernel: mpcKernel as Kernel<unknown>, doc: trivialDoc('mpc'),
    facts: [
      {
        id: 'mpc_predict', label: 'MPC 和 PID 的本质区别',
        ask: 'MPC(模型预测控制)和 PID/阻抗这类反应式控制，本质区别是什么?', kind: 'choice',
        compute: () => ({ answer: 'MPC 会往前看：每步用模型预测未来一段、优化整条控制序列(跟踪+约束+省劲)、只执行第一步、下步重规划(滚动时域)。PID/阻抗只看当前误差反应、没有预测', step: 7, evidence: '本例 MPC 预测刹车距离→提前刹车停在 9.94；反应式无预测冲过目标到 15.98' }),
        distractors: () => ['MPC 用的力更大', 'MPC 是 PID 加了积分项', '两者没本质区别、只是参数不同'],
      },
      {
        id: 'mpc_constraint', label: 'MPC 怎么提前刹车不越界',
        ask: '质量块要停在目标(墙)，MPC 靠什么做到提前刹车、不冲过去?', kind: 'choice',
        compute: () => ({ answer: '每步预测"照现在速度刹停还要多远"(刹车距离)=预测停点；一旦预测停点够到目标就提前刹车，否则加速。这就是用预测显式满足"不越界"约束——反应式做不到', step: 5, evidence: '本例 MPC 在预测停点将超过目标时切换到刹车(u=-1)，稳稳停在 9.94' }),
        distractors: () => ['等撞到墙才反应', '把目标设得更近一点', '靠运气、多试几次'],
      },
    ],
  },
  {
    id: 'impedance', title: '阻抗 / 力控', kernel: impedanceKernel as Kernel<unknown>, doc: trivialDoc('impedance'),
    facts: [
      {
        id: 'why_not_position', label: '接触任务为什么不能只用位置控制',
        ask: '机械臂做装配/打磨等接触任务，为什么纯位置控制会砸坏工件?', kind: 'choice',
        compute: () => ({ answer: '位置控制很刚：为把位置误差压到 0 会死命顶。命令去墙后面的目标时，剩下的位置误差消不掉，就输出巨大接触力去顶——砸坏工件、伤人。它不知道该松手', step: 1, evidence: '本例命令去 x=8、墙在 x=5，位置控制硬顶出 480N' }),
        distractors: () => ['位置控制会停在墙前不动', '位置控制会自动绕过墙', '位置控制接触力太小、夹不住'],
      },
      {
        id: 'impedance_spring', label: '阻抗控制怎么柔顺、怎么调接触力',
        ask: '阻抗控制让机械臂柔顺接触，它把末端表现成什么？接触力怎么调?', kind: 'choice',
        compute: () => ({ answer: '让末端表现得像虚拟弹簧+阻尼 F=K(x目标−x)−D·ẋ，遇阻柔顺让步而非硬顶。接触力≈K×侵入深度，K(刚度)是你设的旋钮：软(小K)→轻贴、吸冲击、对人安全；硬(大K)→接近位置控制', step: 7, evidence: '本例阻抗控制(K=25)接触力 settle 到 ~73N，比刚性 480N 柔和 6.6 倍' }),
        distractors: () => ['让末端完全不动', '把电机关掉靠惯性', '接触力是固定的、不能调'],
      },
    ],
  },
  {
    id: 'pid', title: 'PID 控制', kernel: pidKernel as Kernel<unknown>, doc: trivialDoc('pid'),
    facts: [
      {
        id: 'p_oscillate', label: '纯 P 为什么震荡',
        ask: '用纯比例(P)控制一个质量块到目标位置，为什么会冲过头、来回震荡?', kind: 'choice',
        compute: () => ({ answer: '质量块是双积分、没有天然阻尼：纯 P 把它推向目标，但到目标时还有速度、刹不住 → 冲过头 → 反向 → 来回震荡。必须加 D(微分)提供阻尼才能停住', step: 5, evidence: '本例纯 P(Kp=0.4)第5步冲到 11.77(过目标10)还在涨' }),
        distractors: () => ['Kp 太小，调大就不震荡了', '质量块自己会震荡、和控制无关', '因为没有用积分 I'],
      },
      {
        id: 'pid_terms', label: 'PID 三项各管什么',
        ask: 'PID 控制的 P、I、D 三项分别按什么量、起什么作用?', kind: 'choice',
        compute: () => ({ answer: 'P=Kp·e 按当前误差使劲(越远越使劲)；D=Kd·误差变化率提供阻尼(快到时反向刹车、防冲过头);I=Ki·误差累计消除稳态误差(顶掉重力等恒定扰动)。P管现在、I管过去累计、D管趋势', step: 14, evidence: '本例加 D=Kd·误差变化率(负=刹车)后，位置平稳收敛到目标不震荡' }),
        distractors: () => ['三项都按当前误差，只是系数不同', 'D 让响应更快、P 提供阻尼', 'I 提供阻尼、D 消除稳态误差'],
      },
    ],
  },
  {
    id: 'ppo', title: 'PPO 近端策略优化', kernel: ppoKernel as Kernel<unknown>, doc: trivialDoc('ppo'),
    facts: [
      {
        id: 'ppo_clip', label: 'PPO 的裁剪目标起什么作用',
        ask: 'PPO 的裁剪替代目标 min(r·A, clip(r,1−ε,1+ε)·A) 起什么作用?', kind: 'choice',
        compute: () => ({ answer: '把每次更新限在信任域、防策略崩:重要性比 r=π_new/π_old 差出 ε(超 [1−ε,1+ε])就被裁剪、目标封顶、梯度=0,优化器得不到继续推大 r 的动力。用一行 min/clip 实现信任域、比 TRPO 简单得多', step: 3, evidence: 'r 差出 ε 就无梯度=信任域;防一步迈太大崩' }),
        distractors: () => ['让训练跑得更快', '把连续动作变成离散动作', '替代掉奖励函数'],
      },
      {
        id: 'ppo_ratio', label: '重要性比 r 是什么',
        ask: 'PPO 里的重要性比 r 是什么?衡量什么?', kind: 'choice',
        compute: () => ({ answer: 'r=π_θ(a|s)/π_θ_old(a|s):新策略给这个动作的概率÷旧策略的。r=1 表示没变、r>1 新策略更偏爱、r<1 更嫌弃。它衡量新策略离旧策略走了多远,PPO 就是盯住它别离 1 太远', step: 1, evidence: 'r=新/旧策略概率比;r=1 没变' }),
        distractors: () => ['r 是学习率', 'r 是折扣因子', 'r 是奖励与基线的比'],
      },
      {
        id: 'ppo_why', label: 'PPO 为何成主力',
        ask: 'PPO 相比 REINFORCE / TRPO 为什么成了主力?', kind: 'choice',
        compute: () => ({ answer: '比 TRPO(复杂的二阶信任域)简单得多、效果相当;比 REINFORCE 稳、超参不敏感,而且裁剪限制了更新幅度、同一批数据可跑多个 epoch(样本效率更高、不像 REINFORCE 用完即扔)。配 actor-critic+GAE 算优势', step: 5, evidence: '简单+稳+可多epoch复用batch' }),
        distractors: () => ['因为它是 off-policy、能复用所有旧数据', '因为它不需要优势函数', '因为它只能用于离散动作'],
      },
      {
        id: 'ppo_miniduck', label: 'PPO 和 miniduck 的关系',
        ask: 'PPO 和 miniduck(Open Duck Mini)是什么关系?', kind: 'choice',
        compute: () => ({ answer: 'miniduck 用 Brax PPO 在 MuJoCo 里学走路:动作是连续的关节位置残差,PPO 的优势里就是那套 velocity tracking + imitation(相位参考步态)奖励。PPO 是它的训练算法', step: 5, evidence: 'miniduck=Brax PPO 学腿式locomotion;连续关节残差' }),
        distractors: () => ['无关、miniduck 用模仿学习', 'miniduck 用值迭代', 'PPO 只能用于机械臂不能用于腿'],
      },
      {
        id: 'ppo_num', label: '大步的裁剪目标',
        ask: 'A=+1、ε=0.2，新策略把重要性比推到 r=1.5，裁剪目标 L^clip=min(r·A, clip(r,0.8,1.2)·A) 是多少?', kind: 'number',
        compute: t => { const f = t as unknown as { Lclip?: number; clipped?: boolean }[]; const l = f.find(x => x.clipped) ?? f[f.length - 1] as unknown as { Lclip?: number }; const v = l?.Lclip != null ? Math.round(l.Lclip * 10) / 10 : 1.2; return ({ answer: String(v), step: 3, evidence: `clip(1.5,0.8,1.2)=1.2、L^clip=min(1.5·1, 1.2·1)=${v}(被封在 1.2、超出 1+ε 无梯度)` }) },
        distractors: () => ['1.5', '1.0', '0.8', '2.0'],
      },
    ],
  },
  {
    id: 'policygrad', title: '策略梯度 REINFORCE', kernel: policygradKernel as Kernel<unknown>, doc: trivialDoc('policygrad'),
    facts: [
      {
        id: 'pg_theorem', label: '策略梯度在做什么',
        ask: '策略梯度(policy gradient)和值方法(Q-learning)最本质的区别?策略梯度定理直觉是什么?', kind: 'choice',
        compute: () => ({ answer: '值方法先学值 Q 再 argmax;策略梯度直接参数化策略 π_θ、对期望回报梯度上升。策略梯度定理 ∇J=E[∇log π·G]:把导致高回报 G 的动作、概率往上推。天然处理连续动作(值方法难对无穷动作 argmax)', step: 1, evidence: '直接学策略;∇log π·G 推高好动作' }),
        distractors: () => ['策略梯度也是先学 Q 再选动作', '策略梯度不需要奖励', '策略梯度只能处理离散动作'],
      },
      {
        id: 'pg_baseline', label: '基线/优势为何降方差',
        ask: '策略梯度里减去基线(用优势 A=G−b 代替回报 G)为什么重要?', kind: 'choice',
        compute: () => ({ answer: '降方差、且能正确压制低于平均的动作。纯回报 G 全是正的、任何被采到的动作都被推高(方差大、方向常错);减基线后用优势 A=G−b:A>0(高于平均)才推高、A<0(低于平均)压低。减基线不改变梯度期望(不引偏)、只降方差', step: 4, evidence: 'A=G−b;比平均好才强化;不引偏只降方差' }),
        distractors: () => ['加快计算', '让回报变成整数', '把 on-policy 变 off-policy'],
      },
      {
        id: 'pg_ac', label: '基线引向什么',
        ask: '把基线做成一个学出来的 V(s)，策略梯度就变成了什么?', kind: 'choice',
        compute: () => ({ answer: 'actor-critic:actor 是策略 π_θ、critic 学值 V(s) 当基线,用优势 A=G−V(s)(或 TD 优势)更新 actor。PPO、SAC 都是 actor-critic 的变体', step: 5, evidence: 'actor=策略、critic=V 基线;PPO/SAC 是其变体' }),
        distractors: () => ['Q-learning', '值迭代', '蒙特卡洛树搜索'],
      },
      {
        id: 'pg_onpolicy', label: '为何 on-policy 且要 PPO',
        ask: 'REINFORCE 是 on-policy 还是 off-policy?它有什么痛点、怎么解决?', kind: 'choice',
        compute: () => ({ answer: 'on-policy:必须用当前策略采的数据更新、用完即扔(样本效率低)。痛点是更新步子难调:太大一步可能把策略更新崩坏、太小又慢。PPO 用裁剪的替代目标把每次更新限制在信任域(新旧策略别差太多),稳且样本利用更好(miniduck 用的就是 PPO)', step: 5, evidence: 'on-policy;步子难调→PPO 裁剪限信任域' }),
        distractors: () => ['off-policy、可复用旧数据', '没有痛点、直接可用', '用更大的学习率就行'],
      },
      {
        id: 'pg_num', label: '较差动作的优势',
        ask: '单状态 2 动作(L 回报1、R 回报3、初始 π=[0.5,0.5])，采到 L；基线 b=Σπ·R，优势 A=G−b 是多少?', kind: 'number',
        compute: t => { const f = t as unknown as { adv?: number }[]; const l = f.find(x => x.adv != null); const v = l?.adv != null ? Math.round(l.adv) : -1; return ({ answer: String(v), step: 3, evidence: `b=0.5·1+0.5·3=2、A=G−b=1−2=${v}<0(L 低于平均、该压低)` }) },
        distractors: () => ['1', '2', '0', '3'],
      },
    ],
  },
  {
    id: 'qlearning', title: 'Q-learning · 免模型', kernel: qlearningKernel as Kernel<unknown>, doc: trivialDoc('qlearning'),
    facts: [
      {
        id: 'ql_modelfree', label: 'Q-learning 和值迭代的区别',
        ask: 'Q-learning 和 MDP 值迭代最本质的区别是什么?', kind: 'choice',
        compute: () => ({ answer: 'Q-learning 免模型:什么模型都不知道、只从和环境交互得到的经验元组 (s,a,r,s\') 学动作值 Q(s,a);值迭代要知道转移 P 和奖励 R(有模型)。真实机器人 P/R 常未知,所以要免模型', step: 1, evidence: '免模型(经验)vs 有模型(要 P/R)' }),
        distractors: () => ['Q-learning 更快、值迭代更准', 'Q-learning 不用折扣 γ', 'Q-learning 学 V、值迭代学 Q'],
      },
      {
        id: 'ql_td', label: 'TD 更新在做什么',
        ask: 'Q-learning 的 TD 更新 Q←Q+α[r+γmax Q(s\')−Q] 在做什么?', kind: 'choice',
        compute: () => ({ answer: '方括号是 TD 误差 δ=(即时奖励+折扣后对未来的估计 γmax Q(s\'))−(当前估计 Q(s,a)),用它按学习率 α 修正 Q。自举(bootstrapping):用当前对未来的估计更新自己、走一步更一次(不用等回合结束)', step: 2, evidence: 'δ=目标−当前;自举、在线更新' }),
        distractors: () => ['等整局结束后统计平均回报', '直接把 Q 设成奖励 r', '随机扰动 Q'],
      },
      {
        id: 'ql_offpolicy', label: 'off-policy 与探索',
        ask: 'Q-learning 为什么叫 off-policy?为什么需要探索?', kind: 'choice',
        compute: () => ({ answer: 'off-policy:更新用 max(目标策略是贪心)、但行为可以带探索(行为策略 ε-greedy)——学的策略和执行的策略可以不一样。需要探索是因为:要学到最优必须走遍各状态动作,只贪心会错过没试过的好动作(探索 vs 利用)', step: 5, evidence: '更新用max、行为带ε-greedy;探索走遍' }),
        distractors: () => ['off-policy 指不用奖励', '探索是为了跑得快', 'on-policy 和 off-policy 完全一样'],
      },
      {
        id: 'ql_converge', label: 'Q-learning 收敛到哪',
        ask: 'Q-learning 多回合后收敛到什么?说明了什么?', kind: 'choice',
        compute: () => ({ answer: '收敛到和值迭代完全一样的最优 Q*(本例 [0.81,0.9,1]=γ^步数·1)。说明:免模型、只靠经验试错,也能学到和有模型值迭代一样的最优值。α 只影响速度不影响收敛点(大快但抖、小慢但稳)', step: 4, evidence: '收敛=值迭代 V*;免模型学到同解' }),
        distractors: () => ['收敛到 0', '收敛到比值迭代差的次优', '不会收敛、一直震荡'],
      },
      {
        id: 'ql_num', label: 'C→G 的 TD 误差',
        ask: 'Q 全 0、经验 (C,→,r=1,G)、γ=0.9，这次 TD 误差 δ=r+γ·max Q(G)−Q(C,→) 是多少?', kind: 'number',
        compute: t => { const f = t as unknown as { td?: { delta: number } }[]; const l = f.find(x => x.td); const v = l?.td?.delta ?? 1; return ({ answer: String(v), step: 2, evidence: `δ=1+0.9·0−0=${v}(Q 全 0、只有即时奖励 r=1);Q(C,→)←α·δ` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'mdp', title: 'MDP · 贝尔曼值迭代', kernel: mdpKernel as Kernel<unknown>, doc: trivialDoc('mdp'),
    facts: [
      {
        id: 'mdp_bellman', label: '贝尔曼最优方程在说什么',
        ask: '贝尔曼最优方程 V*(s)=max_a[R+γV*(s\')] 在说什么?', kind: 'choice',
        compute: () => ({ answer: '一个状态的值=选最好的动作、拿到即时奖励 R + 折扣 γ 后的下一个状态的值。它是递归的(自己的值用邻居的值定义),表达"最优地走下去能拿多少折扣回报"', step: 3, evidence: 'V=即时奖励+折扣未来值;取 max 动作' }),
        distractors: () => ['一个状态的值=所有动作奖励的平均', '一个状态的值=离目标的欧氏距离', '一个状态的值=转移概率之和'],
      },
      {
        id: 'mdp_valueiter', label: '值迭代怎么收敛',
        ask: '值迭代是怎么求出最优值的?值怎么传播?', kind: 'choice',
        compute: () => ({ answer: '反复做贝尔曼备份 V_{k+1}(s)=max_a[R+γV_k(s\')] 直到不再变。值像水波从目标状态往回扩散:第1次紧挨目标的状态变、第2次再往回一格……每扫一次信息往回传一格,收敛后 argmax 得最优策略', step: 4, evidence: '值从目标往回传;iter1 C=1、iter2 B=γ、iter3 A=γ²' }),
        distractors: () => ['从起点往目标正向传播', '一次扫描就得到最优', '随机更新直到稳定'],
      },
      {
        id: 'mdp_gamma', label: '折扣 γ 的作用',
        ask: 'MDP 里的折扣 γ 是干什么的?γ 大和小有什么区别?', kind: 'choice',
        compute: () => ({ answer: 'γ∈[0,1) 折扣未来奖励(累积回报 Σγ^t r_t),让近期奖励更值钱、也保证无穷步和收敛。γ 越大越远视(远处奖励也看重、本例 A=γ²=0.81)、越小越短视(只顾眼前、γ=0.5 时 A 只值 0.25)', step: 5, evidence: 'V=γ^步数·奖励;γ 大远视、小短视' }),
        distractors: () => ['γ 是学习率、控制更新快慢', 'γ 是探索率', 'γ 只是防止除零'],
      },
      {
        id: 'mdp_vq', label: 'V 和 Q 的区别',
        ask: '值函数 V(s) 和 Q(s,a) 有什么区别?为什么 Q 更常用?', kind: 'choice',
        compute: () => ({ answer: 'V(s)是状态值、Q(s,a)是状态-动作值(在 s 做 a、之后最优的回报)。Q 更常用:argmax_a Q(s,a) 直接给出策略、不需要转移模型 P;用 V 选动作还得知道 P 才能算下个状态', step: 5, evidence: 'Q 选动作免模型;V 选动作要 P' }),
        distractors: () => ['V 和 Q 完全等价', 'V 是动作值、Q 是状态值', 'Q 只用于有模型情形'],
      },
      {
        id: 'mdp_num', label: 'A 状态的最优值',
        ask: '4 状态链 A→B→C→G、C→G 得 +1、γ=0.9，值迭代收敛后 V*(A) 约为多少?(两位小数)', kind: 'number',
        compute: t => { const f = t as unknown as { vFinal?: Record<string, number> }[]; const l = f.find(x => x.vFinal && x.vFinal.A); const v = l?.vFinal?.A != null ? Math.round(l.vFinal.A * 100) / 100 : 0.81; return ({ answer: String(v), step: 5, evidence: `A 离 G 有 3 步、V(A)=γ³?不,C→G才有奖励:V(A)=γ²·1=0.9²=${v}(A→B→C 两步折扣、C 拿 +1)` }) },
        distractors: () => ['0.9', '1.0', '0.5', '0.25'],
      },
    ],
  },
  {
    id: 'prm', title: 'PRM 概率路图', kernel: prmKernel as Kernel<unknown>, doc: trivialDoc('prm'),
    facts: [
      {
        id: 'prm_vs_rrt', label: 'PRM 和 RRT 的区别',
        ask: 'PRM 和 RRT 最本质的区别是什么?', kind: 'choice',
        compute: () => ({ answer: 'PRM 多查询:先建一张覆盖自由空间的路图、之后每次查询只在图上搜(建一次答多次、适合固定环境反复规划);RRT 单查询:每次朝一个目标从头长一棵树、用完即弃(增量、适合一次性/高维)。都概率完备', step: 1, evidence: '多查询(建路图)vs 单查询(长树)' }),
        distractors: () => ['PRM 更快、RRT 更准', 'PRM 不需要碰撞检测', 'PRM 是最优的、RRT 不是'],
      },
      {
        id: 'prm_phases', label: 'PRM 的两个阶段',
        ask: 'PRM 的两个阶段分别做什么?', kind: 'choice',
        compute: () => ({ answer: '①建图:自由空间采样节点、每个连 k 近邻、每条边碰撞检测(穿过障碍的丢掉)构成路图;②查询:起点/终点接入路图、用 Dijkstra/A* 在图上搜最短路。建图一次、查询多次', step: 1, evidence: '建图(采样+连边+碰撞检测)+查询(图搜索)' }),
        distractors: () => ['①随机长树 ②回溯路径', '①梯度下降 ②收敛', '①栅格化 ②启发式搜索'],
      },
      {
        id: 'prm_narrow', label: 'PRM 的核心难点',
        ask: 'PRM 最容易出问题的地方是什么?怎么解决?', kind: 'choice',
        compute: () => ({ answer: '窄通道/采样密度:窄通道(两障碍间的缝)采样命中概率极低、路图容易在那里断开、找不到路(不是没路、是没覆盖到)。对策:加采样、窄通道采样(桥采样 bridge sampling/高斯采样)、PRM*', step: 5, evidence: '采样太稀→路图断开;桥采样专补窄缝' }),
        distractors: () => ['计算最短路太慢', '节点太多内存不够', '起点终点没法接入'],
      },
      {
        id: 'prm_collision', label: '碰撞检测为何是瓶颈',
        ask: 'PRM 里最耗时的部分是什么?为什么?', kind: 'choice',
        compute: () => ({ answer: '边的碰撞检测(collision checking):建图时每对候选边都要检测连线是否无碰、节点一多检测次数爆炸,查询接入也要检测。是采样规划共同的瓶颈,工程上用层次包围盒/GJK 加速', step: 2, evidence: '每条候选边都要碰撞检测;节点多则爆炸' }),
        distractors: () => ['随机采样本身', 'Dijkstra 图搜索', '起终点接入'],
      },
      {
        id: 'prm_num', label: 'PRM 找到的最短路长',
        ask: '本例障碍挡住最短的 B-D 边，PRM 绕障碍上方的路径 S-A-C-D-G 总长约为多少?(取整)', kind: 'number',
        compute: t => { const f = t as unknown as { pathLen?: number; connected?: boolean }[]; const l = f.find(x => x.connected && x.pathLen) ?? f[f.length - 1] as unknown as { pathLen?: number }; const v = l?.pathLen != null ? Math.round(l.pathLen) : 9; return ({ answer: String(v), step: 3, evidence: `S-A(2.5)+A-C(2.24)+C-D(2.24)+D-G(2.5)=9.48≈${v};B-D 直连被障碍挡、只能绕上方` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'trapezoid', title: '梯形速度曲线', kernel: trapezoidKernel as Kernel<unknown>, doc: trivialDoc('trapezoid'),
    facts: [
      {
        id: 'trap_what', label: '梯形速度曲线为何时间最优',
        ask: '梯形速度曲线(加速-匀速-减速)为什么在 v_max/a_max 约束下时间最优?', kind: 'choice',
        compute: () => ({ answer: 'bang-bang:全程要么全力加速(+a_max)、要么全力减速(−a_max)、加速度始终取极值,中间尽量以 v_max 匀速。在速度/加速度上限下,任何别的走法都更慢或违反约束,所以它最快', step: 5, evidence: '加速度取极值=bang-bang=时间最优' }),
        distractors: () => ['因为它最平滑', '因为加速度恒为 0', '因为它是三次多项式'],
      },
      {
        id: 'trap_regime', label: '何时退化成三角',
        ask: '梯形速度曲线什么时候退化成三角形?', kind: 'choice',
        compute: t => { const f = t as unknown as { dA?: number }[]; const dA = f.find(x => x.dA != null)?.dA ?? 2; return ({ answer: `距离太短:D < 2·d_a(加速+减速的距离和,本例 2·${dA}=${2 * dA})。还没加到 v_max 就得开始减速、根本达不到 v_max,曲线退化成三角,峰值 v_peak=√(a_max·D)`, step: 2, evidence: `D<2 d_a→三角;v_peak=√(a_max·D)<v_max` }) },
        distractors: () => ['加速度太大时', '速度上限太高时永远是三角', '距离很长时'],
      },
      {
        id: 'trap_time', label: '总时间怎么算',
        ask: '梯形/三角速度曲线的总时间怎么算?', kind: 'choice',
        compute: () => ({ answer: '梯形:T=2·t_a+t_c,t_a=v_max/a_max、匀速段 t_c=(D−2 d_a)/v_max;三角:T=2·√(D/a_max)(没有匀速段)。都是约束下走完 D 的最短时间', step: 4, evidence: '梯形 2 t_a+t_c、三角 2√(D/a_max)' }),
        distractors: () => ['T=D/v_max、匀速走全程', 'T=√(2D/a_max)、全程加速', 'T 和加速度无关'],
      },
      {
        id: 'trap_scurve', label: 'S 曲线比梯形好在哪',
        ask: 'S 曲线相比梯形速度曲线好在哪?代价是什么?', kind: 'choice',
        compute: () => ({ answer: '梯形曲线的加速度是阶跃(瞬间从0跳到a_max)、会激起振动冲击;S 曲线再限制 jerk(加速度的变化率),让加速度也平滑升降→运动更柔、对机械和负载更友好。代价是稍慢、更复杂(七段式)', step: 5, evidence: 'S 曲线限 jerk、抗振;梯形加速度阶跃' }),
        distractors: () => ['S 曲线更快、无任何代价', 'S 曲线不需要 v_max/a_max', 'S 曲线是直线、最简单'],
      },
      {
        id: 'trap_num', label: '长距离总时间',
        ask: '走 D=10m、v_max=2m/s、a_max=1m/s²，梯形速度曲线的总时间 T 是多少?(秒)', kind: 'number',
        compute: t => { const f = t as unknown as { tTotal?: number; isTrap?: boolean }[]; const l = f.find(x => x.isTrap) ?? f[f.length - 1] as unknown as { tTotal?: number }; const v = l?.tTotal != null ? Math.round(l.tTotal) : 7; return ({ answer: String(v), step: 4, evidence: `t_a=2s、d_a=2m、匀速 d_c=10−4=6m、t_c=3s → T=2·2+3=${v}s` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'chomp', title: 'CHOMP 轨迹优化', kernel: chompKernel as Kernel<unknown>, doc: trivialDoc('chomp'),
    facts: [
      {
        id: 'chomp_what', label: 'CHOMP 属于哪一类规划',
        ask: 'CHOMP 属于哪一类运动规划?和 RRT 最大的不同?', kind: 'choice',
        compute: () => ({ answer: '优化式规划:把整条轨迹 ξ=[q_1..q_n] 当变量、定义代价 U=平滑项+避障项、梯度下降 ξ←ξ−α∇U。RRT 是采样式、出的是几何折线还要再平滑;CHOMP 直接产出平滑、避障、可执行的轨迹', step: 1, evidence: '优化整条轨迹 vs 采样长树' }),
        distractors: () => ['采样式、和 RRT 一样随机长树', '搜索式、和 A* 一样栅格搜', '反应式、和势场一样只看眼前'],
      },
      {
        id: 'chomp_grad', label: 'CHOMP 的两个梯度',
        ask: 'CHOMP 代价的梯度有哪两个分量?各干什么?', kind: 'choice',
        compute: () => ({ answer: '避障梯度:把落在障碍影响半径 d0 内的路点沿远离障碍方向推(大小∝d0−dist、越近越猛);平滑梯度:把每个路点拉向左右邻居的中点(Laplacian、∝2q_i−q_{i−1}−q_{i+1}、惩罚急转)。两者合起来梯度下降', step: 3, evidence: '避障推离+平滑拉向邻居中点' }),
        distractors: () => ['一个算速度、一个算加速度', '一个正向、一个反向传播', '只有避障梯度、没有平滑'],
      },
      {
        id: 'chomp_localmin', label: 'CHOMP 的死穴',
        ask: 'CHOMP 有什么死穴?怎么缓解?', kind: 'choice',
        compute: () => ({ answer: '局部极小(和势场一样、梯度下降会卡住、障碍布局刁钻时优化不出可行轨迹)。缓解:从多条不同初始轨迹分别优化取最好,或先用 RRT 出一条可行初值、再用 CHOMP 平滑(全局管能到、优化管好走)', step: 5, evidence: '局部极小;多初值或先RRT出初值' }),
        distractors: () => ['没有死穴、总能找到最优', '计算太慢是唯一问题', '只能用于二维'],
      },
      {
        id: 'chomp_covariant', label: '协变是什么意思',
        ask: 'CHOMP 名字里的"协变(covariant)"指什么?', kind: 'choice',
        compute: () => ({ answer: '用一个度量矩阵 A(编码轨迹平滑度)做更新、而不是朴素欧氏梯度——让更新和轨迹的参数化无关、更稳、避免只有个别路点抖动。是 CHOMP 更新更平顺的关键', step: 5, evidence: '用度量A更新、非欧氏梯度、参数化无关' }),
        distractors: () => ['指轨迹随时间变化', '指多个机器人协同', '指梯度取协方差'],
      },
      {
        id: 'chomp_num', label: '避障优先的梯度大小',
        ask: '避障优先(k_obs=2)、q2 离障碍 0.6、d0=1，避障梯度大小=k_obs·(d0−dist) 是多少?', kind: 'number',
        compute: t => { const f = t as unknown as { gObs?: number[] }[]; const l = f.find(x => x.gObs && (x.gObs[0] !== 0 || x.gObs[1] !== 0)); const mag = l?.gObs ? Math.round(Math.sqrt(l.gObs[0]! ** 2 + l.gObs[1]! ** 2) * 10) / 10 : 0.8; return ({ answer: String(mag), step: 3, evidence: `k_obs·(d0−dist)=2·(1−0.6)=2·0.4=${mag}(把 q2 往下推这么多、离障碍越近推越猛)` }) },
        distractors: () => ['0.4', '0.2', '1.0', '2.0'],
      },
    ],
  },
  {
    id: 'gjk', title: 'GJK 碰撞检测', kernel: gjkKernel as Kernel<unknown>, doc: trivialDoc('gjk'),
    facts: [
      {
        id: 'gjk_core', label: 'GJK 本质在判什么',
        ask: 'GJK 判两个凸形碰没碰,本质上是在判什么?', kind: 'choice',
        compute: () => ({ answer: '原点在不在 Minkowski 差 A⊖B={a−b} 里。有个结论:两凸形相交 ⟺ 原点∈A⊖B(A、B 有公共点 p ⟺ p−p=原点∈A⊖B)。于是"两形碰不碰"变成"一个凸形含不含原点"', step: 1, evidence: '两凸形碰⟺原点∈A⊖B' }),
        distractors: () => ['两形中心的距离小不小', '两形有没有公共顶点', '两形面积谁大'],
      },
      {
        id: 'gjk_support', label: '支撑函数的作用',
        ask: 'GJK 里的支撑函数 support(d) 是什么?为什么它让 GJK 高效?', kind: 'choice',
        compute: () => ({ answer: 'support(shape,d)=沿方向 d 最远的顶点;A⊖B 在 d 上的最远点 a=support_A(d)−support_B(−d)。GJK 不显式构造整个 A⊖B(可能很大),每轮只朝一个方向要一个最远点、懒惰地围原点建单纯形,所以对任意凸形都快', step: 2, evidence: '朝一个方向要最远点、不建整个差集' }),
        distractors: () => ['两形所有顶点两两求差、建出完整 A⊖B', '沿方向 d 最近的顶点', '形状的质心'],
      },
      {
        id: 'gjk_exit', label: '不碰怎么提前判定',
        ask: 'GJK 怎么在两形不碰时提前退出(不必建完整个差集)?', kind: 'choice',
        compute: () => ({ answer: '每轮取支撑点 a 后判 a·d:若 a·d<0,说明沿当前方向(指向原点)"最远"都没越过原点 → 原点在 A⊖B 之外 → 两形不碰,立刻返回。这个提前退出是 GJK 高效的关键', step: 4, evidence: 'a·d<0→最远没越过原点→不碰、停' }),
        distractors: () => ['单纯形凑够三个点还没含原点就停', '迭代固定 10 轮后停', '两形距离大于阈值就停'],
      },
      {
        id: 'gjk_epa', label: '穿透深度怎么求',
        ask: 'GJK 判出"碰了",还想知道"穿透多深/最小把它们分开要推多远",怎么办?', kind: 'choice',
        compute: () => ({ answer: '接 EPA(Expanding Polytope Algorithm):从 GJK 结束时那个含原点的单纯形出发、朝表面不断加支撑点把多面体往外扩,逼近 A⊖B 的边界,求出原点到边界的最近距离=穿透深度、方向=最小平移向量(MTV)', step: 5, evidence: 'EPA 从含原点单纯形往外扩、求穿透深度/MTV' }),
        distractors: () => ['GJK 自己就直接给出穿透深度', '再跑一次 GJK 交换 A、B', '穿透深度无法计算'],
      },
      {
        id: 'gjk_num', label: '不碰时的 a·d',
        ask: '分离场景第 2 轮朝 d=[72,0] 取支撑点 a=[-2,-1]，a·d 是多少?(<0 即判不碰)', kind: 'number',
        compute: t => { const f = t as unknown as { stage?: string; passed?: boolean; adot?: number }[]; const l = f.find(x => x.stage === 'support' && x.passed === false); const v = l?.adot ?? -144; return ({ answer: String(v), step: 4, evidence: `a·d=(-2)·72+(-1)·0=${v}<0 → 沿 d 最远都没越过原点 → 不碰` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'dubins', title: 'Dubins 曲线', kernel: dubinsKernel as Kernel<unknown>, doc: trivialDoc('dubins'),
    facts: [
      {
        id: 'du_shape', label: 'Dubins 最短路的形状',
        ask: 'Dubins 曲线说,只能前进、有最小转弯半径的车,两位姿间最短路是什么形状?', kind: 'choice',
        compute: () => ({ answer: '三段拼成、且只可能是 6 种"词"之一:CSC(转-直-转)LSL/RSR/LSR/RSL、CCC(转-转-转)RLR/LRL。L=左转弧、R=右转弧、S=直线,圆弧半径都=最小转弯半径 R。每种词闭式算三段、取最短', step: 1, evidence: '三段、6 种词(CSC+CCC)取最短' }),
        distractors: () => ['总是一条直线', '任意光滑曲线都行', '一段圆弧'],
      },
      {
        id: 'du_why', label: '为什么要用 Dubins',
        ask: '给车式/差速机器人规划,为什么不能像质点那样两点连直线?', kind: 'choice',
        compute: () => ({ answer: '车有非完整约束(不能横着走)和最小转弯半径,直线要求任意方向瞬移、车根本拐不过来。所以两个位姿之间要用 Dubins(只前进)或 Reeds-Shepp(可倒车)这种满足转弯半径的曲线来连', step: 1, evidence: '非完整+最小转弯半径、直线拐不过来' }),
        distractors: () => ['直线太短、绕远反而快', '质点和车没区别、只是习惯', '直线会撞障碍'],
      },
      {
        id: 'du_pose', label: '最优词由什么决定',
        ask: '本例起点终点位置不变,只把终点朝向从朝上换成朝下,最优的 Dubins 词发生了什么?', kind: 'choice',
        compute: () => ({ answer: '从 LSL(3.807)变成了 LSR(5.712)。说明最优词由位姿(尤其朝向)决定、不只看位置——Dubins 把 (起点朝向α、终点朝向β、距离d) 参数空间划分成若干区域、每块对应一种最优词', step: 4, evidence: '朝上→LSL、朝下→LSR;最优词由位姿定' }),
        distractors: () => ['最优词不变、还是 LSL', '变成一条直线 S', '两种朝向长度一样'],
      },
      {
        id: 'du_rs', label: 'Reeds-Shepp 的区别',
        ask: 'Reeds-Shepp 曲线和 Dubins 曲线最主要的区别是什么?', kind: 'choice',
        compute: () => ({ answer: 'Reeds-Shepp 允许车倒车(有前进也有后退段),是 Dubins(只前进)的推广、词的种类更多(含后退共 48 种情形)。停车、狭窄空间掉头等需要倒车的场景用 Reeds-Shepp;只前进的场景用 Dubins', step: 5, evidence: 'Reeds-Shepp 可倒车、Dubins 只前进' }),
        distractors: () => ['Reeds-Shepp 不需要最小转弯半径', 'Reeds-Shepp 用于机械臂、Dubins 用于车', '两者完全一样、只是名字不同'],
      },
      {
        id: 'du_num', label: '最短总长',
        ask: '起点(0,0,0°)、终点(3,2,90°)、最小转弯半径 R=1，最优 LSL 的总长是多少?(保留三位)', kind: 'number',
        compute: t => { const f = t as unknown as { bestType?: string; len?: number }[]; const l = f.find(x => x.bestType === 'LSL' && x.len != null); const v = l?.len ?? 3.807; return ({ answer: String(v), step: 4, evidence: `LSL=左转0.464+直2.236+左转1.107=${v}(四种 CSC 里最短)` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'potentialfield', title: '人工势场法', kernel: potentialfieldKernel as Kernel<unknown>, doc: trivialDoc('potentialfield'),
    facts: [
      {
        id: 'pf_how', label: '势场法怎么工作',
        ask: '人工势场法是怎么规划路径的?', kind: 'choice',
        compute: () => ({ answer: '给空间造势能面:目标产生引力 F_att=k_att·(q_goal−q)(拉向目标)、障碍产生斥力 F_rep(仅影响半径 ρ0 内、∝1/ρ²、推离障碍),机器人顺合力 F=F_att+F_rep 梯度下降(往目标去、绕开障碍)。极简、反应式、快', step: 1, evidence: '引力+斥力顺合力下山;不采样不搜图' }),
        distractors: () => ['随机采样长一棵树(那是 RRT)', '在栅格上用启发式搜索(那是 A*)', '枚举所有路径选最短'],
      },
      {
        id: 'pf_localmin', label: '势场法的死穴',
        ask: '人工势场法最有名的失败模式是什么?为什么?', kind: 'choice',
        compute: () => ({ answer: '局部极小(local minimum):障碍正挡在机器人和目标之间时,引力(朝目标)和斥力(离障碍)共线相反、某处完全抵消→合力≈0→机器人卡在离目标还很远的"假谷"里、到不了。这是势场叠加的拓扑必然、调参救不了', step: 5, evidence: '引力斥力共线相反抵消;本例卡在离目标 5.43' }),
        distractors: () => ['计算太慢、实时跑不动', '会撞上障碍物', '只能走直线'],
      },
      {
        id: 'pf_repulsive', label: '斥力为什么用 1/ρ²',
        ask: '势场斥力 F_rep 里为什么用 1/ρ²、还限定影响半径 ρ0?', kind: 'choice',
        compute: () => ({ answer: '1/ρ² 让越靠近障碍斥力越猛(趋无穷),保证机器人撞不上;限定 ρ≤ρ0(影响半径)是让远处不受障碍影响、只在快撞上时才推,否则每个障碍都全局作用会乱', step: 2, evidence: '越近越猛防撞;超出 ρ0 斥力=0' }),
        distractors: () => ['1/ρ² 只是好算', '影响半径是为了省内存', '斥力和距离无关、是常数'],
      },
      {
        id: 'pf_fix', label: '局部极小怎么救',
        ask: '势场法卡在局部极小，有哪些解法?', kind: 'choice',
        compute: () => ({ answer: '①随机扰动:卡住时给个随机推力跳出;②导航函数:构造保证只有目标一个极小的势场(优雅但难构造);③和全局规划结合(最常用):RRT/A* 出无碰全局路、势场只在附近做局部平滑避障——全局管不卡住、势场管实时反应', step: 5, evidence: '扰动/导航函数/配全局规划(RRT)' }),
        distractors: () => ['加大引力系数就行', '换个初始位置重试', '无解、只能放弃势场法'],
      },
      {
        id: 'pf_num', label: '卡住时离目标多远',
        ask: '障碍正中场景，机器人卡在局部极小(合力≈0)时，离目标大约还有多远?(取整)', kind: 'number',
        compute: t => { const f = t as unknown as { distToGoal?: number; stuck?: boolean }[]; const l = f.find(x => x.stuck) ?? f[f.length - 1] as unknown as { distToGoal?: number }; const v = l?.distToGoal != null ? Math.round(l.distToGoal) : 5; return ({ answer: String(v), step: 5, evidence: `卡在 x≈4.57、目标 x=10,离目标 5.43≈${v}——合力≈0 却远没到目标,这就是局部极小` }) },
        distractors: () => ['0', '1', '10', '3'],
      },
    ],
  },
  {
    id: 'rrtstar', title: 'RRT* · 渐近最优', kernel: rrtstarKernel as Kernel<unknown>, doc: trivialDoc('rrtstar'),
    facts: [
      {
        id: 'rrts_two', label: 'RRT* 多做的两步',
        ask: 'RRT* 相比 RRT，多做了哪两步来趋近最优?', kind: 'choice',
        compute: () => ({ answer: '①选父(choose parent):新点在半径 r 邻域里选"起点→新点代价=cost[邻居]+dist"最小的邻居当父(不是几何最近的);②重连(rewire):加完新点后,把邻域里"经新点更省"的邻居改接到新点、降其代价', step: 1, evidence: '选父+重连让树随采样渐近最优' }),
        distractors: () => ['增大步长+多采样几个点', '用 A* 的启发式代替随机采样', '每步回溯整棵树重新规划'],
      },
      {
        id: 'rrts_complete', label: 'RRT 和 RRT* 的保证',
        ask: 'RRT 和 RRT* 在"能找到什么样的路"上有什么本质区别?', kind: 'choice',
        compute: () => ({ answer: 'RRT 只保证概率完备:样本够多必找到一条可行路,但不最优(接最近≠代价最小)、再多采样也不变好;RRT* 在此基础上还保证渐近最优:随采样数→∞ 收敛到最短路', step: 5, evidence: '概率完备(RRT)vs 渐近最优(RRT*)' }),
        distractors: () => ['两者都保证最优、只是 RRT* 更快', '两者都不保证找到路', 'RRT 最优、RRT* 只是更快'],
      },
      {
        id: 'rrts_radius', label: '邻域半径为何收缩',
        ask: 'RRT* 的邻域半径 r 为什么不用固定值、而是随节点数收缩?', kind: 'choice',
        compute: () => ({ answer: 'r 按 (γ·log n/n)^(1/d) 随节点数 n 收缩:节点越多、半径越小。这样既保证渐近最优的理论性质,又不至于节点多了每步要查一大堆邻居(平衡最优性和计算量)', step: 5, evidence: 'r∝(γ·log n/n)^(1/d);平衡最优与开销' }),
        distractors: () => ['半径固定就够了、不用收缩', '半径应该随节点增多而增大', '半径和最优性无关、随便取'],
      },
      {
        id: 'rrts_cost', label: 'RRT* 的代价',
        ask: 'RRT* 相比 RRT 有什么代价?怎么加速?', kind: 'choice',
        compute: () => ({ answer: '每步要查邻域、算多条代价、还可能重连,比 RRT 慢、每步开销大,而且收敛到最优较慢(初期解也绕)。加速:Informed RRT*(找到初解后只在包住起终点的椭球内采样)、RRT*-Connect、BIT* 等', step: 5, evidence: '慢+初解绕;Informed RRT* 加速收敛' }),
        distractors: () => ['没有代价、RRT* 全面更快', '只是内存多一点、速度一样', 'RRT* 反而更省内存'],
      },
      {
        id: 'rrts_num', label: 'RRT* 选父后的代价',
        ask: '本例邻域 A(cost4,dist2)、B(cost8,dist1)，RRT* 选父后 x_new 的代价是多少?(选 cost[邻居]+dist 最小)', kind: 'number',
        compute: t => { const f = t as unknown as { starCost?: number }[]; const l = f.find(x => x.starCost != null); const v = l?.starCost != null ? Math.round(l.starCost) : 6; return ({ answer: String(v), step: 3, evidence: `经 A=4+2=6、经 B=8+1=9,取最小=${v}(选 A、非最近的 B);RRT 接最近 B 则代价 9` }) },
        distractors: numDistractors,
      },
    ],
  },
  {
    id: 'rrt', title: 'RRT 运动规划', kernel: rrtKernel as Kernel<unknown>, doc: trivialDoc('rrt'),
    facts: [
      {
        id: 'rrt_avoid', label: 'RRT 怎么自动避开障碍',
        ask: 'RRT 长树时并没有专门的"避障算法"，它是怎么让路径绕开障碍的?', kind: 'choice',
        compute: () => ({ answer: '每次朝采样点迈一步时做碰撞检测：若这一步撞障碍/出界就丢弃、不加进树。撞的方向长不出去，树只往空白处蔓延，于是自然绕开障碍', step: 4, evidence: '本例朝中央障碍方向的采样一步步被丢弃(共9次)，树沿左侧空白往上绕过去' }),
        distractors: () => ['先算出障碍的边界再规划绕行', '把障碍当成排斥力推开树', 'RRT 不能避障、需要额外算法'],
      },
      {
        id: 'rrt_optimal', label: 'RRT 完备但不最优',
        ask: 'RRT 找到的路径是不是最短/最优的？它的理论保证是什么?', kind: 'choice',
        compute: () => ({ answer: 'RRT 概率完备(采样够多迟早找到一条可行路)，但不最优——随机采样长出的路径歪歪扭扭、通常不是最短的，要后处理平滑，或用 RRT*(边长树边重接父节点)求近似最优', step: 19, evidence: '本例回溯出的 8 段路径能到终点但不是最短；换种子路径还不一样' }),
        distractors: () => ['RRT 保证找到最短路径', 'RRT 既不完备也无任何保证', 'RRT 总是找到唯一的一条路'],
      },
    ],
  },
  {
    id: 'rrtconnect', title: 'RRT-Connect 双向规划', kernel: rrtconnectKernel as Kernel<unknown>, doc: trivialDoc('rrtconnect'),
    facts: [
      {
        id: 'rc_fast', label: 'RRT-Connect 为什么快',
        ask: 'RRT-Connect 相比单树 RRT 主要快在哪?', kind: 'choice',
        compute: () => ({ answer: '两个改动:①双向——一棵树从起点长、一棵从终点长,两头对着挖、搜索空间对半分;②贪心 CONNECT——让另一棵树朝对方新节点连续迈步(一次走一串、不是一步)、直奔过去。所以通常比单树 RRT 快好几倍,是 MoveIt/OMPL 机械臂规划默认', step: 1, evidence: '双向两棵树 + 贪心 CONNECT(一次走一串)' }),
        distractors: () => ['用了更快的随机数生成器', '不做碰撞检测所以快', '把障碍预先算出来避开'],
      },
      {
        id: 'rc_extend', label: 'EXTEND 和 CONNECT 的区别',
        ask: 'RRT-Connect 里 EXTEND 和 CONNECT 有什么区别?', kind: 'choice',
        compute: () => ({ answer: 'EXTEND 是当前树朝随机采样点只迈一步得到 q_new(撞障碍就丢);CONNECT 是让另一棵树朝这个 q_new 连续迈步、一路走到够到 q_new(相遇)或撞障碍才停。CONNECT 的贪心一次走一串,是加速关键', step: 2, evidence: 'EXTEND 迈一步、CONNECT 连续迈步到够到或撞障碍' }),
        distractors: () => ['两个一样、都只迈一步', 'EXTEND 走一串、CONNECT 走一步', 'CONNECT 是做碰撞检测'],
      },
      {
        id: 'rc_meet', label: '两树怎么拼出路径',
        ask: 'RRT-Connect 里两棵树相遇后怎么得到完整路径?', kind: 'choice',
        compute: () => ({ answer: 'CONNECT 让一棵树够到另一棵树的新节点 q_new,两树在此相遇;从相遇点分别沿各自的父指针回溯到起点树根和终点树根,把两段拼起来就是起点→终点的完整路径。没相遇就交换两棵树继续', step: 3, evidence: '相遇点分别回溯到两树根、拼接' }),
        distractors: () => ['随便连一条直线', '只用起点树、终点树丢掉', '重新从头搜一遍'],
      },
      {
        id: 'rc_optimal', label: 'RRT-Connect 最优吗',
        ask: 'RRT-Connect 找到的路径是最优的吗?', kind: 'choice',
        compute: () => ({ answer: '不是。和 RRT 一样概率完备(采样够多迟早找到可行路)但不最优——拼出的路径歪歪扭扭、不是最短,要后处理平滑,或用双向的 RRT*-Connect/BIT* 求近似最优', step: 4, evidence: '概率完备但不最优、路径要平滑' }),
        distractors: () => ['是、保证最短路径', '既不完备也无保证', '总是找到唯一一条路'],
      },
      {
        id: 'rc_use', label: 'RRT-Connect 用在哪',
        ask: 'RRT-Connect 典型用在哪?', kind: 'choice',
        compute: () => ({ answer: '机械臂在高维关节空间(6/7 维)的运动规划,是 MoveIt/OMPL 的默认规划器;适合起点终点位形都已知、要快速找一条可行路的场景。车式机器人用时,两点之间的迈步/连接要换成满足转弯半径的 Dubins/Reeds-Shepp 曲线', step: 4, evidence: 'MoveIt/OMPL 默认、机械臂关节空间规划' }),
        distractors: () => ['给点云做配准', '数据库查询优化', '相机标定'],
      },
    ],
  },
  {
    id: 'dstarlite', title: 'D* Lite 增量重规划', kernel: dstarliteKernel as Kernel<unknown>, doc: trivialDoc('dstarlite'),
    facts: [
      {
        id: 'ds_idea', label: 'D* Lite 省在哪',
        ask: 'D* Lite 相比"每次从头 A* 重搜",主要省在哪?', kind: 'choice',
        compute: () => ({ answer: '地图变了(发现新障碍)时,只让改动局部失效、只重算受影响的少数格及其下游,其余格子的 g 值原样复用(增量);不像从头 A* 把整张图重搜一遍。地图越大、改动越局部,省得越多', step: 3, evidence: '只重算受影响格、其余 g 复用(增量)' }),
        distractors: () => ['用了更快的优先队列', '不需要启发式函数', '把地图压缩了'],
      },
      {
        id: 'ds_grhs', label: 'g 和 rhs 是什么',
        ask: 'D* Lite 里 g(s) 和 rhs(s) 分别是什么?', kind: 'choice',
        compute: () => ({ answer: 'g(s)=目前已知的从起点到 s 的最优代价;rhs(s)=一步前瞻=min over 邻居(g(邻居)+边权)(起点 rhs=0)。rhs 是"根据邻居现在的 g,我应该是多少"。g=rhs 时该格局部一致(信息最新)', step: 2, evidence: 'g=已知最优代价、rhs=一步前瞻、g=rhs 一致' }),
        distractors: () => ['g 是启发式、rhs 是真实代价', 'g 是行、rhs 是列', '都是随机初值'],
      },
      {
        id: 'ds_consistent', label: '局部一致与不一致',
        ask: '"局部一致"是什么?边权变化时会发生什么?', kind: 'choice',
        compute: () => ({ answer: '局部一致 = g(s)=rhs(s)(该格信息最新)。某条边权重变了(冒出障碍),紧挨的格子发现 g≠rhs(不一致、信息过时)→进优先队列;算法只处理不一致的格、让它们重新一致,涟漪只往受影响下游传', step: 3, evidence: 'g=rhs 一致;边权变→受影响格不一致→进队列' }),
        distractors: () => ['一致就是所有格 g 都相等', '边权变要把所有格清零重来', '不一致的格直接删掉'],
      },
      {
        id: 'ds_use', label: 'D* Lite 用在哪',
        ask: 'D* Lite 典型用在什么场景?', kind: 'choice',
        compute: () => ({ answer: '机器人在部分已知/动态的地图里导航:边走边用传感器发现新障碍(接 SLAM),用 D* Lite 每步只局部修复计划、不必从头重规划,省巨量计算。火星车、送餐/扫地机器人、动态环境导航都用它(及 field D* 等变体)', step: 4, evidence: '动态/未知环境导航、边走边发现障碍' }),
        distractors: () => ['静态已知地图的一次性规划', '图像分类', '机械臂力控'],
      },
      {
        id: 'ds_vs_lpa', label: 'D* Lite 和 A* 的关系',
        ask: 'D* Lite 和 A* 是什么关系?', kind: 'choice',
        compute: () => ({ answer: 'D* Lite 是 A* 的增量式版本:同样可以用启发式 h 制导搜索(h=0 时退化成增量 Dijkstra),但它在地图变化时能复用上次的结果只做局部修复,而 A* 每次都从头搜。它建立在 LPA* 之上、再加起点会移动的补偿(km 项)', step: 4, evidence: 'A* 的增量版、可用 h 制导、复用旧结果局部修' }),
        distractors: () => ['和 A* 无关、是采样式的', 'D* Lite 不用代价、只看方向', 'A* 是 D* Lite 的特例、更强'],
      },
    ],
  },
  {
    id: 'moveit', title: 'MoveIt 2 · 机械臂运动规划框架', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'moveit' }, entities: [], streams: [] },
    facts: [
      {
        id: 'mi_what', label: 'MoveIt 是什么',
        ask: 'MoveIt 2 是什么?在机器人栈里处于什么位置?', kind: 'choice',
        compute: () => ({ answer: 'ROS 2 上机械臂(操作臂)运动规划的事实标准框架:给机器人模型+目标位姿,算出无碰撞、可执行的关节轨迹。中枢是 move_group 节点,把 规划场景/规划器/碰撞检测/运动学/轨迹时间参数化 串成一条流水线。它是"库层"、骑在运动规划算法之上', step: 0, evidence: 'ROS 2 机械臂运动规划框架、move_group 流水线' }),
        distractors: () => ['一个物理仿真器(像 MuJoCo/Gazebo)', '一个移动底盘的导航栈', '一个深度学习训练框架'],
      },
      {
        id: 'mi_planner', label: 'MoveIt 默认规划器',
        ask: 'MoveIt 默认用哪类规划器?底层库是什么?', kind: 'choice',
        compute: () => ({ answer: '默认接 OMPL(Open Motion Planning Library)里的采样式规划器,默认规划器是 RRT-Connect(双向长两棵树+贪心连接);OMPL 里还有 RRT、RRT*、PRM 等。MoveIt 也支持 CHOMP(优化式)、STOMP、Pilz(工业 LIN/PTP)', step: 0, evidence: 'OMPL、默认 RRT-Connect' }),
        distractors: () => ['自己写的 A* 栅格搜索', '深度强化学习策略', '只有一种固定规划器、不可换'],
      },
      {
        id: 'mi_collision', label: 'MoveIt 碰撞检测',
        ask: 'MoveIt 用什么做碰撞检测?背后是什么算法?', kind: 'choice',
        compute: () => ({ answer: '用 FCL(Flexible Collision Library)判机器人与环境/自身碰撞;底层就是 GJK 那类凸-凸碰撞检测(支撑函数 + Minkowski 差)。这正是实验室「GJK 碰撞检测」实验的原理', step: 0, evidence: 'FCL、底层 GJK 凸检测' }),
        distractors: () => ['逐像素比对摄像头图像', '训练一个神经网络判碰撞', '不做碰撞检测、靠人避让'],
      },
      {
        id: 'mi_notinvent', label: 'MoveIt 的定位',
        ask: 'MoveIt 和它内部的算法(RRT-Connect/GJK/CHOMP)是什么关系?', kind: 'choice',
        compute: () => ({ answer: 'MoveIt 不发明新算法,而是把这些经典算法工程化、拼成一条能用的规划流水线(库=用法、算法=原理)。所以学 MoveIt 之前先在实验里把 RRT-Connect/GJK/CHOMP/时间参数化的原理焊死,再回头看 MoveIt 就是"把它们拼起来"', step: 0, evidence: '库把经典算法工程化拼成系统、非发明新算法' }),
        distractors: () => ['MoveIt 发明了全新的规划算法', 'MoveIt 和这些算法无关', 'MoveIt 只是这些算法的文档'],
      },
      {
        id: 'mi_scope', label: 'MoveIt vs Nav2',
        ask: 'MoveIt 和 Nav2 分工是什么?MoveIt 有什么局限?', kind: 'choice',
        compute: () => ({ answer: 'MoveIt 管机械臂(操作臂)的运动规划;移动底盘的自主导航是 Nav2 的活。MoveIt 局限:学习曲线陡、配置繁琐(URDF/SRDF+一堆yaml)、和 ROS 强耦合、量级重、默认采样规划不最优要调参。许可 BSD-3-Clause、PickNik 维护', step: 0, evidence: 'MoveIt=机械臂、Nav2=移动导航;学习曲线陡/偏机械臂' }),
        distractors: () => ['MoveIt 既管机械臂又管移动导航、Nav2 是它的子模块', 'MoveIt 只能用于仿真、不能上真机', '两者完全一样、只是名字不同'],
      },
    ],
  },
  {
    id: 'ros2', title: 'ROS 2 · 机器人通信中间件', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'ros2' }, entities: [], streams: [] },
    facts: [
      {
        id: 'ros_what', label: 'ROS 2 是什么',
        ask: 'ROS 2 是操作系统吗?它到底是什么?', kind: 'choice',
        compute: () => ({ answer: '不是真正的操作系统,而是机器人软件的通信中间件 + 工具生态:把系统拆成一堆节点(小进程),节点间靠话题(发布订阅)、服务(请求响应)、动作(长任务)通信,底层走 DDS。几乎所有机器人软件(MoveIt/Nav2/Autoware)都建在它上面', step: 0, evidence: '通信中间件+工具生态、非真OS、DDS' }),
        distractors: () => ['一个像 Ubuntu 那样的操作系统', '一个物理仿真器', '一个机器人硬件品牌'],
      },
      {
        id: 'ros_comm', label: 'ROS 2 的通信方式',
        ask: 'ROS 2 里节点之间怎么通信?', kind: 'choice',
        compute: () => ({ answer: '三种:话题(topic)发布-订阅(多对多、解耦,如传感器流)、服务(service)请求-响应(短同步调用)、动作(action)带反馈可取消的长任务(如"导航到某点")。底层由 DDS 传输、带 QoS/多机/安全', step: 0, evidence: '话题pub/sub + 服务 + 动作,底层 DDS' }),
        distractors: () => ['只能通过共享内存', '全靠一个中心服务器转发(像 ROS 1 的 master)', '直接函数调用、不能跨进程'],
      },
      {
        id: 'ros_vs1', label: 'ROS 2 相比 ROS 1',
        ask: 'ROS 2 相比 ROS 1 主要改进了什么?', kind: 'choice',
        compute: () => ({ answer: '完全重写:用 DDS 替代中心 master(去单点、支持多机组网)、支持实时、生产级可靠、内置安全(SROS2)。但仍非硬实时——kHz 电机控制环还得下到 MCU / micro-ROS / RT 层。许可 Apache-2.0', step: 0, evidence: 'DDS去master+实时+多机+安全;仍非硬实时' }),
        distractors: () => ['只是换了个名字、没变化', 'ROS 2 变成了闭源商业软件', 'ROS 2 去掉了 Python 支持'],
      },
    ],
  },
  {
    id: 'pinocchio', title: 'Pinocchio · 刚体动力学库', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'pinocchio' }, entities: [], streams: [] },
    facts: [
      {
        id: 'pin_what', label: 'Pinocchio 是什么',
        ask: 'Pinocchio 库是干什么的?', kind: 'choice',
        compute: () => ({ answer: '刚体动力学算法的高性能实现:正/逆运动学、正/逆动力学(RNEA/ABA)、质量矩阵(CRBA)、雅可比,以及这些量的解析导数。是机器人动力学计算的"心脏",Crocoddyl/Stack-of-Tasks 等上层控制库都建在它上面。BSD-2 许可、INRIA 维护', step: 0, evidence: '刚体动力学算法库(RNEA/ABA/CRBA)+解析导数' }),
        distractors: () => ['一个运动规划框架', '一个深度学习库', '一个相机驱动'],
      },
      {
        id: 'pin_deriv', label: 'Pinocchio 的杀手锏',
        ask: 'Pinocchio 相比一般动力学计算,最突出的能力是什么?', kind: 'choice',
        compute: () => ({ answer: '它不仅算动力学量,还给出这些量对 q/q̇/τ 的解析导数(analytical derivatives)。MPC、最优控制、轨迹优化都要梯度,有了解析导数就又快又准,这是 Pinocchio 成为控制/优化底座的关键。加上模板+代码生成、速度极快', step: 0, evidence: '给解析导数(MPC/优化必需)、极快' }),
        distractors: () => ['自带图形界面', '内置强化学习训练', '能直接控制电机'],
      },
      {
        id: 'pin_cover', label: 'Pinocchio 实现的算法',
        ask: 'Pinocchio 内部实现的经典动力学算法有哪些?(对应实验室哪些实验)', kind: 'choice',
        compute: () => ({ answer: 'RNEA(递归牛顿-欧拉逆动力学)、ABA(Articulated-Body 正向动力学)、CRBA(Composite-Rigid-Body 质量矩阵)——正是实验室「刚体动力学」组里 rnea/dyneom/fwddyn 这些手推过的算法。库把它们工程化,原理在实验里', step: 0, evidence: 'RNEA/ABA/CRBA=刚体动力学实验的工程化' }),
        distractors: () => ['卷积和注意力', '快速傅里叶变换', 'A* 和 Dijkstra'],
      },
    ],
  },
  {
    id: 'lerobotlib', title: 'LeRobot · 端到端机器人学习库', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'lerobot' }, entities: [], streams: [] },
    facts: [
      {
        id: 'lr_what', label: 'LeRobot 是什么',
        ask: 'LeRobot 库是干什么的?', kind: 'choice',
        compute: () => ({ answer: 'Hugging Face 的端到端机器人学习库(以模仿学习为主):标准数据集格式(LeRobotDataset)、一批策略实现(ACT/Diffusion Policy/TDMPC/VLA)、低成本真机支持(SO-100/SO-101/ALOHA)。目标是把"采数据→训策略→上真机"降到人人能跑。Apache-2.0、PyTorch', step: 0, evidence: 'HF 端到端机器人学习库:数据+策略+真机' }),
        distractors: () => ['一个机器人仿真物理引擎', '一个 SLAM 建图库', '一个电机驱动固件'],
      },
      {
        id: 'lr_cover', label: 'LeRobot 内部机制',
        ask: 'LeRobot 内部用到的机制,对应实验室哪些实验?', kind: 'choice',
        compute: () => ({ answer: 'ACT(动作分块+时序集成)、delta_timestamps(时序窗口)、数据集归一化、主从遥操作采数据——正是实验室「具身学习/项目实战」里 actte/deltats/normstats/teleop 这些实验拆的机制。库是"用法"、实验是"原理"', step: 0, evidence: 'ACT/delta_timestamps/归一化/遥操作=具身学习实验' }),
        distractors: () => ['B+ 树和 LSM 树', 'TCP 拥塞控制', 'RSA 和 AES 加密'],
      },
      {
        id: 'lr_paradigm', label: 'LeRobot 的学习范式与局限',
        ask: 'LeRobot 主要走什么学习范式?有什么局限?', kind: 'choice',
        compute: () => ({ answer: '以模仿学习为主:靠人遥操作采示范数据、训策略克隆动作,所以数据质量决定上限;偏研究/入门,工业级鲁棒性/安全还要自己补,依赖也重(PyTorch 全家桶)。优势是低成本真机(SO-101)+ 开箱即用 + HF 生态共享', step: 0, evidence: '模仿学习为主、数据质量定上限、偏入门' }),
        distractors: () => ['纯强化学习、不需要任何数据', '只做仿真、上不了真机', '只支持百万美元级工业机器人'],
      },
    ],
  },
  {
    id: 'mujoco', title: 'MuJoCo · 接触物理引擎', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'mujoco' }, entities: [], streams: [] },
    facts: [
      { id: 'mj_what', label: 'MuJoCo 是什么', ask: 'MuJoCo 是什么?名字什么意思?', kind: 'choice', compute: () => ({ answer: 'MuJoCo=Multi-Joint dynamics with Contact,通用物理引擎,主打接触丰富的刚体动力学,广泛用于机器人/生物力学/机器学习。Google DeepMind 2022 开源(Apache-2.0)。是学界机器人控制/RL 的默认仿真器', step: 0, evidence: '接触丰富的通用物理引擎、DeepMind Apache-2.0' }), distractors: () => ['一个深度学习框架', '一个 SLAM 建图库', '一个机器人操作系统'] },
      { id: 'mj_contact', label: 'MuJoCo 的接触处理', ask: 'MuJoCo 在接触动力学上的特点是什么?', kind: 'choice', compute: () => ({ answer: '把接触建成凸优化问题(软/弹性接触),大步长也稳定、还能给一阶解析导数(利于最优控制/可微仿真)。这也是它比很多引擎更适合控制与 RL 的原因', step: 0, evidence: '接触当凸优化、大步长稳、给解析导数' }), distractors: () => ['完全刚性硬接触、不给导数', '不处理接触、只做自由飞行', '用神经网络预测接触'] },
      { id: 'mj_mjx', label: 'MJX 是什么', ask: 'MuJoCo 的 MJX 是干什么的?', kind: 'choice', compute: () => ({ answer: 'MJX 是 MuJoCo 的 JAX 版实现,能在 GPU/TPU 上大规模并行仿真(数千环境),把强化学习训练加速几个数量级。和 Brax 生态一起做大规模 RL', step: 0, evidence: 'JAX 版、GPU/TPU 并行、加速 RL' }), distractors: () => ['MuJoCo 的图形界面', 'MuJoCo 的机器人硬件', 'MuJoCo 的移动 App'] },
    ],
  },
  {
    id: 'isaaclab', title: 'Isaac Lab · GPU 机器人学习框架', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'isaaclab' }, entities: [], streams: [] },
    facts: [
      { id: 'il_what', label: 'Isaac Lab 是什么', ask: 'Isaac Lab 是什么?和 Isaac Sim 什么关系?', kind: 'choice', compute: () => ({ answer: 'NVIDIA 开源的机器人学习框架(BSD-3),建在 Isaac Sim(Omniverse 上的高保真/照片级仿真平台)之上,主打 GPU 大规模并行训机器人策略(RL/模仿/规划)、sim-to-real', step: 0, evidence: 'NVIDIA GPU 机器人学习框架、建在 Isaac Sim 上' }), distractors: () => ['一个独立于 GPU 的 CPU 仿真器', '一个点云处理库', 'NVIDIA 的操作系统'] },
      { id: 'il_vs_mujoco', label: 'Isaac Lab vs MuJoCo', ask: 'Isaac Lab 和 MuJoCo 各自强在哪?', kind: 'choice', compute: () => ({ answer: 'Isaac Lab 强在 GPU 大规模并行(数千环境)、照片级渲染 + 传感器仿真、sim-to-real 与产业生态;MuJoCo 强在接触动力学精度与学术评测、轻量。感知/规模选 Isaac、接触/算法评测选 MuJoCo', step: 0, evidence: 'Isaac=规模/逼真感知/sim2real、MuJoCo=接触精度/轻量' }), distractors: () => ['两者完全一样', 'MuJoCo 更逼真、Isaac 更轻量', 'Isaac Lab 不支持 GPU'] },
      { id: 'il_use', label: 'Isaac Lab 用在哪', ask: 'Isaac Lab 典型用途?', kind: 'choice', compute: () => ({ answer: '机器人基座模型/RL 策略的大规模训练、sim-to-real 迁移、复杂交互与感知任务;和 rl_games/RSL-RL、VLA 训练打通(如 GR00T 的仿真训练)。局限:强依赖 NVIDIA GPU/Omniverse、体量大', step: 0, evidence: '大规模 RL/基座模型训练、sim-to-real;依赖 NVIDIA GPU' }), distractors: () => ['给单片机写电机固件', '数据库查询优化', '网页前端开发'] },
    ],
  },
  {
    id: 'pcl', title: 'PCL · 点云处理库', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'pcl' }, entities: [], streams: [] },
    facts: [
      { id: 'pcl_what', label: 'PCL 是什么', ask: 'PCL(Point Cloud Library)是干什么的?', kind: 'choice', compute: () => ({ answer: '2D/3D 点云处理的老牌开源标准库(BSD-3):滤波(体素下采样/离群点)、特征(法线估计)、配准(ICP)、分割、曲面重建一整套,模块化、ROS 深度集成。几乎所有感知项目都用它', step: 0, evidence: '点云处理老牌标准库、滤波/特征/配准/分割' }), distractors: () => ['一个物理仿真器', '一个强化学习库', '一个电机驱动'] },
      { id: 'pcl_cover', label: 'PCL 对应的实验', ask: 'PCL 的哪些模块对应实验室「点云预处理」和「ICP」?', kind: 'choice', compute: () => ({ answer: '滤波模块的体素下采样、特征模块的法线估计(PCA)对应「点云预处理」实验;配准模块的 ICP(点到点/点到面等变体)对应「ICP 点云配准」实验。库是工程实现、实验是原理', step: 0, evidence: '体素下采样/法线估计↔点云预处理、ICP↔ICP 配准' }), distractors: () => ['卷积和注意力', 'TCP 拥塞控制', 'B+ 树索引'] },
      { id: 'pcl_limit', label: 'PCL 的局限', ask: 'PCL 有什么局限?', kind: 'choice', compute: () => ({ answer: 'C++ 为主、编译重、上手门槛高;偏经典几何算法,深度学习点云(如 PointNet)要另找;部分模块 API 老、维护慢。更现代/Python 友好可看 Open3D', step: 0, evidence: 'C++重/偏经典几何/API老;现代可看 Open3D' }), distractors: () => ['不能处理 3D 只能 2D', '闭源收费', '只能在 GPU 上跑'] },
    ],
  },
  {
    id: 'orbslam3', title: 'ORB-SLAM3 · 视觉惯性 SLAM', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'orbslam3' }, entities: [], streams: [] },
    facts: [
      { id: 'orb_what', label: 'ORB-SLAM3 是什么', ask: 'ORB-SLAM3 是什么?', kind: 'choice', compute: () => ({ answer: '精度标杆的开源视觉/视觉惯性 SLAM 库(GPL-3.0),支持单目/双目/RGB-D + IMU + 多地图。用 ORB 特征点做前端、光束平差做后端、词袋做回环', step: 0, evidence: '视觉/视觉惯性 SLAM、ORB 特征+BA+回环、GPL-3.0' }), distractors: () => ['一个物理仿真器', '一个点云滤波库', '一个电机控制固件'] },
      { id: 'orb_pipe', label: 'ORB-SLAM3 的流程', ask: 'ORB-SLAM3 前后端的核心步骤,对应实验室哪些实验?', kind: 'choice', compute: () => ({ answer: 'ORB 特征匹配→对极几何求相对运动(↔视觉里程计)→PnP 重定位(↔PnP)→光束平差优化位姿+地图点→回环检测闭合漂移(↔SLAM 回环校正)。正是我们感知实验里的那几步', step: 0, evidence: '对极几何↔VO、PnP↔重定位、回环↔SLAM 校正' }), distractors: () => ['卷积→池化→全连接', 'Clarke→Park→SVPWM', '生产者→队列→消费者'] },
      { id: 'orb_gpl', label: 'ORB-SLAM3 的许可注意', ask: '用 ORB-SLAM3 要注意什么许可问题?', kind: 'choice', compute: () => ({ answer: '它是 GPL-3.0,有传染性——把它链进闭源商业产品要非常小心(可能被要求开源)。研究/开源用没问题,商用要评估许可或找 BSD/Apache 的替代', step: 0, evidence: 'GPL-3.0 传染性、商业闭源慎用' }), distractors: () => ['MIT 随便用', '闭源收费软件', '公有领域无任何限制'] },
    ],
  },
  {
    id: 'ros2control', title: 'ros2_control · 实时控制框架', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'ros2control' }, entities: [], streams: [] },
    facts: [
      { id: 'rc_what', label: 'ros2_control 是什么', ask: 'ros2_control 是干什么的?', kind: 'choice', compute: () => ({ answer: 'ROS 2 的实时控制框架(Apache-2.0):把硬件(真机/仿真)抽象成统一接口,控制器管理器在实时循环里加载/切换控制器(关节轨迹/PID/力控),把上层规划的轨迹执行到底层电机。是"规划→执行"的标准中间层', step: 0, evidence: '硬件抽象+控制器管理器、规划→执行中间层' }), distractors: () => ['一个运动规划算法', '一个 SLAM 库', '一个仿真渲染器'] },
      { id: 'rc_cover', label: 'ros2_control 的控制器', ask: 'ros2_control 里的控制器对应实验室哪些实验?', kind: 'choice', compute: () => ({ answer: 'PID 控制器↔「PID 控制」、力控/导纳控制器↔「阻抗/力控」、关节轨迹控制器(插值下发)↔「轨迹规划/梯形速度曲线」。它把 MoveIt 出的轨迹执行到硬件', step: 0, evidence: 'PID/力控/关节轨迹控制器↔对应控制实验' }), distractors: () => ['A* 和 Dijkstra', 'RSA 和 AES', 'BPE 和分词'] },
      { id: 'rc_pos', label: 'ros2_control 的位置', ask: 'ros2_control 在机器人软件栈里处于什么位置?', kind: 'choice', compute: () => ({ answer: '在"规划"和"电机"之间:上接 MoveIt/Nav2 等规划出的轨迹/命令,下接硬件接口写到电机;sim 与真机用同一套控制器。再往下的电流环是 SimpleFOC 那类', step: 0, evidence: '规划与电机之间、sim/真机通用、下接电流环' }), distractors: () => ['最上层的任务规划', '最底层的电流环 PWM', '和控制无关的可视化'] },
    ],
  },
  {
    id: 'nav2', title: 'Nav2 · 移动机器人导航栈', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'nav2' }, entities: [], streams: [] },
    facts: [
      { id: 'nav_what', label: 'Nav2 是什么', ask: 'Nav2 是什么?和 MoveIt 分工?', kind: 'choice', compute: () => ({ answer: 'ROS 2 移动机器人自主导航标准栈(Apache-2.0):行为树编排 + 代价图 + 全局规划器(NavFn/Smac/Theta*) + 局部控制器(DWB/MPPI) + 恢复行为。MoveIt 管机械臂、Nav2 管移动底盘', step: 0, evidence: '移动导航栈、行为树+代价图+规划+控制;MoveIt 管臂' }), distractors: () => ['管机械臂运动规划(那是 MoveIt)', '一个物理引擎', '一个电机驱动'] },
      { id: 'nav_cover', label: 'Nav2 对应的实验', ask: 'Nav2 的哪些组件对应实验室的规划实验?', kind: 'choice', compute: () => ({ answer: 'Smac 混合 A* 规划器用 Reeds-Shepp/Dubins 处理车式非完整约束↔「Dubins 曲线」;代价图膨胀层=障碍斥力↔「人工势场法」;MPPI 局部控制↔「MPC」;地图变化全局重规划↔「D* Lite」', step: 0, evidence: 'Smac↔Dubins、膨胀层↔势场、MPPI↔MPC、重规划↔D*Lite' }), distractors: () => ['卷积/注意力/Transformer', 'ICP/点云/SLAM', 'RSA/AES/HMAC'] },
      { id: 'nav_limit', label: 'Nav2 的局限', ask: 'Nav2 有什么局限?', kind: 'choice', compute: () => ({ answer: '配置庞大(一堆 yaml + 行为树)、调参门槛高;偏 2D/2.5D 平面导航(3D/腿足要另做);依赖定位(AMCL/SLAM);动态密集环境仍具挑战', step: 0, evidence: '配置庞大调参难、偏 2D、依赖定位' }), distractors: () => ['只能仿真上不了真机', '不支持避障', '闭源收费'] },
    ],
  },
  {
    id: 'openvla', title: 'OpenVLA · 视觉-语言-动作基座模型', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'openvla' }, entities: [], streams: [] },
    facts: [
      { id: 'ov_what', label: 'OpenVLA 是什么', ask: 'OpenVLA 是什么?', kind: 'choice', compute: () => ({ answer: '开源视觉-语言-动作(VLA)基座模型(MIT,7B):输入相机图 + 语言指令,直接输出机器人动作。视觉用 DINOv2+SigLIP、语言用 Llama 2,在 Open X-Embodiment 97 万条真机演示上训练', step: 0, evidence: '开源 VLA 基座(7B)、图+指令→动作' }), distractors: () => ['一个物理仿真器', '一个 SLAM 库', '一个电机控制库'] },
      { id: 'ov_action', label: 'VLA 怎么出动作', ask: 'OpenVLA 是怎么把"图+指令"变成动作的?', kind: 'choice', compute: () => ({ answer: '把连续动作离散化成 token,由语言模型自回归生成(和 ACT 的动作分块是同一思路)。这样能复用大语言模型的架构与预训练能力。局限:离散化有精度/频率取舍', step: 0, evidence: '动作离散成 token 自回归生成(似 ACT)' }), distractors: () => ['直接解析求逆运动学', '查表匹配预设动作', '随机采样动作'] },
      { id: 'ov_deploy', label: 'OpenVLA 上真机', ask: 'OpenVLA 这类 VLA 上真机有什么挑战?怎么落地?', kind: 'choice', compute: () => ({ answer: '7B 模型推理算力高、实时性要靠 OFT/FAST 等加速;还要解决控制频率、安全、标定。落地常配 LeRobot 接到低成本真机;π0/RDT/GR00T 是同类', step: 0, evidence: '算力高要加速、配 LeRobot 上真机' }), distractors: () => ['无需任何数据即可零成本部署', '只能在仿真里跑', '不需要相机'] },
    ],
  },
  {
    id: 'simplefoc', title: 'SimpleFOC · 无刷电机磁场定向控制', kernel: libraryKernel as Kernel<unknown>, doc: { kind: 'library', params: { lib: 'simplefoc' }, entities: [], streams: [] },
    facts: [
      { id: 'sf_what', label: 'SimpleFOC 是什么', ask: 'SimpleFOC 是干什么的?', kind: 'choice', compute: () => ({ answer: '最亲民的开源磁场定向控制(FOC)库(MIT,Arduino/PlatformIO),给无刷(BLDC)/步进电机做平滑的力矩/速度/位置控制,把 Clarke/Park/SVPWM/电流环封成几行代码。是机器人关节驱动最底层一环', step: 0, evidence: 'Arduino FOC 库、BLDC/步进力矩/速度/位置控制' }), distractors: () => ['一个运动规划框架', '一个 SLAM 库', '一个深度学习库'] },
      { id: 'sf_cover', label: 'SimpleFOC 对应的实验', ask: 'SimpleFOC 内部算法对应实验室哪些实验?', kind: 'choice', compute: () => ({ answer: 'FOC 电流环(Clarke→Park→两个 PI→逆变换+SVPWM)↔「FOC 磁场定向控制」实验;级联位置→速度→电流三环↔「PID 控制」。稚晖君 Dummy-Robot 的 Ctrl-FOC-Lite 就基于 SimpleFOC', step: 0, evidence: 'FOC 电流环↔FOC 实验、级联环↔PID' }), distractors: () => ['A*/Dijkstra 寻路', 'ICP 点云配准', '注意力机制'] },
      { id: 'sf_limit', label: 'SimpleFOC 的定位', ask: 'SimpleFOC 适合什么场景?不适合什么?', kind: 'choice', compute: () => ({ answer: '适合爱好者/创客/教育/中小功率(DIY 机械臂、云台、力反馈);不是工业伺服级,Arduino 生态算力/实时有限、高转速吃紧、高性能要搭好硬件(电流采样/驱动)', step: 0, evidence: '爱好者/中小功率;非工业伺服级、算力实时有限' }), distractors: () => ['大规模工业伺服首选', '只能控直流有刷电机', '不需要任何传感器'] },
    ],
  },
  {
    id: 'blockingqueue', title: '线程安全阻塞队列', kernel: blockingqueueKernel as Kernel<unknown>, doc: trivialDoc('blockingqueue'),
    facts: [
      {
        id: 'block_when', label: '阻塞队列什么时候阻塞谁',
        ask: '有界阻塞队列里，什么时候生产者被阻塞、什么时候消费者被阻塞?', kind: 'choice',
        compute: () => ({ answer: '队列满时 put 让生产者阻塞（等有空位），队列空时 take 让消费者阻塞（等有数据）；对方操作后 signal 唤醒被阻塞的一方', step: 3, evidence: '队列 [A,B] 满，put(C) 时生产者阻塞；消费者 take 腾出空位后唤醒它' }),
        distractors: () => ['队列空时阻塞生产者、满时阻塞消费者', '任何时候都不阻塞', '只在队列半满时阻塞'],
      },
      {
        id: 'two_conds', label: '为什么要两个条件变量',
        ask: '实现阻塞队列为什么要两个条件变量（notFull / notEmpty），用 while 判断满/空?', kind: 'choice',
        compute: () => ({ answer: '生产者在 notFull 上等空位、消费者在 notEmpty 上等数据，分开才能精确唤醒对应的一方；用 while 而非 if 判满/空是为了防"虚假唤醒"——被唤醒后要重新检查条件', step: 10, evidence: '满/空是两个不同的等待条件，各自的等待者不同' }),
        distractors: () => ['一个条件变量就够了', 'while 只是为了写着好看', '两个条件变量是为了更快'],
      },
    ],
  },
  {
    id: 'objectstore', title: '设计对象存储', kernel: objectstoreKernel as Kernel<unknown>, doc: trivialDoc('objectstore'),
    facts: [
      {
        id: 'replica_ec', label: '副本和纠删码怎么选',
        ask: '对象存储保证数据不丢，用多副本还是纠删码，怎么权衡?', kind: 'choice',
        compute: () => ({ answer: '多副本(如3副本)=3倍存储、恢复快、简单，适合热数据；纠删码(如RS(6,3))=约1.5倍存储、省钱，但恢复要计算、CPU高、恢复慢，适合冷数据。核心是存储成本 vs 恢复性能的权衡', step: 5, evidence: '3副本3倍空间；纠删码把冗余从"整份复制"降到"校验块"' }),
        distractors: () => ['副本一定更好', '纠删码一定更好', '两者存储开销一样'],
      },
      {
        id: 'why_object', label: '为什么用对象存储而不是文件系统',
        ask: '存海量图片视频，为什么用对象存储、而不是传统文件系统的目录树?', kind: 'choice',
        compute: () => ({ answer: '海量小文件会把文件系统的目录树/inode/元数据撑爆；对象存储用扁平的 key(bucket/hash)而非目录树，元数据单独存、可水平扩展，天然适合海量对象', step: 2, evidence: '目录树扛不住 PB 级海量文件，对象存储扁平 key 可扩展' }),
        distractors: () => ['对象存储读写更快', '文件系统不能存视频', '对象存储不用存元数据'],
      },
    ],
  },
  {
    id: 'queryplan', title: '执行计划 · 优化器选路', kernel: queryplanKernel as Kernel<unknown>, doc: trivialDoc('queryplan'),
    facts: [
      {
        id: 'cbo', label: '优化器凭什么选执行计划',
        ask: '同一个查询有多条访问路径，数据库优化器凭什么选其中一条?', kind: 'choice',
        compute: () => ({ answer: '基于代价(CBO)：估每条访问路径大概要扫多少行(以及回表、排序等成本)，选代价最低的。不是"哪个索引新"或"随便挑"', step: 4, evidence: '全表扫 10000、idx(city) 500、idx(age) 6000 → 选 500 行的 idx(city)' }),
        distractors: () => ['选最新建的索引', '选主键索引', '随机选一条'],
      },
      {
        id: 'why_not_index', label: '建了索引为什么有时不走',
        ask: '明明建了索引，EXPLAIN 却显示 type=ALL（全表扫），可能是为什么?', kind: 'choice',
        compute: () => ({ answer: '优化器算出走索引反而更贵——比如索引命中行太多、回表成本高，全表扫可能更省；或统计信息过期导致代价估错；也可能是查询写法让索引失效(函数、隐式转换、最左前缀不满足)', step: 0, evidence: '优化器按代价选，命中行多时全表扫可能比走索引+回表更省' }),
        distractors: () => ['索引一建就一定会走', '数据库有 bug', '索引太新还没生效'],
      },
    ],
  },
]
