import { NextResponse } from 'next/server'
import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projectFiles, projects } from '@/lib/db/schema'
import { ApiAuthError, requirePermission } from '@/app/api/_shared/auth'
import { deleteFileFromVectorStore, ensureProjectVectorStore, uploadFileToVectorStore } from '@/lib/services/openai/projectVectorStore'

const uploadsRoot = path.join(process.cwd(), 'public', 'uploads', 'project-files')

const ensureProjectAccess = async (projectId: string, userId: string) => {
  const [project] = await db
    .select({ id: projects.id, name: projects.name, vectorStoreId: projects.vectorStoreId })
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

    const files = await db
      .select({
        id: projectFiles.id,
        filename: projectFiles.filename,
        sizeBytes: projectFiles.sizeBytes,
        storageUrl: projectFiles.storageUrl,
        mimeType: projectFiles.mimeType,
        createdAt: projectFiles.createdAt,
      })
      .from(projectFiles)
      .where(and(eq(projectFiles.projectId, projectId), isNull(projectFiles.deletedAt)))

    return NextResponse.json({ files })
  } catch (error) {
    console.error('Failed to list files', error)
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission('beta')
    const projectId = params.id

    const project = await ensureProjectAccess(projectId, user.id)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const filename = file.name || 'upload'
    const fileId = crypto.randomUUID()
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const projectDir = path.join(uploadsRoot, projectId)
    await mkdir(projectDir, { recursive: true })

    const storedFilename = `${fileId}-${safeName}`
    const absolutePath = path.join(projectDir, storedFilename)
    await writeFile(absolutePath, Buffer.from(arrayBuffer))

    const storageUrl = `/uploads/project-files/${projectId}/${storedFilename}`

    let vectorStoreFileId: string | null = null
    try {
      const vectorStoreId = project.vectorStoreId || (await ensureProjectVectorStore(projectId, project.name))
      vectorStoreFileId = await uploadFileToVectorStore(vectorStoreId, Buffer.from(arrayBuffer), filename, file.type)
    } catch (err) {
      console.warn('Failed to upload file to vector store', err)
    }

    const now = new Date().toISOString()
    const [saved] = await db
      .insert(projectFiles)
      .values({
        id: fileId,
        projectId,
        filename,
        sizeBytes: file.size,
        mimeType: file.type || null,
        storageUrl,
        vectorStoreFileId: vectorStoreFileId || null,
        createdAt: now,
        createdBy: user.id,
      })
      .returning({
        id: projectFiles.id,
        filename: projectFiles.filename,
        sizeBytes: projectFiles.sizeBytes,
        storageUrl: projectFiles.storageUrl,
        mimeType: projectFiles.mimeType,
        createdAt: projectFiles.createdAt,
      })

    return NextResponse.json({ file: saved })
  } catch (error) {
    console.error('Failed to upload file', error)
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission('beta')
    const projectId = params.id
    const body = await request.json().catch(() => ({}))
    const fileId = String(body?.fileId || '').trim()

    if (!fileId) {
      return NextResponse.json({ error: 'File id is required' }, { status: 400 })
    }

    const project = await ensureProjectAccess(projectId, user.id)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const [fileRow] = await db
      .select({ id: projectFiles.id, vectorStoreFileId: projectFiles.vectorStoreFileId })
      .from(projectFiles)
      .where(and(eq(projectFiles.id, fileId), eq(projectFiles.projectId, projectId), isNull(projectFiles.deletedAt)))
      .limit(1)

    if (!fileRow) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    await db
      .update(projectFiles)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(projectFiles.id, fileId))

    if (fileRow.vectorStoreFileId && project.vectorStoreId) {
      await deleteFileFromVectorStore(project.vectorStoreId, fileRow.vectorStoreFileId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete file', error)
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}