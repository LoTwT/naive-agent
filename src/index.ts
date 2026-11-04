import "dotenv/config"
import { createInterface } from "node:readline"

import { type ModelMessage } from "ai"

import { agentLoop } from "./agent-loop.js"
import { model } from "./model.js"
import { ToolRegistry } from "./tool-registry.js"
import { allTools } from "./tools.js"

const registry = new ToolRegistry()
registry.register(...allTools)

const searchBackend = process.env.TAVILY_API_KEY
  ? "Tavily"
  : process.env.SERPER_API_KEY
    ? "Serper"
    : "未配置"

console.log(`已注册 ${registry.getAll().length} 个工具`)
console.log(
  `搜索后端: ${searchBackend}${searchBackend === "未配置" ? "（在 .env 中设置 TAVILY_API_KEY 或 SERPER_API_KEY）" : ""}`,
)

const messages: ModelMessage[] = []
const rl = createInterface({ input: process.stdin, output: process.stdout })

const SYSTEM = `你是 Naive Agent，一个能搜索互联网、读写代码的 AI 助手。

你有 web_search 和 web_fetch 两个搜索相关的工具：
- web_search：搜索互联网，返回相关网页的标题、链接和内容摘要
- web_fetch：抓取指定 URL 的完整内容，转为 Markdown

当用户问的问题需要最新信息时，先用 web_search 搜索，拿到结果后总结回答。
如果搜索结果的摘要不够详细，用 web_fetch 抓取具体链接的全文。

回答简洁直接，引用信息时标注来源链接。`

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

console.log('\nNaive Agent v0.4.3 — Search Tool（"exit" 退出）')
console.log("试试：")
console.log("  1. 搜索一下 Vercel AI SDK 最新版本")
console.log("  2. 2026 年最流行的 Agent 框架是什么")
console.log("  3. 帮我查一下 TypeScript 7.0 有什么新特性\n")
ask()
