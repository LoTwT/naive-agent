import "dotenv/config"
import { createInterface } from "node:readline"

import { type ModelMessage } from "ai"

import { agentLoop } from "./agent-loop.js"
import { MCPClient, MockMCPClient } from "./mcp-client.js"
import { model } from "./model.js"
import { ToolDefinition, ToolRegistry } from "./tool-registry.js"
import { allTools } from "./tools.js"

const searchBackend = process.env.TAVILY_API_KEY
  ? "Tavily"
  : process.env.SERPER_API_KEY
    ? "Serper"
    : "未配置"

console.log(
  `搜索后端: ${searchBackend}${searchBackend === "未配置" ? "（在 .env 中设置 TAVILY_API_KEY 或 SERPER_API_KEY）" : ""}`,
)

const registry = new ToolRegistry()
registry.register(...allTools)

const toolSearchTool: ToolDefinition = {
  name: "tool_search",
  description:
    "获取延迟工具的完整定义。传入工具名（从系统提示的延迟工具列表中选取），返回该工具的完整参数 Schema",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          '工具名，如 "mcp__github__list_issues"。支持逗号分隔多个工具名',
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  isConcurrencySafe: true,
  isReadOnly: true,
  execute: async ({ query }: { query: string }) => {
    const results = registry.searchTools(query)
    if (results.length === 0) return `没有找到匹配 "${query}" 的工具`
    return results.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }))
  },
}

registry.register(toolSearchTool)

const allCount = registry.getAll().length
const activeTools = registry.getActiveTools()
const estimate = registry.countTokenEstimate()

console.log(`\n=== 工具统计 ===`)
console.log(`  全部工具: ${allCount} 个`)
console.log(`  活跃工具: ${activeTools.length} 个`)
console.log(`  延迟工具: ${allCount - activeTools.length} 个`)
console.log(
  `  Token 估算: ~${estimate.active} (活跃) + ~${estimate.deferred} (延迟，不占 prompt)`,
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

async function connectMCP() {
  const githubToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN

  let canSpawn = true
  try {
    const { execSync } = await import("node:child_process")
    execSync("echo test", { stdio: "ignore" })
  } catch {
    canSpawn = false
  }

  if (githubToken && canSpawn) {
    console.log("\n连接 GitHub MCP Server...")
    try {
      const client = new MCPClient(
        "npx",
        ["-y", "@modelcontextprotocol/server-github"],
        { GITHUB_PERSONAL_ACCESS_TOKEN: githubToken },
      )
      const tools = await registry.registerMCPServer("github", client)
      console.log(`  已注册 ${tools.length} 个 MCP 工具`)
      return
    } catch (err) {
      console.log(`  MCP 连接失败: ${err instanceof Error ? err.message : err}`)
      console.log("  降级为 Mock MCP...")
    }
  }

  if (!githubToken) {
    console.log("\n未配置 GITHUB_PERSONAL_ACCESS_TOKEN，使用 Mock MCP")
  }

  const mockClient = new MockMCPClient()
  const tools = await registry.registerMCPServer("github", mockClient)
  console.log(`  已注册 ${tools.length} 个 Mock MCP 工具`)
}

async function ask() {
  await connectMCP()
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

console.log("\nNaive Agent")
ask()
