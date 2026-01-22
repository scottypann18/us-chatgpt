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

export async function createResponse(params: Parameters<OpenAI['responses']['create']>[0]) {
  const client = getClient()
  return client.responses.create(params as any)
}

export async function parseResponse(params: Parameters<OpenAI['responses']['parse']>[0]) {
  const client = getClient()
  return client.responses.parse(params as any)
}
