import * as React from 'react'
import { cn } from '@/lib/utils/cn'

type DialogContextValue = {
  open: boolean
  onOpenChange?: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue>({ open: false })

export interface DialogProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export const Dialog = ({ open, onOpenChange, children }: DialogProps) => (
  <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>
)

export const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { open, onOpenChange } = React.useContext(DialogContext)

    if (!open) return null

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <button
          className="absolute inset-0 bg-black/50"
          aria-label="Close dialog"
          onClick={() => onOpenChange?.(false)}
        />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          className={cn(
            'relative z-10 w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-lg',
            className
          )}
          onClick={event => event.stopPropagation()}
          {...props}
        >
          {children}
        </div>
      </div>
    )
  }
)
DialogContent.displayName = 'DialogContent'

export const DialogHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
  )
)
DialogHeader.displayName = 'DialogHeader'

export const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
  )
)
DialogTitle.displayName = 'DialogTitle'