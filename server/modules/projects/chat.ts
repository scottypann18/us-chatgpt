import { Buffer } from 'buffer'
import { db } from '@/lib/db'
import { projectChats, projectInstructions, projectMessages, projects } from '@/lib/db/schema'
import { projectChatRequestSchema, type ProjectChatMessage, type ProjectChatRequest } from './validation'
import { and, eq, isNull } from 'drizzle-orm'
import { generateProjectImage, sendProjectChatCompletion } from '@/lib/services/openai/project-chat'

export class ProjectChatError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export interface ProjectChatResult {
  assistantText: string
  imageDataUrl: string | null
}

type ResponseMessage = {
  role: 'system' | 'user' | 'assistant'
  content: Array<{ type: 'input_text' | 'output_text'; text: string }>
}

type FunctionToolCall = {
  name: string
  arguments?: Record<string, unknown>
}

type Tool =
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

export const generateImageTool: Tool = {
  type: 'function',
  function: {
    name: 'generate_image',
    description: 'Generate an image for the project chat request.',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Full image description including style and subject.' },
        size: {
          type: 'string',
          enum: ['1024x1024', '1536x1024', '1024x1536'],
          description: 'Optional size; landscape=1536x1024, portrait=1024x1536, square=1024x1024.',
        },
      },
      required: ['prompt'],
    },
  },
}

const buildSystemPrompt = ({ projectName, instructions }: { projectName: string; instructions?: string | null }) => {
  const parts = [
    `You are the project-only assistant for project "${projectName}".`,
    'Memory mode: project-only. Only use context from this project; do not rely on any other workspace memory.',
  ]

  if (instructions && instructions.trim().length > 0) {
    parts.push('Project instructions:', instructions.trim())
  }

  parts.push('Be concise and focus on the user request.')

  return parts.join('\n')
}

export async function sendProjectChatMessage(request: ProjectChatRequest): Promise<ProjectChatResult> {
  const parsed = projectChatRequestSchema.safeParse(request)
  if (!parsed.success) {
    throw new ProjectChatError(parsed.error.issues[0]?.message ?? 'Invalid payload', 400)
  }

  const { projectId, chatId, messages, webSearch, userId } = parsed.data

  const [project] = await db
    .select({ id: projects.id, name: projects.name, vectorStoreId: projects.vectorStoreId })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId), isNull(projects.deletedAt)))
    .limit(1)

  if (!project) {
    throw new ProjectChatError('Project not found', 404)
  }

  const [chat] = await db
    .select({ id: projectChats.id })
    .from(projectChats)
    .where(and(eq(projectChats.id, chatId), eq(projectChats.projectId, projectId), isNull(projectChats.deletedAt)))
    .limit(1)

  if (!chat) {
    throw new ProjectChatError('Chat not found', 404)
  }

  const [instructionRow] = await db
    .select({ instructions: projectInstructions.instructions })
    .from(projectInstructions)
    .where(eq(projectInstructions.projectId, projectId))
    .limit(1)

  const systemPrompt = buildSystemPrompt({ projectName: project.name, instructions: instructionRow?.instructions })

  const tools: Tool[] = []

  if (webSearch) {
    tools.push({ type: 'web_search' })
  }

  if (project.vectorStoreId) {
    tools.push({ type: 'file_search', vector_store_ids: [project.vectorStoreId], max_num_results: 8 })
  }

  tools.push(generateImageTool)

  const inputMessages: ResponseMessage[] = [
    {
      role: 'system',
      content: [{ type: 'input_text', text: systemPrompt }],
    },
    ...messages.map<ResponseMessage>(m => ({
      role: m.role,
      content: [
        {
          type: m.role === 'assistant' ? 'output_text' : 'input_text',
          text: m.content,
        },
      ],
    })),
  ]

  const response = await sendProjectChatCompletion({ messages: inputMessages, tools })

  const userMessage = messages[messages.length - 1]
  const now = new Date().toISOString()

  let assistantText = response.output_text || 'Image generated.'
  let imageDataUrl: string | null = null

  const toolCalls: Record<string, unknown>[] =
    response.output
      ?.filter((o: any) => o.type === 'function_call' && o.name === 'generate_image')
      .map((call: any) => call.arguments || {}) || []

  if (toolCalls.length) {
    const args = toolCalls[0]
    const prompt = (args['prompt'] as string | undefined)?.trim() || userMessage.content
    const size = (args['size'] as string | undefined) || '1024x1024'

    const img = await generateProjectImage({ prompt, size })

    const generated = img.data?.[0]
    if (generated?.b64_json) {
      imageDataUrl = `data:image/png;base64,${generated.b64_json}`
    } else if (generated?.url) {
      try {
        const res = await fetch(generated.url)
        const mime = res.headers.get('content-type') || 'image/png'
        const buffer = Buffer.from(await res.arrayBuffer())
        imageDataUrl = `data:${mime};base64,${buffer.toString('base64')}`
      } catch (err) {
        console.error('Failed to fetch generated image', err)
        imageDataUrl = generated.url
      }
    }

    assistantText = response.output_text || 'Image generated.'
  }

  try {
    await db.insert(projectMessages).values({
      id: crypto.randomUUID(),
      chatId,
      role: 'user',
      content: userMessage.content,
      createdBy: userId,
      createdAt: now,
    })

    await db.insert(projectMessages).values({
      id: crypto.randomUUID(),
      chatId,
      role: 'assistant',
      content: assistantText || 'No response.',
      rich: imageDataUrl
        ? {
            image: {
              dataUrl: imageDataUrl,
              prompt: userMessage.content,
            },
          }
        : undefined,
      createdAt: now,
    })

    await db
      .update(projectChats)
      .set({ updatedAt: now })
      .where(eq(projectChats.id, chatId))
  } catch (err) {
    console.error('Failed to persist project messages', err)
  }

  return { assistantText, imageDataUrl }
}
