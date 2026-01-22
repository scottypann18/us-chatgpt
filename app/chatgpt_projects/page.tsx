import { redirect } from 'next/navigation'
import { stackServerApp } from '@/lib/services/stack-auth'
import { ProjectChatConsole } from './_components/ProjectChatConsole'

export default async function ChatGptProjectsPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string }>
}) {
  const user = await stackServerApp.getUser()

  if (!user) {
    redirect('/handler/sign-in')
  }

  const hasBeta = await user.hasPermission('beta')
  if (!hasBeta) {
    redirect('/')
  }

  const userData = {
    id: user.id,
    displayName: user.displayName,
    primaryEmail: user.primaryEmail,
  }

  const { projectId } = (await searchParams) ?? {}

  return (
    <main className="flex flex-col gap-6 w-screen max-w-[100vw] -mx-[calc((100vw-100%)/2)] px-4 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">OpenAI Console</h1>
          <p className="text-sm text-muted-foreground">
            Beta-only chat with OpenAI tools. Choose a chat type, converse, and reuse your recent threads.
          </p>
        </div>
      </div>

      <ProjectChatConsole user={userData} projectId={projectId} />
    </main>
  )
}
