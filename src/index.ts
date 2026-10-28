import "dotenv/config"
import { createInterface } from "node:readline"
import process from "process"

import { createOpenAI } from "@ai-sdk/openai"
import { type ModelMessage } from "ai"

import { agentLoop } from "./agent-loop"
import { createMockModel } from "./mock-model"
import { calculatorTool, weatherTool } from "./tools"

const openai = createOpenAI({
  baseURL: process.env.PROVIDER_BASE_URL,
  apiKey: process.env.PROVIDER_API_KEY,
})

const model =
  process.env.PROVIDER_API_KEY && process.env.PROVIDER_MODEL_IDENTITY
    ? openai.chat(process.env.PROVIDER_MODEL_IDENTITY)
    : createMockModel()

const tools = { get_weather: weatherTool, calculator: calculatorTool }
const messages: ModelMessage[] = []
const rl = createInterface({ input: process.stdin, output: process.stdout })

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

    await agentLoop(model, tools, messages, SYSTEM)

    ask()
  })
}

console.log('Naive Agent v0.2 (type "exit" to quit)\n')
ask()
