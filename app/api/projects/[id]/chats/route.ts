import { NextResponse } from 'next/server'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projectChats, projectMessages, projects } from '@/lib/db/schema'
import { ApiAuthError, requirePermission } from '@/app/api/_shared/auth'

const ensureProjectAccess = async (projectId: string, userId: string) => {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId), isNull(projects.deletedAt)))
    .limit(1)

  return project
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission('beta')
    const projectId = params.id

    const project = await ensureProjectAccess(projectId, user.id)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const chats = await db
      .select({ id: projectChats.id, title: projectChats.title, updatedAt: projectChats.updatedAt })
      .from(projectChats)
      .where(and(eq(projectChats.projectId, projectId), isNull(projectChats.deletedAt)))
      .orderBy(desc(projectChats.updatedAt))

    const chatIds = chats.map(chat => chat.id)

    let messages: Array<{ chatId: string; id: string; role: string; content: string; createdAt: string; rich: unknown }> = []
    if (chatIds.length > 0) {
      messages = await db
        .select({
          chatId: projectMessages.chatId,
          id: projectMessages.id,
          role: projectMessages.role,
          content: projectMessages.content,
          createdAt: projectMessages.createdAt,
          rich: projectMessages.rich,
        })
        .from(projectMessages)
        .where(inArray(projectMessages.chatId, chatIds))
        .orderBy(desc(projectMessages.createdAt))
    }

    const messagesByChat = messages.reduce<Record<string, typeof messages>>( (acc, msg) => {
      acc[msg.chatId] = acc[msg.chatId] || []
      acc[msg.chatId].push(msg)
      return acc
    }, {})

    const responseChats = chats.map(chat => ({
      ...chat,
      messages: (messagesByChat[chat.id] || []).map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
        rich: msg.rich,
      })).reverse(),
    }))

    return NextResponse.json({ chats: responseChats })
  } catch (error) {
    console.error('Failed to list chats', error)
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to list chats' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission('beta')
    const projectId = params.id
    const body = await request.json().catch(() => ({}))
    const title = String(body?.title || 'New chat').trim() || 'New chat'

    const project = await ensureProjectAccess(projectId, user.id)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const now = new Date().toISOString()
    const [chat] = await db
      .insert(projectChats)
      .values({ id: crypto.randomUUID(), projectId, title, createdBy: user.id, createdAt: now, updatedAt: now })
      .returning({ id: projectChats.id, title: projectChats.title, updatedAt: projectChats.updatedAt })

    return NextResponse.json({ chat })
  } catch (error) {
    console.error('Failed to create chat', error)
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission('beta')
    const projectId = params.id
    const body = await request.json().catch(() => ({}))
    const chatId = String(body?.chatId || '').trim()
    const title = String(body?.title || '').trim()

    if (!chatId || !title) {
      return NextResponse.json({ error: 'Chat id and title are required' }, { status: 400 })
    }

    const project = await ensureProjectAccess(projectId, user.id)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const [chat] = await db
      .update(projectChats)
      .set({ title, updatedAt: new Date().toISOString() })
      .where(and(eq(projectChats.id, chatId), eq(projectChats.projectId, projectId), isNull(projectChats.deletedAt)))
      .returning({ id: projectChats.id, title: projectChats.title, updatedAt: projectChats.updatedAt })

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    return NextResponse.json({ chat })
  } catch (error) {
    console.error('Failed to rename chat', error)
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to rename chat' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission('beta')
    const projectId = params.id
    const body = await request.json().catch(() => ({}))
    const chatId = String(body?.chatId || '').trim()

    if (!chatId) {
      return NextResponse.json({ error: 'Chat id is required' }, { status: 400 })
    }

    const project = await ensureProjectAccess(projectId, user.id)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const [chat] = await db
      .update(projectChats)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(and(eq(projectChats.id, chatId), eq(projectChats.projectId, projectId), isNull(projectChats.deletedAt)))
      .returning({ id: projectChats.id })

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete chat', error)
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to delete chat' }, { status: 500 })
  }
}