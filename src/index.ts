import "dotenv/config"
import process from "node:process"
import { createInterface } from "node:readline"

import { createOpenAI } from "@ai-sdk/openai"
import { streamText, type ModelMessage } from "ai"

import { createMockModel } from "./mock-model"

const openai = createOpenAI({
  baseURL: process.env.PROVIDER_BASE_URL,
  apiKey: process.env.PROVIDER_API_KEY,
})

const model =
  process.env.PROVIDER_API_KEY && process.env.PROVIDER_MODEL_IDENTITY
    ? openai.chat(process.env.PROVIDER_MODEL_IDENTITY)
    : (createMockModel() as any)

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
})

const messages: ModelMessage[] = []

function ask() {
  rl.question("\nYou: ", async (input) => {
    const trimmed = input.trim()
    if (!trimmed || trimmed === "exit") {
      console.log("Bye!")
      rl.close()
      return
    }

    messages.push({
      role: "user",
      content: trimmed,
    })

    const result = streamText({
      model,
      messages,
      system: `你是 Naive Agent，一个专注于软件开发的 AI 助手。
    你说话简洁直接，喜欢用代码示例来解释问题。
    如果用户的问题不够清晰，你会反问而不是瞎猜。`,
    })

    process.stdout.write("Assistant: ")
    let fullResponse = ""
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk)
      fullResponse += chunk
    }
    console.log() // 换行

    messages.push({
      role: "assistant",
      content: fullResponse,
    })

    ask()
  })
}

console.log(`Naive Agent v0.1 (type "exit" to quit)\n`)
ask()
