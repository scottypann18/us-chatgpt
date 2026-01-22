import { NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projectInstructions, projects } from '@/lib/db/schema'
import { ApiAuthError, requirePermission } from '@/app/api/_shared/auth'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission('beta')
    const projectId = params.id
    const body = await request.json().catch(() => ({}))
    const instructions = String(body?.instructions ?? '')

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, user.id), isNull(projects.deletedAt)))
      .limit(1)

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const now = new Date().toISOString()

    await db
      .insert(projectInstructions)
      .values({ projectId, instructions, updatedAt: now, updatedBy: user.id })
      .onConflictDoUpdate({
        target: projectInstructions.projectId,
        set: { instructions, updatedAt: now, updatedBy: user.id },
      })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update project instructions', error)
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to update instructions' }, { status: 500 })
  }
}