import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
let pass=0,fail=0; const ok=(c,w)=>{if(c){pass++;console.log('  ✅ '+w)}else{fail++;console.log('  ❌ '+w)}}
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto('http://localhost:5180/spikes/tcp-machine.html',{waitUntil:'networkidle'}); await p.waitForTimeout(700)
const st=()=>p.evaluate(()=>window.__state())
ok(errs.length===0,'无报错'+(errs[0]?':'+errs[0].slice(0,120):''))
let s=await st(); ok(!s.assembled && s.filled===0,'开局:两臂+空顺序槽、未拼')
await p.screenshot({path:SHOT+'/tcp-empty.png'})
await p.evaluate(()=>{window.__fill();window.__fill();window.__fill()})
s=await st(); ok(s.assembled,'三步就位→可运行')
await p.evaluate(()=>window.__run())
await p.waitForTimeout(1500); await p.screenshot({path:SHOT+'/tcp-run.png'})
await p.waitForTimeout(3200); s=await st()
ok(s.connected,'握手三拍完→通道接通(connected)')
await p.screenshot({path:SHOT+'/tcp-done.png'})
await b.close(); console.log(`\n${pass} ✅  ${fail} ❌`); process.exit(fail?1:0)
