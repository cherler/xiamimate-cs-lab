/**
 * 极简程序化音效(Web Audio,零外部素材)。首次发声需用户手势——本 demo 靠「按空格开场」满足自动播放策略。
 * 全部即时合成:UI 滴、脚步、进门 whoosh、通关 chime、终章 win。失败音在机关 iframe 内(暂静音,后续可加)。
 */
let ac: AudioContext | null = null
function actx(): AudioContext | null {
  if (!ac) { try { ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)() } catch { return null } }
  if (ac.state === 'suspended') ac.resume().catch(() => { })
  return ac
}
function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.12, slideTo?: number) {
  const a = actx(); if (!a) return
  const o = a.createOscillator(), g = a.createGain()
  o.type = type; o.frequency.setValueAtTime(freq, a.currentTime)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), a.currentTime + dur)
  g.gain.setValueAtTime(gain, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur)
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur)
}
function arp(freqs: number[], step = 100, dur = 0.4, type: OscillatorType = 'triangle', gain = 0.13) {
  freqs.forEach((f, i) => setTimeout(() => tone(f, dur, type, gain), i * step))
}

// —— 背景音乐:暖色慢 pad 和弦 + 轻铃,循环,低音量(程序化,零素材)——
let bgmMaster: GainNode | null = null
let bgmTimer: ReturnType<typeof setInterval> | null = null
let bgmIdx = 0, bgmVol = 0.5
const BGM_PROG = [[174.6, 220, 261.6], [146.8, 196, 246.9], [196, 246.9, 293.7], [130.8, 164.8, 196]] // F · Dm · G · C 暖进行
function bgmGain() { const a = actx(); if (!a) return null; if (!bgmMaster) { bgmMaster = a.createGain(); bgmMaster.gain.value = bgmVol; bgmMaster.connect(a.destination) } return bgmMaster }
function padChord(freqs: number[]) {
  const a = actx(), m = bgmGain(); if (!a || !m) return; const t = a.currentTime
  const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.055, t + 1.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2); g.connect(m)
  for (const f of freqs) { for (const det of [1, 1.006]) { const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = f * det; o.connect(g); o.start(t); o.stop(t + 4.3) } }
  const top = freqs[freqs.length - 1]! * 2, b = a.createOscillator(), bg = a.createGain() // 顶上一颗轻铃
  b.type = 'triangle'; b.frequency.value = top; bg.gain.setValueAtTime(0.0001, t + 0.25); bg.gain.exponentialRampToValueAtTime(0.028, t + 0.4); bg.gain.exponentialRampToValueAtTime(0.0001, t + 1.7); b.connect(bg).connect(m); b.start(t + 0.25); b.stop(t + 1.8)
}

export const sfx = {
  resume: () => actx(),
  startBgm: () => { const a = actx(); if (!a || bgmTimer !== null) return; bgmGain(); padChord(BGM_PROG[0]!); bgmIdx = 1; bgmTimer = setInterval(() => padChord(BGM_PROG[bgmIdx++ % BGM_PROG.length]!), 3400) },
  stopBgm: () => { if (bgmTimer !== null) { clearInterval(bgmTimer); bgmTimer = null } },
  setMuted: (m: boolean) => { bgmVol = m ? 0 : 0.5; const g = bgmGain(); if (g) g.gain.value = bgmVol },
  blip: () => tone(520, 0.08, 'square', 0.05),
  step: () => tone(150 + Math.random() * 50, 0.05, 'sine', 0.035),
  dive: () => tone(160, 0.6, 'sawtooth', 0.09, 760),
  enter: () => tone(300, 0.3, 'sine', 0.1, 620),
  chime: () => arp([523, 659, 784], 90, 0.35, 'sine', 0.12),
  win: () => arp([523, 659, 784, 1047, 1319], 130, 0.5, 'triangle', 0.14),
  place: () => tone(240 + Math.random() * 30, 0.05, 'square', 0.05), // 放零件:轻脆咔
  run: () => tone(180, 0.35, 'sawtooth', 0.08, 520),                 // 开机:启动 whoosh
  ping: () => tone(760 + Math.random() * 60, 0.06, 'sine', 0.045),   // 送达一个包:清脆 ping
  fail: () => tone(160, 0.35, 'sawtooth', 0.12, 60),                 // 失败:下坠 thud
}
