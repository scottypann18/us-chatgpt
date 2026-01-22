// Beta-only endpoint to process ChatGPT message requests; guarded via shared permission helper.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, ApiAuthError } from '@/app/api/_shared/auth'
import { handleChatgptPost, type ChatgptUser, type ChatgptResult } from '@/server/modules/chatgpt'
import { chatgptPostBodySchema } from '@/server/modules/chatgpt/validation'

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('beta')
    const parsedBody = chatgptPostBodySchema.safeParse(await req.json())
    if (!parsedBody.success) {
      const message = parsedBody.error.issues[0]?.message ?? 'Invalid payload'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const body = parsedBody.data

    const fmUser: ChatgptUser = {
      id: user.id,
      primaryEmail: (user as any)?.primaryEmail,
      displayName: (user as any)?.displayName,
    }

    const result = await handleChatgptPost(body, fmUser)
    return toNextResponse(result)
  } catch (error) {
    console.error('Failed to handle chatgpt/messages POST', error)
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}

function toNextResponse(result: ChatgptResult) {
  if (result.type === 'text') {
    return new NextResponse(result.body, {
      status: result.status ?? 200,
      headers: { 'Content-Type': result.contentType ?? 'text/plain; charset=utf-8' },
    })
  }
  return NextResponse.json(result.body, { status: result.status ?? 200 })
}
