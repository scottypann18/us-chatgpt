# ChatGPT API routes
Date: 2025-12-27

This folder contains the API surface for the ChatGPT feature. The routes are intentionally thin and delegate all logic to the chatgpt module under `server/modules/chatgpt`.

## Routes

- `messages/route.ts`: POST entrypoint for ChatGPT tasks + conversation persistence.
  - Auth: `requirePermission('beta')` from central `app/api/_shared/auth`.
  - Delegation: `handleChatgptPost` in `server/modules/chatgpt`; returns text or JSON based on module result.
- `conversations/route.ts`: GET to list the current user's saved conversations.
  - Auth: `requirePermission('beta')` from central helper.
  - Delegation: `listUserConversations` in `server/modules/chatgpt/historic-conversations`.
  - Response: `{ conversations }`.
- `conversations/[id]/route.ts`: DELETE to soft-delete a conversation for the current user.
  - Auth: `requirePermission('beta')` from central helper.
  - Delegation: `softDeleteConversation` in `server/modules/chatgpt/historic-conversations`.
  - Response: `{ success: true }` on success.
- `image-prompts/route.ts`: GET/PUT for managing shared image prompt templates used by the chat console.
  - Auth: `requireAdmin()` from central helper.
  - Delegation: `listImagePromptTemplates` / `updateImagePromptTemplate` in `server/modules/chatgpt/image-prompts`.
  - Response envelope: `{ success, templates? | template?, error? }`.

## Design notes

- API routes do only HTTP concerns: auth, request parsing, and HTTP response shaping.
- All business logic, validation, external calls, and persistence live in `server/modules/chatgpt`; shared Zod schemas live in `server/modules/chatgpt/validation` and are imported by both modules and routes.
- External vendors (OpenAI, CloudConvert, Microsoft email) are accessed via thin adapters in `lib/services/*`.
- Auth uses the central helper in `app/api/_shared/auth` (`requirePermission`, `requireAdmin`, `requireUser`) for consistency.

## Related module/service files

- Modules:
  - `server/modules/chatgpt/index.ts`
  - `server/modules/chatgpt/image-prompts.ts`
  - `server/modules/chatgpt/historic-conversations.ts`
- Services:
  - `lib/services/openai/chatgpt.ts` (OpenAI Responses API adapter)
  - `lib/services/cloud-converter/index.ts` (CloudConvert adapter)
  - `lib/services/microsoft` (email sending)

Keep new routes in this folder consistent with this pattern: thin route, module orchestration, services for vendor calls.
