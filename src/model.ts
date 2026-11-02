import { createOpenAI } from "@ai-sdk/openai"

import { createMockModel } from "./mock-model"

const openai = createOpenAI({
  baseURL: process.env.PROVIDER_BASE_URL,
  apiKey: process.env.PROVIDER_API_KEY,
})

export const model =
  process.env.PROVIDER_API_KEY && process.env.PROVIDER_MODEL_IDENTITY
    ? openai.chat(process.env.PROVIDER_MODEL_IDENTITY)
    : createMockModel()
