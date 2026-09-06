import { report, ok, _counts, _forgive } from './harness.ts'
import { run as circuit } from './circuit.test.ts'
import { run as thermal } from './thermal.test.ts'
import { run as control } from './control.test.ts'
import { run as route, runForward } from './route.test.ts'
import { run as dns, runS2 as dnsS2, runS3 as dnsS3, runS4 as dnsS4, runS4b as dnsS4b, runS5 as dnsS5, runS6 as dnsS6 } from './dns.test.ts'
import { run as thermalCards } from './thermal-cards.test.ts'
import { run as dnsCards } from './dns-cards.test.ts'
import { run as craft } from './craft.test.ts'
import { run as combat } from './combat.test.ts'
import { run as stack } from './stack.test.ts'
import { run as saboteur } from './saboteur.test.ts'
import { run as houseRun } from './run.test.ts'
import { run as dnsDuel } from './dns-duel.test.ts'
import { run as thermalDuel } from './thermal-duel.test.ts'
import { run as partner } from './partner.test.ts'
import { run as cache } from './cache.test.ts'
import { run as infer } from './infer.test.ts'
import { run as ssd } from './ssd.test.ts'

circuit()
route()
runForward()
thermal()
control()
dns()
dnsS2()
dnsS3()
dnsS4()
dnsS4b()
dnsS5()
dnsS6()
craft()
dnsCards()
thermalCards()
dnsDuel()
houseRun()
saboteur()
stack()
combat()
thermalDuel()
await partner()
cache()
infer()
ssd()

//  自检：证明这个测试台真的能判红。
//  一个永远绿的判据比没有判据更糟 —— 它会让你以为验过了。
{
  const before = _counts().fail
  ok(false, '(自检)')
  const after = _counts().fail
  if (after !== before + 1) {
    console.log('❌ 测试台自检失败：判红判不出来')
    process.exit(2)
  }
  _forgive(1)
  console.log('  ✓ 自检：测试台能判红')
}

process.exit(report() === 0 ? 0 : 1)
