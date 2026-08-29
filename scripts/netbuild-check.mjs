import { chromium } from 'playwright'
const SHOT='/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
let pass=0,fail=0;const ok=(c,w)=>{if(c){pass++;console.log('  ✅ '+w)}else{fail++;console.log('  ❌ '+w)}}
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:720}})
const errs=[];p.on('pageerror',e=>errs.push(String(e)))
await p.goto('http://localhost:5180/spikes/netbuild.html',{waitUntil:'networkidle'});await p.waitForTimeout(500)
const st=()=>p.evaluate(()=>window.__nb)
ok(errs.length===0,'无报错'+(errs[0]?':'+errs[0].slice(0,120):''))
let s=await st();ok(s.gold===120&&s.rep===3&&s.wave===1&&s.targets.length===0,'开局:金120·❤3·第1波·无冲击')
await p.evaluate(()=>{for(let i=0;i<5;i++)window.__build(i)});await p.waitForTimeout(80)
s=await st();ok(s.builtCount===5&&s.gold===10,`建满五站剩10金(gold=${s.gold})`)
// 第1波(普通)→通→第2波,出现冲击预告
await p.evaluate(()=>window.__send());await p.waitForTimeout(4200)
s=await st();ok(s.wave===2&&s.gold===55&&s.targets.length>=1,`第1波通→第2波、出现冲击预告(冲击${s.targets.length}站)`)
await p.screenshot({path:SHOT+'/nb-d-preview.png'})
// 加固被冲击的站 → 发波 → 护盾挡住 → 通、进第3波
const t2=(await st()).targets
await p.evaluate(ts=>ts.forEach(i=>window.__harden(i)),t2);await p.waitForTimeout(80)
s=await st();ok(t2.every(i=>s.hard[i]),'加固🛡了被冲击的站')
await p.evaluate(()=>window.__send());await p.waitForTimeout(4500)
s=await st();ok(s.wave===3&&s.rep===3,'护盾挡住冲击→第2波通、声誉没掉、进第3波')
// 第3波不加固 → 发波 → 站被打坏、包卡住、声誉-1
const t3=(await st()).targets
await p.evaluate(()=>window.__send());await p.waitForTimeout(3000)
s=await st();ok(s.rep===2&&t3.some(i=>s.broken[i]),`没加固就发→被冲击站打坏、声誉扣到${s.rep}`)
await p.screenshot({path:SHOT+'/nb-d-hit.png'})
await b.close();console.log(`\n${pass} ✅  ${fail} ❌`);process.exit(fail?1:0)
