// Beta-only endpoint to list a user's ChatGPT conversations; gated via shared permission helper.
import { NextResponse } from 'next/server'
import { requirePermission, ApiAuthError } from '@/app/api/_shared/auth'
import { listUserConversations } from '@/server/modules/chatgpt/historic-conversations'
import { listUserConversationsParamsSchema } from '@/server/modules/chatgpt/validation'

export async function GET() {
  try {
    const user = await requirePermission('beta')

    const parsed = listUserConversationsParamsSchema.safeParse({ userId: user.id })
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid parameters'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const conversations = await listUserConversations(parsed.data.userId)

    return NextResponse.json({ conversations })
  } catch (error) {
    console.error('Failed to fetch chat conversations', error)
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
  }
}
