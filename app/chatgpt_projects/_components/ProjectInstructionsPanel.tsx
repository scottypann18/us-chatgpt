"use client"

import { useEffect, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'

interface ProjectDetail {
  id: string
  name: string
  instructions?: { instructions?: string | null; updatedAt?: string | null } | null
  fileCount: number
  chatCount: number
}

interface Props {
  projectId?: string
}

export function ProjectInstructionsPanel({ projectId }: Props) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [instructions, setInstructions] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!projectId) return
      setLoading(true)
      setError(null)
      setSuccess(null)
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to load project')
        }
        const data = await res.json()
        if (cancelled) return
        setProject({
          id: data.project.id,
          name: data.project.name,
          instructions: data.instructions,
          fileCount: data.fileCount,
          chatCount: data.chatCount,
        })
        setInstructions(data.instructions?.instructions || '')
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Failed to load project'
        setError(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const handleSave = async () => {
    if (!projectId) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/instructions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save instructions')
      }
      setSuccess('Instructions saved')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save instructions'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  if (!projectId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Project instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Select a project to edit instructions.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Project instructions</CardTitle>
          {project?.name && (
            <Input value={project.name} readOnly className="h-9 max-w-xs text-sm" />
          )}
        </div>
        {project && (
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>Files: {project.fileCount}</span>
            <span>Chats: {project.chatCount}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && <div className="text-sm text-destructive">{error}</div>}
        {success && <div className="text-sm text-emerald-600">{success}</div>}
        <Textarea
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          placeholder="e.g. Summarize our brand voice, keep replies concise, cite attached files first, avoid inventing data."
          className="min-h-40"
          disabled={loading || saving}
        />
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <div className="text-xs text-muted-foreground">Applied automatically to project chat.</div>
        <Button onClick={handleSave} disabled={saving || loading}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save instructions
        </Button>
      </CardFooter>
    </Card>
  )
}
