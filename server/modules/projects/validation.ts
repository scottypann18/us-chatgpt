import { z } from 'zod'

export const projectChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
})

export const projectChatPayloadSchema = z.object({
  chatId: z.string().uuid(),
  messages: z.array(projectChatMessageSchema).min(1, 'At least one message is required'),
  webSearch: z.boolean().optional(),
})

export const projectChatRequestSchema = projectChatPayloadSchema.extend({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
})

export type ProjectChatMessage = z.infer<typeof projectChatMessageSchema>
export type ProjectChatPayload = z.infer<typeof projectChatPayloadSchema>
export type ProjectChatRequest = z.infer<typeof projectChatRequestSchema>
