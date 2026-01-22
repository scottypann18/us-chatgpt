import OpenAI from 'openai'

let cachedClient: OpenAI | null = null

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey })
  }
  return cachedClient
}

export type ProjectChatTool =
  | { type: 'web_search' }
  | { type: 'file_search'; vector_store_ids: string[]; max_num_results?: number }
  | {
      type: 'function'
      function: {
        name: string
        description: string
        parameters: {
          type: 'object'
          properties: Record<string, unknown>
          required: string[]
        }
      }
    }

export type ProjectChatResponseMessage = {
  role: 'system' | 'user' | 'assistant'
  content: Array<{ type: 'input_text' | 'output_text'; text: string }>
}

export async function sendProjectChatCompletion(params: {
  model?: string
  messages: ProjectChatResponseMessage[]
  tools: ProjectChatTool[]
}) {
  const client = getClient()
  return client.responses.create({
    model: params.model || process.env.OPENAI_SIMPLE_CHAT_MODEL || 'gpt-4o-mini',
    input: params.messages as any,
    tools: params.tools as any,
  })
}

export async function generateProjectImage(params: { prompt: string; size?: string }) {
  const client = getClient()
  const size: '1024x1024' | '1536x1024' | '1024x1536' | undefined =
    params.size === '1536x1024' || params.size === '1024x1536' ? params.size : params.size ? '1024x1024' : undefined
  return client.images.generate({
    model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
    prompt: params.prompt,
    size,
  })
}