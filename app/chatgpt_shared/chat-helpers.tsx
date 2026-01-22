import { type Components } from 'react-markdown'
import { type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export const markdownComponents: Components = {
  table: ({ children, className }) => (
    <div className="overflow-x-auto rounded-md border border-border/70">
      <table className={cn('w-full text-sm border-collapse', className)}>{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-border/70">{children}</tbody>,
  tr: ({ children }) => <tr className="even:bg-muted/30">{children}</tr>,
  th: ({ children }) => <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2 align-top text-sm">{children}</td>,
  code: ({ inline, children }: { inline?: boolean; children?: ReactNode }) => (
    <code className={cn('rounded bg-muted px-1.5 py-0.5 text-xs font-mono', inline ? '' : 'block whitespace-pre-wrap')}>
      {children}
    </code>
  ),
}

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const idx = bytes === 0 ? 0 : Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** idx
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[idx]}`
}

export const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Could not read file as data URL'))
      }
    }
    reader.onerror = () => reject(reader.error || new Error('File read failed'))
    reader.readAsDataURL(file)
  })
