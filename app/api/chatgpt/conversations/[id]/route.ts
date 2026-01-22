// Beta-only endpoint to soft-delete a ChatGPT conversation; gated via shared permission helper.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, ApiAuthError } from '@/app/api/_shared/auth'
import { softDeleteConversation } from '@/server/modules/chatgpt/historic-conversations'
import { deleteConversationParamsSchema } from '@/server/modules/chatgpt/validation'

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('beta')

    const parsedParams = deleteConversationParamsSchema.safeParse(await context.params)
    if (!parsedParams.success) {
      const message = parsedParams.error.issues[0]?.message ?? 'Invalid parameters'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { id: conversationId } = parsedParams.data

    await softDeleteConversation(user.id, conversationId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to soft delete conversation', error)
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 })
  }
}
