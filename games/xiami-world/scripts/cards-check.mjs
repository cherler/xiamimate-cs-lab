import { chromium } from 'playwright'
const SHOT='/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
let pass=0,fail=0;const ok=(c,w)=>{if(c){pass++;console.log('  ✅ '+w)}else{fail++;console.log('  ❌ '+w)}}
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:720}})
const errs=[];p.on('pageerror',e=>errs.push(String(e)))
await p.goto('http://localhost:5180/spikes/cards.html',{waitUntil:'networkidle'});await p.waitForTimeout(400)
const st=()=>p.evaluate(()=>window.__cg);const play=c=>p.evaluate(c=>window.__play(c),c)
ok(errs.length===0,'无报错'+(errs[0]?':'+errs[0].slice(0,120):''))
let s=await st();ok(s.idx===0&&s.hp===3,'开局:第1个症状·❤3')
// 第1题(域名没回音):选个看着相关的干扰(更新本地时间)→ 扣血、不前进
await play('更新本地时间');s=await st();ok(s.idx===0&&s.hp===2,'干扰卡「更新时间」→不对症、-1❤、不前进')
await p.screenshot({path:SHOT+'/cg2-wrong.png'})
// 选对(换DNS)→ 前进
await play('换个 DNS 服务器');s=await st();ok(s.idx===1,'对症「换DNS」→进第2题')
// 第2题(连接被拒)→ 用DNS卡(过时了)应被判错;正确=重连
await play('换个 DNS 服务器');s=await st();ok(s.idx===1&&s.hp===1,'第2题用「换DNS」→错(那步早过)、-1❤')
await play('重发 / 换条线路重连');s=await st();ok(s.idx===2,'对症「重连」→进第3题')
// 第3题(CA不认识)→ 正确=信任根CA(注意 更新时间 是陷阱)
await play('信任这个根 CA');s=await st();ok(s.idx===3,'对症「信任根CA」→进第4题')
// 第4题(301)→ 正确=跟随重定向
await play('跟随重定向到 https');s=await st();ok(s.won,'对症「跟随重定向」→网页打开(won)')
await p.screenshot({path:SHOT+'/cg2-win.png'})
await b.close();console.log(`\n${pass} ✅  ${fail} ❌`);process.exit(fail?1:0)
