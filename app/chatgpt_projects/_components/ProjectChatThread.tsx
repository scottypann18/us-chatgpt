'use client'

import { ChangeEvent, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'
import { Download, Loader2, Paperclip } from 'lucide-react'
import { formatBytes, markdownComponents, readFileAsDataUrl } from '@/app/chatgpt_shared/chat-helpers'

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  chatTypeId: 'project-chat'
  createdAt: number
  rich?: {
    citations?: Array<{ title?: string; url?: string; snippet?: string }>
    image?: { dataUrl: string; prompt: string; responseId?: string }
    attachment?: { name: string; size: number; type?: string }
  }
}

interface Props {
  user: { id: string; displayName?: string | null; primaryEmail?: string | null }
  projectId: string
  chatId: string | null
  onChatUpdated?: () => void
}

const mapServerMessage = (msg: any): Message => ({
  id: msg.id || crypto.randomUUID(),
  role: msg.role === 'user' ? 'user' : 'assistant',
  content: msg.content || '',
  chatTypeId: 'project-chat',
  createdAt: new Date(msg.createdAt ?? Date.now()).getTime(),
  rich: msg.rich || undefined,
})

export function ProjectChatThread({ user, projectId, chatId, onChatUpdated }: Props): ReactElement {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attachment, setAttachment] = useState<{ name: string; size: number; type: string; dataUrl: string } | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [isReadingAttachment, setIsReadingAttachment] = useState(false)
  const [useWebSearch, setUseWebSearch] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const activeTitle = useMemo(() => messages[0]?.content?.slice(0, 50) || 'Project chat', [messages])

  useEffect(() => {
    if (!projectId || !chatId) {
      setMessages([])
      return
    }

    let cancelled = false
    const load = async () => {
      setLoadingMessages(true)
      setError(null)
      try {
        const res = await fetch(`/api/projects/${projectId}/chats`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to load chat messages')
        }
        const data = await res.json()
        if (cancelled) return
        const chat = (data.chats || []).find((c: any) => c.id === chatId)
        if (!chat) {
          setMessages([])
          return
        }
        const mapped = (chat.messages || []).map(mapServerMessage)
        setMessages(mapped)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load chat messages')
        setMessages([])
      } finally {
        if (!cancelled) setLoadingMessages(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [projectId, chatId])

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages.length])

  const handleAttachmentChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setAttachmentError('Project Chat only accepts images for vision (JPG, PNG, WEBP, GIF).')
      setAttachment(null)
      event.target.value = ''
      return
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setAttachmentError('File is too large (max 5MB).')
      setAttachment(null)
      return
    }

    setAttachmentError(null)
    setIsReadingAttachment(true)
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setAttachment({ name: file.name, size: file.size, type: file.type || 'application/octet-stream', dataUrl })
      event.target.value = ''
    } catch (err) {
      setAttachmentError(err instanceof Error ? err.message : 'Unable to read file')
      setAttachment(null)
    } finally {
      setIsReadingAttachment(false)
    }
  }

  const clearAttachment = () => {
    setAttachment(null)
    setAttachmentError(null)
    setIsReadingAttachment(false)
  }

  const handleSend = async () => {
    if (!projectId || !chatId) {
      setError('Select or create a project chat before sending a message.')
      return
    }
    if (!input.trim()) return
    if (isReadingAttachment) {
      setError('Please wait for the file to finish loading.')
      return
    }

    setIsSending(true)
    setError(null)

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      chatTypeId: 'project-chat',
      createdAt: Date.now(),
      rich: attachment ? { attachment: { name: attachment.name, size: attachment.size, type: attachment.type } } : undefined,
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
      const payload: any = {
        chatId,
        messages: history,
        webSearch: useWebSearch,
      }
      if (attachment) {
        payload.image = {
          name: attachment.name,
          mimeType: attachment.type,
          size: attachment.size,
          dataUrl: attachment.dataUrl,
        }
      }

      const res = await fetch(`/api/projects/${projectId}/chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data as any).error || 'Request failed')
      }

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          (data as any)?.assistant?.content ||
          (data as any)?.assistant?.text ||
          (data as any)?.assistant?.message ||
          (data as any)?.answer ||
          'No response.',
        chatTypeId: 'project-chat',
        createdAt: Date.now(),
        rich: (data as any)?.assistant?.image
          ? {
              image: {
                dataUrl: (data as any).assistant.image,
                prompt: userMsg.content,
                responseId: (data as any).assistant.responseId,
              },
            }
          : undefined,
      }

      setMessages(prev => [...prev, assistantMsg])
      clearAttachment()
      onChatUpdated?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${message}`, chatTypeId: 'project-chat', createdAt: Date.now() }])
    } finally {
      setIsSending(false)
    }
  }

  const messageList = useMemo(() => messages, [messages])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Chat</CardTitle>
        <p className="text-sm text-muted-foreground">Scoped to this project. Images allowed for vision.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div ref={scrollRef} className="h-[55vh] overflow-y-auto rounded border p-3 bg-muted/40">
          {loadingMessages && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading conversation…</span>
            </div>
          )}
          {!loadingMessages && messageList.length === 0 && (
            <p className="text-sm text-muted-foreground">No messages yet. Start by sending a prompt.</p>
          )}
          {messageList.map(msg => {
            const isUser = msg.role === 'user'
            return (
              <div key={msg.id} className={cn('mb-3 flex', isUser ? 'justify-end text-right' : 'justify-start text-left')}>
                <div className="max-w-[80%]">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">
                    {isUser ? user.displayName || 'You' : 'Assistant'}
                  </div>
                  <div
                    className={cn(
                      'text-sm rounded p-3 border shadow-sm',
                      isUser ? 'bg-primary text-primary-foreground border-primary/70' : 'bg-background border-muted'
                    )}
                  >
                    <div className="prose prose-sm max-w-none prose-headings:mt-3 prose-headings:mb-1 prose-p:my-2 prose-p:leading-[1.2] prose-li:my-1 prose-code:text-xs prose-a:underline prose-a:text-primary prose-ul:my-2 prose-ol:my-2 leading-[1.2]">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    {isUser && msg.rich?.attachment && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Attached file: {msg.rich.attachment.name} ({formatBytes(msg.rich.attachment.size)})
                      </div>
                    )}
                    {!isUser && msg.rich?.citations && (
                      <div className="mt-3 space-y-2 text-left">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Citations</div>
                        {msg.rich.citations.map((c, idx) => (
                          <div key={idx} className="rounded border bg-muted/30 p-3 text-left space-y-1">
                            {c.title && <div className="text-sm font-semibold truncate" title={c.title}>{c.title}</div>}
                            {c.url && (
                              <a href={c.url} target="_blank" rel="noreferrer" className="text-sm text-primary underline break-all">
                                {c.url}
                              </a>
                            )}
                            {c.snippet && <p className="text-sm text-muted-foreground leading-relaxed">{c.snippet}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                    {!isUser && msg.rich?.image && (
                      <div className="mt-3 space-y-2 text-left">
                        <img
                          src={msg.rich.image.dataUrl}
                          alt={msg.rich.image.prompt}
                          className="w-full max-h-72 object-cover rounded border"
                        />
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Prompt: <span className="font-medium text-foreground">{msg.rich.image.prompt}</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" asChild className="gap-1">
                            <a href={msg.rich.image.dataUrl} download={`project-image-${msg.id}.png`}>
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </a>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {isSending && (
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Working on a reply…</span>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="space-y-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type your message…"
            rows={4}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (!isSending && !isReadingAttachment && input.trim()) {
                  void handleSend()
                }
              }
            }}
          />
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleAttachmentChange}
              disabled={isSending || isReadingAttachment}
              className="hidden"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending || isReadingAttachment}
              title="Attach an image for vision (JPG, PNG, WEBP, GIF — max 5MB)"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button onClick={handleSend} disabled={isSending || isReadingAttachment || !input.trim()} className="flex items-center gap-2">
              {isSending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSending ? 'Sending…' : 'Send'}
            </Button>
            <Input className="hidden" aria-hidden tabIndex={-1} value={activeTitle} onChange={() => {}} />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              id="project-chat-web-search"
              checked={useWebSearch}
              onCheckedChange={checked => setUseWebSearch(Boolean(checked))}
            />
            <Label htmlFor="project-chat-web-search" className="text-xs font-medium text-foreground">
              Use web search
            </Label>
            <span>(slower; enables live web results)</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {attachment ? (
              <>
                <span className="font-semibold text-foreground">{attachment.name}</span>
                <span>({formatBytes(attachment.size)})</span>
                {attachment.type && <span className="uppercase tracking-wide">{attachment.type}</span>}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={clearAttachment}
                >
                  Remove
                </Button>
              </>
            ) : (
              <span>Attach an image for vision (JPG, PNG, WEBP, GIF — max 5MB).</span>
            )}
            {isReadingAttachment && <span>Loading file…</span>}
            {attachmentError && <span className="text-red-600">{attachmentError}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
