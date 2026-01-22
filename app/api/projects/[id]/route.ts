import { NextResponse } from 'next/server'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projectChats, projectFiles, projectInstructions, projects } from '@/lib/db/schema'
import { ApiAuthError, requirePermission } from '@/app/api/_shared/auth'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission('beta')
    const projectId = params.id

    const [project] = await db
      .select({ id: projects.id, name: projects.name, icon: projects.icon, color: projects.color })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, user.id), isNull(projects.deletedAt)))
      .limit(1)

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const [instructions] = await db
      .select({ instructions: projectInstructions.instructions, updatedAt: projectInstructions.updatedAt })
      .from(projectInstructions)
      .where(eq(projectInstructions.projectId, projectId))
      .limit(1)

    const [fileCountRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(projectFiles)
      .where(and(eq(projectFiles.projectId, projectId), isNull(projectFiles.deletedAt)))

    const [chatCountRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(projectChats)
      .where(and(eq(projectChats.projectId, projectId), isNull(projectChats.deletedAt)))

    return NextResponse.json({
      project,
      instructions,
      fileCount: Number(fileCountRow?.count || 0),
      chatCount: Number(chatCountRow?.count || 0),
    })
  } catch (error) {
    console.error('Failed to fetch project', error)
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission('beta')
    const projectId = params.id
    const body = await request.json().catch(() => ({}))
    const name = String(body?.name || '').trim()

    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
    }

    const [project] = await db
      .update(projects)
      .set({ name, updatedAt: new Date().toISOString() })
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, user.id), isNull(projects.deletedAt)))
      .returning({ id: projects.id, name: projects.name, icon: projects.icon, color: projects.color })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Failed to update project', error)
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission('beta')
    const projectId = params.id

    const [project] = await db
      .update(projects)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, user.id), isNull(projects.deletedAt)))
      .returning({ id: projects.id })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete project', error)
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}