/**
 * 音频：BGM 循环 + 咕噜台词配音 + 静音开关。
 *
 * 全走 HTML5 Audio（跨场景、不依赖 Phaser 加载器）。配音是**预生成的固定台词**——
 * 运行时不打 MiniMax（key 不能进浏览器、有成本/延迟），模型升级的动态台词就不配音。
 * 所有 play() 失败都吞掉（浏览器无交互禁自动播、headless 无音频设备），不报错、不影响玩。
 */
import type { CognitiveNode } from '../../agents/partner.ts'
import enterUrl from '../../web/assets/audio/enter.mp3'
import anomalyUrl from '../../web/assets/audio/anomaly.mp3'
import beforePickUrl from '../../web/assets/audio/before-pick.mp3'
import crackedUrl from '../../web/assets/audio/cracked.mp3'
import freezeWarnUrl from '../../web/assets/audio/freeze-warn.mp3'
import bgmUrl from '../../web/assets/audio/bgm.mp3'

const LINE: Partial<Record<CognitiveNode, string>> = {
  enter: enterUrl, anomaly: anomalyUrl, 'before-pick': beforePickUrl,
  cracked: crackedUrl, 'freeze-warn': freezeWarnUrl,
}

const KEY = 'xiami.muted'
let muted = false
try { muted = localStorage.getItem(KEY) === '1' } catch { /* ignore */ }

let bgm: HTMLAudioElement | null = null
let curLine: HTMLAudioElement | null = null

export function isMuted(): boolean { return muted }

export function setMuted(m: boolean): void {
  muted = m
  try { localStorage.setItem(KEY, m ? '1' : '0') } catch { /* ignore */ }
  if (bgm) bgm.muted = m
  if (m && curLine) { try { curLine.pause() } catch { /* ignore */ } }
}

export function toggleMuted(): boolean { setMuted(!muted); return muted }

/** 首次交互后启动 BGM（浏览器禁止无交互自动播放） */
export function startBgm(): void {
  if (bgm) return
  bgm = new Audio(bgmUrl)
  bgm.loop = true
  bgm.volume = 0.32
  bgm.muted = muted
  bgm.play().catch(() => { /* 被拦就算了 */ })
}

/** 认知节点台词配音（固定台词）。静音或无对应音频则跳过。 */
export function playLine(node: CognitiveNode): void {
  if (muted) return
  const url = LINE[node]
  if (!url) return
  try { curLine?.pause() } catch { /* ignore */ }
  curLine = new Audio(url)
  curLine.volume = 0.9
  curLine.play().catch(() => { /* ignore */ })
}
