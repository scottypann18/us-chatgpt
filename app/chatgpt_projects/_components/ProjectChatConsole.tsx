'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Plus, Info, Folder, MessageSquare, RefreshCw, Trash2, Pencil } from 'lucide-react'
import { ProjectInstructionsPanel } from './ProjectInstructionsPanel'
import { ProjectChatThread } from './ProjectChatThread'

// Removed unused projectChatTypes

const formatBytes = (bytes?: number | null) => {
  if (!bytes || Number.isNaN(bytes)) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, idx)
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[idx]}`
}

type Project = {
  id: string
  name: string
  icon?: string | null
  color?: string | null
}

type ProjectChat = {
  id: string
  title: string
  updatedAt?: string
}

interface Props {
  user: { id: string; displayName?: string | null; primaryEmail?: string | null }
  projectId?: string
}

export function ProjectChatConsole({ user, projectId: initialProjectId }: Props) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createName, setCreateName] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(initialProjectId)
  const [error, setError] = useState<string | null>(null)
  const [instructionsOpen, setInstructionsOpen] = useState(false)
  const [filesOpen, setFilesOpen] = useState(false)
  const [chats, setChats] = useState<ProjectChat[]>([])
  const [loadingChats, setLoadingChats] = useState(false)
  const [chatsError, setChatsError] = useState<string | null>(null)
  const [newChatTitle, setNewChatTitle] = useState('')
  const [creatingChat, setCreatingChat] = useState(false)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [renameChatId, setRenameChatId] = useState<string | null>(null)
  const [renameChatTitle, setRenameChatTitle] = useState('')
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [renamingChat, setRenamingChat] = useState(false)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [files, setFiles] = useState<Array<{ id: string; filename: string; sizeBytes?: number | null; storageUrl: string; mimeType?: string | null; createdAt?: string | null }>>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [filesError, setFilesError] = useState<string | null>(null)
  const [fileUploading, setFileUploading] = useState(false)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadingProjects(true)
      setError(null)
      try {
        const res = await fetch('/api/projects')
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to load projects')
        }
        const data = await res.json()
        if (cancelled) return
        setProjects(data.projects || [])
        if (!selectedProjectId) {
          setSelectedProjectId(data.projects?.[0]?.id)
        }
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load projects')
      } finally {
        if (!cancelled) setLoadingProjects(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [selectedProjectId])

  useEffect(() => {
    let cancelled = false
    const loadChats = async (projectId: string) => {
      setLoadingChats(true)
      setChatsError(null)
      try {
        const res = await fetch(`/api/projects/${projectId}/chats`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to load chats')
        }
        const data = await res.json()
        if (cancelled) return
        setChats(data.chats || [])
        setActiveChatId(prev => prev || data.chats?.[0]?.id || null)
      } catch (err) {
        if (cancelled) return
        setChatsError(err instanceof Error ? err.message : 'Failed to load chats')
        setChats([])
        setActiveChatId(null)
      } finally {
        if (!cancelled) setLoadingChats(false)
      }
    }

    if (selectedProjectId) {
      loadChats(selectedProjectId)
    } else {
      setChats([])
      setActiveChatId(null)
    }

    return () => {
      cancelled = true
    }
  }, [selectedProjectId])

  useEffect(() => {
    setRenameChatId(null)
    setRenameChatTitle('')
    setRenameDialogOpen(false)
  }, [selectedProjectId])

  const refreshChats = () => {
    if (!selectedProjectId) return
    setActiveChatId(prev => prev) // no-op but keeps state update path predictable
    setLoadingChats(true)
    setChatsError(null)
    fetch(`/api/projects/${selectedProjectId}/chats`)
      .then(async res => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to load chats')
        }
        return res.json()
      })
      .then(data => {
        setChats(data.chats || [])
        setActiveChatId(prev => prev || data.chats?.[0]?.id || null)
      })
      .catch(err => {
        setChatsError(err instanceof Error ? err.message : 'Failed to load chats')
      })
      .finally(() => setLoadingChats(false))
  }

  const loadFiles = async (projectId: string) => {
    setFilesLoading(true)
    setFilesError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/files`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to load files')
      }
      const data = await res.json()
      setFiles(data.files || [])
    } catch (err) {
      setFilesError(err instanceof Error ? err.message : 'Failed to load files')
      setFiles([])
    } finally {
      setFilesLoading(false)
    }
  }

  const handleUploadFile = async (projectId: string, file: File) => {
    setFileUploading(true)
    setFilesError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/projects/${projectId}/files`, { method: 'POST', body: form })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Upload failed')
      }
      const data = await res.json()
      if (data.file) {
        setFiles(prev => [...prev, data.file])
      }
    } catch (err) {
      setFilesError(err instanceof Error ? err.message : 'Failed to upload file')
    } finally {
      setFileUploading(false)
    }
  }

  const handleDeleteFile = async (projectId: string, fileId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Delete failed')
      }
      setFiles(prev => prev.filter(f => f.id !== fileId))
    } catch (err) {
      setFilesError(err instanceof Error ? err.message : 'Failed to delete file')
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    const confirmed = typeof window !== 'undefined' ? window.confirm('Delete this project? Chats will be hidden but not permanently removed.') : true
    if (!confirmed) return
    setDeletingProjectId(projectId)
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete project')
      }
      setProjects(prev => prev.filter(p => p.id !== projectId))
      if (selectedProjectId === projectId) {
        setSelectedProjectId(undefined)
        setChats([])
        setActiveChatId(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project')
    } finally {
      setDeletingProjectId(null)
    }
  }

  const handleRenameProject = async (projectId: string) => {
    const trimmed = editingName.trim()
    if (!trimmed) return
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to rename project')
      }
      const data = await res.json()
      setProjects(prev => prev.map(p => (p.id === projectId ? { ...p, name: data.project.name } : p)))
      setEditingProjectId(null)
      setEditingName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename project')
    }
  }

  const handleDeleteChat = async (chatId: string) => {
    if (!selectedProjectId) return
    const confirmed = typeof window !== 'undefined' ? window.confirm('Delete this chat? Messages will be hidden but not permanently removed.') : true
    if (!confirmed) return
    setDeletingChatId(chatId)
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/chats`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete chat')
      }
      setChats(prev => prev.filter(c => c.id !== chatId))
      if (activeChatId === chatId) {
        setActiveChatId(null)
      }
    } catch (err) {
      setChatsError(err instanceof Error ? err.message : 'Failed to delete chat')
    } finally {
      setDeletingChatId(null)
    }
  }

  const handleCreateChat = async () => {
    if (!selectedProjectId) return
    const title = newChatTitle.trim() || 'New chat'
    setCreatingChat(true)
    setChatsError(null)
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create chat')
      }
      const data = await res.json()
      if (!data.chat) throw new Error('Chat response missing')
      setChats(prev => [data.chat, ...prev])
      setActiveChatId(data.chat.id)
      setNewChatTitle('')
    } catch (err) {
      setChatsError(err instanceof Error ? err.message : 'Failed to create chat')
    } finally {
      setCreatingChat(false)
    }
  }

  const handleRenameChat = async (chatId?: string) => {
    const targetId = chatId || renameChatId
    if (!selectedProjectId || !targetId) return
    const trimmed = renameChatTitle.trim()
    if (!trimmed) return
    setRenamingChat(true)
    setChatsError(null)
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/chats`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: targetId, title: trimmed }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to rename chat')
      }
      const data = await res.json()
      setChats(prev => prev.map(c => (c.id === targetId ? { ...c, title: data.chat.title, updatedAt: data.chat.updatedAt } : c)))
      setRenameChatId(null)
      setRenameChatTitle('')
      setRenameDialogOpen(false)
    } catch (err) {
      setChatsError(err instanceof Error ? err.message : 'Failed to rename chat')
    }
    setRenamingChat(false)
  }

  const handleCreate = async () => {
    const name = createName.trim()
    if (!name) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create project')
      }
      const data = await res.json()
      setProjects(prev => [data.project, ...prev])
      setSelectedProjectId(data.project.id)
      setCreateName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  const selectedProject = useMemo(
    () => projects.find(p => p.id === selectedProjectId),
    [projects, selectedProjectId]
  )

  useEffect(() => {
    if (filesOpen && selectedProjectId) {
      void loadFiles(selectedProjectId)
    }
  }, [filesOpen, selectedProjectId])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
      <aside className="space-y-3">
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="New project name"
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleCreate()
                  }
                }}
                disabled={creating}
              />
              <Button onClick={handleCreate} disabled={creating || !createName.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
            {error && <div className="text-sm text-destructive">{error}</div>}
            <div className="space-y-1 max-h-[70vh] overflow-y-auto">
              {loadingProjects && <div className="text-sm text-muted-foreground">Loading projects...</div>}
              {!loadingProjects && projects.length === 0 && (
                <div className="text-sm text-muted-foreground">No projects yet. Create one to start chatting.</div>
              )}
              {projects.map(project => {
                const isActive = project.id === selectedProjectId
                const isEditing = editingProjectId === project.id
                return (
                  <div
                    key={project.id}
                    className={`w-full flex items-center gap-2 rounded border px-3 py-2 text-left text-sm hover:bg-muted ${
                      isActive ? 'border-primary bg-muted' : 'border-border'
                    }`}
                  >
                    <button
                      className="flex-1 flex items-center gap-2 text-left focus:outline-none"
                      onClick={() => {
                        setSelectedProjectId(project.id)
                        if (!isEditing) {
                          setEditingProjectId(null)
                          setEditingName('')
                        }
                      }}
                    >
                      <Folder className="h-4 w-4" />
                      {isEditing ? (
                        <Input
                          autoFocus
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              void handleRenameProject(project.id)
                            }
                            if (e.key === 'Escape') {
                              setEditingProjectId(null)
                              setEditingName('')
                            }
                          }}
                        />
                      ) : (
                        <span className="truncate">{project.name}</span>
                      )}
                    </button>
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          aria-label="Save project name"
                          onClick={() => void handleRenameProject(project.id)}
                          disabled={!editingName.trim()}
                        >
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Cancel edit"
                          onClick={() => {
                            setEditingProjectId(null)
                            setEditingName('')
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit project"
                          onClick={e => {
                            e.stopPropagation()
                            setEditingProjectId(project.id)
                            setEditingName(project.name)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:text-red-700"
                          aria-label="Delete project"
                          onClick={e => {
                            e.stopPropagation()
                            void handleDeleteProject(project.id)
                          }}
                          disabled={deletingProjectId === project.id}
                        >
                          {deletingProjectId === project.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>
              {selectedProject ? `Chats in ${selectedProject.name}` : 'Chats'}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="New chat title"
                value={newChatTitle}
                onChange={e => setNewChatTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleCreateChat()
                  }
                }}
                disabled={!selectedProjectId || creatingChat}
                className="w-44"
              />
              <Button
                size="icon"
                onClick={() => void handleCreateChat()}
                disabled={!selectedProjectId || creatingChat}
                aria-label="Create chat"
              >
                {creatingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={refreshChats} disabled={!selectedProjectId || loadingChats} aria-label="Refresh chats">
                {loadingChats ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {!selectedProjectId && <div className="text-sm text-muted-foreground">Select a project to view chats.</div>}
            {selectedProjectId && chatsError && <div className="text-sm text-destructive">{chatsError}</div>}
            {selectedProjectId && !chatsError && chats.length === 0 && !loadingChats && (
              <div className="text-sm text-muted-foreground">No chats yet. Send a message to start one.</div>
            )}
            <div className="space-y-1 max-h-[50vh] overflow-y-auto">
              {chats.map(chat => {
                const isActive = chat.id === activeChatId
                return (
                  <div
                    key={chat.id}
                    role="button"
                    tabIndex={0}
                    className={`w-full flex items-center gap-2 rounded border px-3 py-2 text-left text-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                      isActive ? 'border-primary bg-muted' : 'border-border'
                    }`}
                    onClick={() => setActiveChatId(chat.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setActiveChatId(chat.id)
                      }
                    }}
                  >
                    <MessageSquare className="h-4 w-4" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{chat.title || 'Project chat'}</div>
                      {chat.updatedAt && (
                        <div className="text-xs text-muted-foreground">Updated {new Date(chat.updatedAt).toLocaleString()}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit chat title"
                        onClick={e => {
                          e.stopPropagation()
                          setRenameChatId(chat.id)
                          setRenameChatTitle(chat.title || '')
                          setRenameDialogOpen(true)
                        }}
                        disabled={deletingChatId === chat.id}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:text-red-700"
                        aria-label="Delete chat"
                        onClick={e => {
                          e.stopPropagation()
                          void handleDeleteChat(chat.id)
                        }}
                        disabled={deletingChatId === chat.id}
                      >
                        {deletingChatId === chat.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </aside>

      <section className="space-y-4">
        <div className="rounded-lg border border-amber-200/80 bg-amber-50 p-4 shadow-sm">
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-xl font-semibold">
                {selectedProject ? selectedProject.name : 'Select a project'}
              </h2>
              <p className="text-sm text-muted-foreground">Project chat is scoped to the selected project.</p>
            </div>
            {selectedProject && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  className="shadow-md shadow-primary/20"
                  onClick={() => setFilesOpen(true)}
                >
                  Manage files
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="shadow-md shadow-primary/20"
                  onClick={() => setInstructionsOpen(true)}
                >
                  <Info className="h-4 w-4 mr-2" />
                  Set project instructions
                </Button>
              </div>
            )}
          </div>
        </div>

        {selectedProject ? (
          <ProjectChatThread
            user={user}
            projectId={selectedProject.id}
            chatId={activeChatId}
            onChatUpdated={refreshChats}
          />
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">Select or create a project to start chatting.</CardContent>
          </Card>
        )}
      </section>

      <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Project instructions</DialogTitle>
          </DialogHeader>
          {selectedProject && <ProjectInstructionsPanel projectId={selectedProject.id} />}
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialogOpen} onOpenChange={open => {
        setRenameDialogOpen(open)
        if (!open) {
          setRenameChatId(null)
          setRenameChatTitle('')
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              autoFocus
              value={renameChatTitle}
              onChange={e => setRenameChatTitle(e.target.value)}
              placeholder="Chat title"
              disabled={renamingChat}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleRenameChat()
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => {
                setRenameDialogOpen(false)
                setRenameChatId(null)
                setRenameChatTitle('')
              }} disabled={renamingChat}>
                Cancel
              </Button>
              <Button onClick={() => void handleRenameChat()} disabled={!renameChatTitle.trim() || renamingChat}>
                {renamingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={filesOpen} onOpenChange={open => {
        setFilesOpen(open)
        if (open && selectedProject?.id) {
          void loadFiles(selectedProject.id)
        }
      }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Project files</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {filesError && <div className="text-sm text-destructive">{filesError}</div>}

            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
              <div className="flex-1">
                <div className="text-sm font-medium">Upload files</div>
                  <div className="text-xs text-muted-foreground">
                    Add reference docs; they’ll be searchable in this project’s chat. Images are not accepted here—upload text-friendly formats (PDF, TXT, MD, DOCX, PPTX, HTML, CSV/TSV, JSON, code).
                  </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={fileUploading || filesLoading || !selectedProject}
                  onClick={() => uploadInputRef.current?.click()}
                >
                  {fileUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Choose file'}
                </Button>
                <Input
                  ref={uploadInputRef}
                  type="file"
                  className="hidden"
                    accept=".txt,.md,.markdown,.pdf,.doc,.docx,.ppt,.pptx,.html,.htm,.xml,.csv,.tsv,.json,.js,.ts,.tsx,.py,.java,.c,.cpp,.cs,.go,.rb,.php"
                  disabled={fileUploading || filesLoading || !selectedProject}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file && selectedProject?.id) {
                      void handleUploadFile(selectedProject.id, file)
                      e.target.value = ''
                    }
                  }}
                />
              </div>
            </div>

            <div className="rounded-lg border">
              <div className="grid grid-cols-[1fr_110px_140px_48px] items-center px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                <span>File</span>
                <span className="text-right">Size</span>
                <span className="text-right">Type</span>
                <span className="sr-only">Actions</span>
              </div>
              <div className="max-h-[50vh] overflow-y-auto divide-y">
                {filesLoading && <div className="p-4 text-sm text-muted-foreground">Loading files...</div>}
                {!filesLoading && files.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground">No files uploaded yet.</div>
                )}
                {files.map(file => (
                  <div key={file.id} className="grid grid-cols-[1fr_110px_140px_48px] items-center px-4 py-3 gap-3 hover:bg-muted/60">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{file.filename}</div>
                      <div className="text-xs text-muted-foreground">
                        {file.createdAt ? `Uploaded ${new Date(file.createdAt).toLocaleString()}` : 'Uploaded'}
                        {' • '}
                        <a className="underline" href={file.storageUrl} target="_blank" rel="noreferrer">
                          Open in new tab
                        </a>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground text-right">{formatBytes(file.sizeBytes) || '—'}</div>
                    <div className="text-xs text-muted-foreground text-right truncate">{file.mimeType || '—'}</div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700"
                      aria-label="Delete file"
                      onClick={() => selectedProject && void handleDeleteFile(selectedProject.id, file.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
