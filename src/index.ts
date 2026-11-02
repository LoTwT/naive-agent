import "dotenv/config"
import { createInterface } from "node:readline"
import process from "process"

import { type ModelMessage } from "ai"

import { agentLoop } from "./agent-loop"
import { model } from "./model"
import { ToolRegistry } from "./tool-registry"
import { allTools } from "./tools"

const messages: ModelMessage[] = []
// 预算由调用方持有，跨轮持续累计——agentLoop 只负责消费它
const rl = createInterface({ input: process.stdin, output: process.stdout })

const registry = new ToolRegistry()
registry.register(...allTools)

console.log(`已注册 ${registry.getAll().length} 个工具：`)
for (const tool of registry.getAll()) {
  const flags = [
    tool.isConcurrencySafe ? "可并发" : "串行",
    tool.isReadOnly ? "只读" : "读写",
  ].join(", ")
  console.log(`  - ${tool.name}（${flags}）`)
}

const SYSTEM = `你是 Naive Agent，一个有工具调用能力的 AI 助手。
需要查询信息时，主动使用工具，不要编造数据。
回答要简洁直接。`

function ask() {
  rl.question("\nYou: ", async (input) => {
    const trimmed = input.trim()
    if (!trimmed || trimmed === "exit") {
      console.log("Bye!")
      rl.close()
      return
    }

    messages.push({ role: "user", content: trimmed })

    await agentLoop(model, registry, messages, SYSTEM)

    ask()
  })
}

console.log('Naive Agent v0.3 — Fuses (type "exit" to quit)\n')
console.log('试试输入："测试死循环"、"测试重试"、"测试预算" 看三层防护效果\n')
ask()
