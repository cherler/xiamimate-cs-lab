import assert from 'node:assert/strict'
import { hostSettings } from '../web/src/platform.ts'

// A non-root URL must not opt an independent site into cookies or platform APIs.
for (const protocol of ['http:', 'https:']) {
  const pages = hostSettings('/xiamimate-cs-lab/', true, protocol)
  assert.equal(pages.platform, false)
  assert.equal(pages.ai, false)
  assert.equal(pages.subappsBase, '/xiamimate-cs-lab/')
  assert.equal(hostSettings('/another-project/', false, protocol).platform, false)
  assert.equal(hostSettings('/cslab/', true, protocol).platform, false)
  assert.equal(hostSettings('/cslab/', false, protocol).platform, true)
}
assert.equal(hostSettings('/cslab/', false, 'file:').platform, false)
assert.equal(hostSettings('/', false, 'http:').platform, false)
assert.equal(hostSettings('/', false, 'http:').subappsBase, '/cslab/')
assert.equal(hostSettings('/cslab/', false, 'https:').ai, true)
console.log('Pages hosting: platform isolation, AI availability and nested paths verified')
