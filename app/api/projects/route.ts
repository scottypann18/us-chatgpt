import { NextResponse } from 'next/server'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { ApiAuthError, requirePermission } from '@/app/api/_shared/auth'

export async function GET() {
  try {
    const user = await requirePermission('beta')

    const rows = await db
      .select({ id: projects.id, name: projects.name, icon: projects.icon, color: projects.color })
      .from(projects)
      .where(and(eq(projects.ownerId, user.id), isNull(projects.deletedAt)))
      .orderBy(desc(projects.updatedAt))

    return NextResponse.json({ projects: rows })
  } catch (error) {
    console.error('Failed to list projects', error)
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to list projects' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission('beta')
    const body = await request.json().catch(() => ({}))
    const name = String(body?.name || '').trim()

    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const [project] = await db
      .insert(projects)
      .values({
        id: crypto.randomUUID(),
        ownerId: user.id,
        name,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: projects.id, name: projects.name, icon: projects.icon, color: projects.color })

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Failed to create project', error)
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}