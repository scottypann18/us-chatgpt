import { projects } from '@/lib/db/schema'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
if (!OPENAI_API_KEY) {
  console.warn('[vector-store] OPENAI_API_KEY is not set; vector ingestion will fail until provided.')
}

const OPENAI_BASE_URL = 'https://api.openai.com/v1'

const headers = {
  Authorization: `Bearer ${OPENAI_API_KEY ?? ''}`,
}

const jsonHeaders = {
  ...headers,
  'Content-Type': 'application/json',
}

export const ensureProjectVectorStore = async (projectId: string, projectName: string): Promise<string> => {
  const [existing] = await db
    .select({ vectorStoreId: projects.vectorStoreId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (existing?.vectorStoreId) return existing.vectorStoreId

  const createRes = await fetch(`${OPENAI_BASE_URL}/vector_stores`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ name: `Project ${projectName} (${projectId})` }),
  })

  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => '')
    throw new Error(`Failed to create vector store: ${createRes.status} ${errText}`)
  }

  const data = (await createRes.json()) as { id: string }
  const vectorStoreId = data.id

  await db
    .update(projects)
    .set({ vectorStoreId })
    .where(eq(projects.id, projectId))

  return vectorStoreId
}

export const uploadFileToVectorStore = async (
  vectorStoreId: string,
  fileBuffer: Buffer | Uint8Array | ArrayBuffer,
  filename: string,
  mimeType?: string | null
): Promise<string> => {
  const uint8 = fileBuffer instanceof ArrayBuffer ? new Uint8Array(fileBuffer) : new Uint8Array(fileBuffer)

  const file = new File([uint8], filename, { type: mimeType || 'application/octet-stream' })

  const form = new FormData()
  form.append('file', file)
  form.append('purpose', 'assistants')

  const uploadRes = await fetch(`${OPENAI_BASE_URL}/files`, {
    method: 'POST',
    headers,
    body: form,
  })

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => '')
    throw new Error(`Failed to upload file to OpenAI: ${uploadRes.status} ${errText}`)
  }

  const uploadData = (await uploadRes.json()) as { id: string }
  const fileId = uploadData.id

  const linkRes = await fetch(`${OPENAI_BASE_URL}/vector_stores/${vectorStoreId}/files`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ file_id: fileId }),
  })

  if (!linkRes.ok) {
    const errText = await linkRes.text().catch(() => '')
    throw new Error(`Failed to attach file to vector store: ${linkRes.status} ${errText}`)
  }

  const linkData = (await linkRes.json()) as { id?: string; file_id?: string }
  return linkData.id || linkData.file_id || fileId
}

export const deleteFileFromVectorStore = async (vectorStoreId: string, vectorStoreFileId: string) => {
  const res = await fetch(`${OPENAI_BASE_URL}/vector_stores/${vectorStoreId}/files/${vectorStoreFileId}`, {
    method: 'DELETE',
    headers: jsonHeaders,
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.warn(`Failed to delete file from vector store: ${res.status} ${errText}`)
  }
}
