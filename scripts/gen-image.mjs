// 生图:APIYI gpt-image-2(OpenAI 兼容)。用法:node scripts/gen-image.mjs "<prompt>" <outPath> [size] [transparent]
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('=') && !l.trimStart().startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const KEY = env.APIYI_API_KEY, BASE = env.APIYI_BASE_URL, MODEL = env.APIYI_IMAGE_MODEL
const [, , prompt, out, size = '1024x1024', transparent] = process.argv
const body = { model: MODEL, prompt, size, n: 1 }
if (transparent === 'transparent') { body.background = 'transparent'; body.output_format = 'png' }
console.log('→', MODEL, size, transparent || '', '|', out)
const res = await fetch(`${BASE}/images/generations`, { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const j = await res.json().catch(() => ({}))
if (!res.ok) { console.error('ERR', res.status, JSON.stringify(j).slice(0, 500)); process.exit(1) }
const d = j.data?.[0]
mkdirSync(dirname(out), { recursive: true })
if (d?.b64_json) { writeFileSync(out, Buffer.from(d.b64_json, 'base64')); console.log('saved', out) }
else if (d?.url) { const img = await fetch(d.url); writeFileSync(out, Buffer.from(await img.arrayBuffer())); console.log('saved', out, '(url)') }
else { console.error('no image in resp:', JSON.stringify(j).slice(0, 500)); process.exit(1) }
