/**
 * 虾米实验室 · AI 学伴后端（Node/TS）。
 *
 * 为什么后端用 TS 而不是照抄 stock-lab 的 Python：我们有 121 个 TS 内核，
 * 后端直接 import 它们跑 trace 出题/验答，零重写。计费闸口协议(见 llm.ts)语言无关，照搬。
 *
 * 路由（都挂在 /lab/ai 下，线上由 Caddy/gateway 把 /lab/* 分流到本仓）：
 *   GET  /lab/ai/health        健康检查
 *   GET  /lab/ai/experiments   可出题的实验清单
 *   POST /lab/ai/quiz          出题 { expId, count?, useLLM? }
 *   GET  /lab/ai/suggest       常见疑问 ?expId=（返回每个 fact 的可点问题,答疑不用打字）
 *   POST /lab/ai/ask           答疑 { expId, question, step?, factId?, useLLM? }（喂真实 trace+要点当依据;factId 来自点选疑问、附出处）
 *   POST /lab/ai/review        复习包 { expId, useLLM? }（钉死事实卡 + 概念卡 + 小结）
 *   POST /lab/ai/interview     模拟面试 { expId | expIds[]+trackTitle, history, useLLM? }（AI 面试官:问→答→点评+追问→评分;传 expIds 即整轨跨主题面试）
 *   POST /lab/ai/interview-answer 看参考答案 { expId | expIds[]+trackTitle, history, useLLM? }（给面试官刚问那道题一个基于钉死要点的参考答案）
 *   POST /lab/ai/debate        辩论/抬杠 { expId, factId?, useLLM? }（会反驳的 AI 同学:抛错主张→你选反驳→引擎判对错,选择题版）
 *
 * 鉴权/计费：浏览器请求的 xm_session Cookie 原样转发给主站（见 llm.ts 的 Principal）。
 * 本机开发未配 XM_API_BASE 时全程透明、不计费、不报错。
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { buildQuiz } from './quiz.ts'
import { askAboutExperiment, suggestQuestions } from './ask.ts'
import { buildReview } from './review.ts'
import { interview, interviewAnswer, type Turn } from './interview.ts'
import { debate } from './debate.ts'
import { listExperiments } from './catalog.ts'
import type { Principal } from './llm.ts'

process.loadEnvFile('.env')

const PORT = Number(process.env.LAB_AI_PORT ?? 8300)

function send(res: ServerResponse, status: number, body: unknown): void {
  const s = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(s),
  })
  res.end(s)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', c => { data += c; if (data.length > 1e6) reject(new Error('请求体过大')) })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

// 浏览器请求：把 xm_session Cookie 原样转发，主站自己解出是谁。本进程不知道也伪造不了 user_id。
function principalOf(req: IncomingMessage): Principal {
  const cookie = req.headers['cookie'] ?? ''
  if (cookie && /(^|;\s*)xm_session=/.test(cookie)) return { kind: 'browser', cookie }
  return null
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const path = url.pathname
  try {
    if (req.method === 'GET' && path === '/lab/ai/health') {
      return send(res, 200, { ok: true, service: 'lab-ai', experiments: listExperiments().length })
    }
    if (req.method === 'GET' && path === '/lab/ai/experiments') {
      return send(res, 200, { experiments: listExperiments() })
    }
    if (req.method === 'POST' && path === '/lab/ai/quiz') {
      const raw = await readBody(req)
      let body: { expId?: string; count?: number; useLLM?: boolean; factId?: string } = {}
      try { body = raw ? JSON.parse(raw) : {} } catch { return send(res, 400, { error: '请求体不是合法 JSON' }) }
      if (!body.expId) return send(res, 400, { error: '缺少 expId' })
      const questions = await buildQuiz(body.expId, {
        count: body.count, useLLM: body.useLLM, principal: principalOf(req), factId: body.factId,
      })
      return send(res, 200, { expId: body.expId, questions })
    }
    if (req.method === 'GET' && path === '/lab/ai/suggest') {
      const expId = url.searchParams.get('expId') ?? ''
      if (!expId) return send(res, 400, { error: '缺少 expId' })
      return send(res, 200, { expId, questions: suggestQuestions(expId) })
    }
    if (req.method === 'POST' && path === '/lab/ai/ask') {
      const raw = await readBody(req)
      let body: { expId?: string; question?: string; step?: number; factId?: string; useLLM?: boolean } = {}
      try { body = raw ? JSON.parse(raw) : {} } catch { return send(res, 400, { error: '请求体不是合法 JSON' }) }
      if (!body.expId) return send(res, 400, { error: '缺少 expId' })
      if (!body.question) return send(res, 400, { error: '缺少 question' })
      const result = await askAboutExperiment(body.expId, body.question, {
        step: body.step, factId: body.factId, useLLM: body.useLLM, principal: principalOf(req),
      })
      return send(res, 200, result)
    }
    if (req.method === 'POST' && path === '/lab/ai/review') {
      const raw = await readBody(req)
      let body: { expId?: string; useLLM?: boolean } = {}
      try { body = raw ? JSON.parse(raw) : {} } catch { return send(res, 400, { error: '请求体不是合法 JSON' }) }
      if (!body.expId) return send(res, 400, { error: '缺少 expId' })
      const pack = await buildReview(body.expId, { useLLM: body.useLLM, principal: principalOf(req) })
      return send(res, 200, pack)
    }
    if (req.method === 'POST' && path === '/lab/ai/interview') {
      const raw = await readBody(req)
      let body: { expId?: string; expIds?: string[]; trackTitle?: string; history?: Turn[]; useLLM?: boolean } = {}
      try { body = raw ? JSON.parse(raw) : {} } catch { return send(res, 400, { error: '请求体不是合法 JSON' }) }
      if (!body.expId && !(body.expIds && body.expIds.length)) return send(res, 400, { error: '缺少 expId 或 expIds' })
      const result = await interview(body.expId ?? '', { expIds: body.expIds, trackTitle: body.trackTitle, history: body.history, useLLM: body.useLLM, principal: principalOf(req) })
      return send(res, 200, result)
    }
    if (req.method === 'POST' && path === '/lab/ai/interview-answer') {
      const raw = await readBody(req)
      let body: { expId?: string; expIds?: string[]; trackTitle?: string; history?: Turn[]; useLLM?: boolean } = {}
      try { body = raw ? JSON.parse(raw) : {} } catch { return send(res, 400, { error: '请求体不是合法 JSON' }) }
      if (!body.expId && !(body.expIds && body.expIds.length)) return send(res, 400, { error: '缺少 expId 或 expIds' })
      const result = await interviewAnswer(body.expId ?? '', { expIds: body.expIds, trackTitle: body.trackTitle, history: body.history, useLLM: body.useLLM, principal: principalOf(req) })
      return send(res, 200, result)
    }
    if (req.method === 'POST' && path === '/lab/ai/debate') {
      const raw = await readBody(req)
      let body: { expId?: string; factId?: string; useLLM?: boolean } = {}
      try { body = raw ? JSON.parse(raw) : {} } catch { return send(res, 400, { error: '请求体不是合法 JSON' }) }
      if (!body.expId) return send(res, 400, { error: '缺少 expId' })
      const result = await debate(body.expId, { factId: body.factId, useLLM: body.useLLM, principal: principalOf(req) })
      return send(res, 200, result)
    }
    return send(res, 404, { error: `未知路由 ${req.method} ${path}` })
  } catch (e) {
    const msg = (e as Error).message
    console.error('[lab-ai] 处理出错:', msg)
    return send(res, 500, { error: msg })
  }
})

server.listen(PORT, () => {
  console.log(`虾米实验室 AI 学伴后端 → http://127.0.0.1:${PORT}/lab/ai/health`)
  console.log(`可出题实验：${listExperiments().map(e => e.id).join(', ')}`)
  const billed = process.env.XM_API_BASE ? '已接入主站计费' : '未配 XM_API_BASE（本地透明模式，不计费）'
  console.log(`计费：${billed}`)
})
