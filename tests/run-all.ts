import { report, ok, _counts, _forgive } from './harness.ts'
import { run as circuit } from './circuit.test.ts'
import { run as thermal } from './thermal.test.ts'
import { run as control } from './control.test.ts'
import { run as dns, runS2 as dnsS2, runS3 as dnsS3, runS4 as dnsS4 } from './dns.test.ts'
import { run as partner } from './partner.test.ts'

circuit()
thermal()
control()
dns()
dnsS2()
dnsS3()
dnsS4()
await partner()

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
