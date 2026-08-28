/**
 * 内核：系统设计 · 设计对象存储 / 短视频存储 —— 存海量图片视频、便宜又快（后端 · 系统设计 / 求职）
 * 轴：step —— 需求→估算→对象存储核心(切块+纠删码+元数据)→上传(分片/秒传)→分发(CDN/转码)→权衡
 *
 * 存海量图片/短视频(微博、抖音、网盘)是系统设计高频题。矛盾:数据量巨大、要低成本、还要读得快(播放不卡)。
 * 核心是**对象存储**:文件切块、多副本或纠删码存到多机;元数据(文件→块在哪)单独存;用扁平 key 不用目录树。
 * 上传要支持大文件**分片续传**和**秒传**(哈希去重);读走 **CDN** 边缘缓存,视频还要**转码切片**(多码率 HLS)。
 * 复用「需求→估算→核心→扩展→权衡」框架。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'
import type { SysDesignState } from './urlshortener.ts'

type Comp = { id: string; label: string; role: string }
type Frame = Omit<SysDesignState, 'i'>

const STAGES: { stage: string; focus: string; detail: string; metric: string; add?: Comp[] }[] = [
  {
    stage: '① 需求澄清', focus: '海量图片视频：低成本存、快速读',
    detail: '存海量图片、短视频（PB 级）。要求：**低成本**（存储是大头）、**高可用**（不丢）、**读得快**（播放不卡）。特征：**一次写、多次读**、大小文件混合、冷热差异大。',
    metric: 'PB 级、一次写多次读、冷热差异大',
    add: [{ id: 'client', label: '客户端', role: '上传 / 播放' }],
  },
  {
    stage: '② 容量估算', focus: '数据量巨大、成本敏感',
    detail: '海量小文件（图片）+ 大文件（视频）。传统文件系统的目录树扛不住这么多文件（inode/元数据爆）。存储成本是核心，得在"可靠性"和"存储开销"之间权衡。',
    metric: '目录树扛不住海量文件 → 需要对象存储',
    add: [{ id: 'meta', label: '元数据服务', role: '文件→块位置' }],
  },
  {
    stage: '③ 核心：对象存储', focus: '切块 + 冗余存多机 + 扁平 key',
    detail: '**对象存储**：文件切成**块**，用**多副本**或**纠删码**存到多台机器（挂一台不丢）；**元数据**（对象 key → 哪些块在哪些机）单独存。用**扁平的 key**（如 bucket/hash）而非目录树，天然可水平扩展。',
    metric: '切块 + 副本/纠删码 + 元数据 + 扁平 key',
    add: [{ id: 'store', label: '对象存储集群', role: '切块+纠删码存多机' }],
  },
  {
    stage: '④ 上传：分片 + 秒传', focus: '大文件断点续传、哈希去重',
    detail: '大文件**分片上传**：切成小片并行传、断了从断点续，不用重来。**秒传**：上传前先算文件哈希，若库里已有相同哈希的文件，直接建个引用、不真传——省带宽和存储（很多人存同一个视频）。',
    metric: '分片续传 + 哈希秒传(去重)',
    add: [{ id: 'upload', label: '上传服务', role: '分片续传+秒传去重' }],
  },
  {
    stage: '⑤ 分发：CDN + 转码', focus: '热点走边缘缓存，视频转码切片',
    detail: '读走 **CDN**：热点文件缓存在离用户近的边缘节点，命中就不回源，播放快、省带宽。视频还要**转码**成多种码率、**切成小片**（HLS/DASH），客户端按网速自适应选码率、边下边播。',
    metric: 'CDN 边缘缓存 + 多码率转码切片',
    add: [{ id: 'cdn', label: 'CDN', role: '边缘缓存分发' }, { id: 'transcode', label: '转码服务', role: '多码率切片' }],
  },
]

export const objectstoreKernel: Kernel<SysDesignState> = {
  kind: 'objectstore',
  compile(_doc: SimDocument): CompiledModel<SysDesignState> {
    const frames: Frame[] = []
    const components: Comp[] = []
    for (const s of STAGES) {
      if (s.add) components.push(...s.add)
      frames.push({
        step: frames.length, stage: s.stage, focus: s.focus, detail: s.detail, metric: s.metric,
        components: components.map(c => ({ ...c })), phase: 'run',
        log: `**${s.stage}：${s.focus}**\n${s.detail}\n关键：${s.metric}`,
      })
    }
    frames.push({
      step: frames.length, stage: '⑥ 权衡总结', focus: '一句话讲清取舍', detail: '',
      metric: '对象存储(切块+纠删码) + 上传(分片秒传) + 分发(CDN+转码)',
      components: components.map(c => ({ ...c })), phase: 'done',
      log: `**设计完成**：对象存储三块——**存**(切块+纠删码/副本+元数据，扁平 key 水平扩展)、**传**(分片续传+哈希秒传去重)、**发**(CDN 边缘缓存 + 多码率转码切片)。面试加分点：**副本 vs 纠删码**(3 副本=3 倍存储、恢复快；纠删码如 RS(6,3)=1.5 倍存储、恢复要算、CPU 高——冷数据用纠删码省钱)、**冷热分层**(热数据放 SSD、冷数据降到对象存储/归档存储)、小文件问题(合并成大块存、减元数据)、元数据怎么扩(分片/一致性哈希)、上传大文件的断点续传、防盗链和鉴权。这套就是 S3/OSS/HDFS 和抖音、B 站的存储底座。`,
    })
    const base0: Frame = { step: -1, stage: '', focus: '', detail: '', metric: '', components: [], phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '设计步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
