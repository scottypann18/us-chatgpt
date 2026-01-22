import { NextResponse } from 'next/server'
import { ApiAuthError, requirePermission } from '@/app/api/_shared/auth'
import { sendProjectChatMessage } from '@/server/modules/projects/chat'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission('beta')
    const projectId = params.id
    const payload = await request.json().catch(() => ({}))

    const result = await sendProjectChatMessage({
      projectId,
      userId: user.id,
      chatId: payload?.chatId,
      messages: payload?.messages || [],
      webSearch: Boolean(payload?.webSearch),
    })

    return NextResponse.json({
      assistant: {
        content: result.assistantText,
        image: result.imageDataUrl || undefined,
      },
    })
  } catch (error) {
    console.error('Failed to send project chat message', error)
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    const status = error instanceof Error && 'status' in error ? (error as any).status : 500
    const message = error instanceof Error ? error.message : 'Failed to send message'
    return NextResponse.json({ error: message }, { status })
  }
}