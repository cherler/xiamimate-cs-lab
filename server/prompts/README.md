# `server/prompts`

AI 学伴的提示词，一句一句摆在文件里，不再散在 `quiz.ts` 的字符串拼接里。

**为什么搬出来**：用户 2026-09-07 说「AI 学伴的逻辑我还是不放心」。提示词藏在代码里，
改一个字要动 TS、review 时混在逻辑中间看不清、也没法让判据去检查「那几条规矩还在不在」。
搬成 markdown 之后：一眼能读完、能 diff、能被 `tests/prompt-rules.test.ts` 逐条盯着。

做法参考了清华 OpenMAIC（MIT，`packages/@openmaic/generation/templates/<id>/system.md`），
但只学了「提示词文件化 + 出题工艺规则」这一层 —— **没学它的答案来源**：
它的 `"answer": ["A"]` 是模型生成的、判分也是模型说了算（`app/api/quiz-grade/route.ts`，
JSON 解析失败还兜底给满分的 50%）。我们的答案由引擎钉死，模型碰不到，这条不动。

## 文件

| 文件 | 用在哪 |
|---|---|
| `quiz-concept.md` | 出**原理题**的题面与讲解 |
| `quiz-count.md`   | 出**计数题**的题面与讲解（题面必须自带那组数据） |
| `_option-rules.md`| 两份共用的「选项与讲解怎么写」—— 被 `{{snippet:option-rules}}` 插进去 |

## 占位符

`{{snippet:名字}}` 在加载时把 `_名字.md` 的内容拼进来；`{{变量}}` 由调用方填。
两者都**找不到就原样留着**（不抛异常）—— 所以 `tests/prompt-rules.test.ts` 有一条判据
专门检查「渲染完的提示词里不许还剩 `{{`」，否则占位符会被当成字面量发给模型。
