/** 极小测试台。判据自己得能红 —— 见 run-all.ts 末尾的自检。 */
let pass = 0
let fail = 0
const failures: string[] = []

export function ok(cond: boolean, what: string) {
  if (cond) { pass++; return }
  fail++
  failures.push(what)
}

export function near(got: number, want: number, what: string, tol = 1e-6) {
  ok(Math.abs(got - want) <= tol, `${what} —— 期望 ${want}，实际 ${got}`)
}

export function report(): number {
  for (const f of failures) console.log('  ❌ ' + f)
  console.log(`\n${pass} ✅  ${fail} ❌`)
  return fail
}

/** 只给自检用：确认这个测试台真的能判红 */
export function _counts() { return { pass, fail } }
export function _forgive(n: number) { fail -= n; failures.length = Math.max(0, failures.length - n) }
