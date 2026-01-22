import { stackServerApp } from '@/lib/services/stack-auth'

export class ApiAuthError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export const requireUser = async () => {
  const user = await stackServerApp.getUser()
  if (!user) {
    throw new ApiAuthError('Unauthorized', 401)
  }
  return user
}

export const requirePermission = async (permission: string) => {
  const user = await requireUser()
  const hasPermission = await user.hasPermission(permission)
  if (!hasPermission) {
    throw new ApiAuthError('Forbidden', 403)
  }
  return user
}