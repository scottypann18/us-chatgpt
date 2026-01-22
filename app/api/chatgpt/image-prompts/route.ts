// Beta-guarded endpoint to list and update ChatGPT image prompt templates; guarded via shared auth helper.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission, ApiAuthError } from '@/app/api/_shared/auth'
import {
  ImagePromptError,
  listImagePromptTemplates,
  updateImagePromptTemplate,
} from '@/server/modules/chatgpt/image-prompts'
import { updateImagePromptSchema } from '@/server/modules/chatgpt/validation'

export async function GET() {
  try {
    await requirePermission('beta')

    const templates = await listImagePromptTemplates()
    return NextResponse.json({ success: true, templates })
  } catch (err) {
    console.error('Failed to list image prompt templates', err)
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status })
    }
    if (err instanceof ImagePromptError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status })
    }
    return NextResponse.json({ success: false, error: 'Failed to load templates' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    await requirePermission('beta')

    const parsedBody = updateImagePromptSchema.safeParse(await req.json())
    if (!parsedBody.success) {
      const message = parsedBody.error.issues[0]?.message ?? 'Invalid payload'
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const template = await updateImagePromptTemplate(parsedBody.data)
    return NextResponse.json({ success: true, template })
  } catch (err) {
    console.error('Failed to update image prompt template', err)
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status })
    }
    return NextResponse.json({ success: false, error: 'Failed to update template' }, { status: 500 })
  }
}
