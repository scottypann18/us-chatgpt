# Projects (ChatGPT-like) — Build Plan

This document outlines how we will build a ChatGPT Projects-like experience in our app. The focus is a per-project workspace with instructions, files, chats, and project memory, starting with a minimal viable slice and iterating.

## Goals
- Project workspaces: name/icon/color, instructions, project-only memory, files, chats.
- Project-scoped chats that stream via AI SDK (already wired for `project-chat`).
- Project context used in prompts (instructions, memory, files).
- Future: sharing (roles), branching/move chats, limits by plan, admin controls.

## MVP (first increment)
1) Data model
- Tables (Drizzle/SQL):
  - `projects`: id, ownerId, name, icon, color, memory_mode (set to project-only for now), createdAt, updatedAt.
  - `project_instructions`: projectId, text, updatedAt, updatedBy.
  - `project_files`: id, projectId, filename, size, mimeType, storageUrl, uploadedBy, createdAt.
  - `project_chats`: id, projectId, title, createdBy, createdAt, updatedAt.
  - `project_messages`: id, chatId, role (user|assistant), content, rich (json), createdAt.

2) API surface (App Router)
- `POST /api/projects` create; `GET /api/projects` list for user.
- `GET /api/projects/:id` detail (with instructions summary, counts).
- `PUT /api/projects/:id/instructions` set project instructions (memory is fixed to project-only for now).
- `POST /api/projects/:id/files` upload; `DELETE /api/projects/:id/files/:fileId` remove.
- `GET /api/projects/:id/chats` list; `POST /api/projects/:id/chats` create chat.
- `POST /api/projects/:id/chat/messages` send message (project-scoped), returns streamed SSE for project-chat.

3) Chat runtime
- `ChatConsole` receives `projectId` and `chatTypes=[{ id: 'project-chat', ... }]`.
- For `project-chat`, POST to `/api/projects/:id/chat/messages` (streamed). Server builds system prompt with project instructions + memory mode + referenced files.
- Persist messages to `project_messages`; keep local optimistic state.

4) Files
- Enforce per-project limits via config (start with env: max files per project, max file size, allowed mime types).
- Upload to storage provider (S3/Cloudflare/etc.); store metadata in `project_files`.
- Index text-like files into the vector store for file_search (auto-searchable; no need to re-attach each message).
- Show non-text/vision assets (e.g., images, binaries) in a project file picker so users can attach them to a message as `input_image` or binary when needed.
- If images must be searchable, OCR/caption them to text, index that text in the vector store, and keep the original image in storage.

5) Memory mode
- `project-only` only: restrict to this project’s chats/files; ignore external memories. The column remains for forward compatibility but we set/use project-only.

## Subsequent increments
- Sharing & roles: `project_members` (owner|editor|chat), invites, link-based access, share dialog.
- Branch/move chats between projects (`project_chat_branches`, move endpoint).
- Plan-based limits: files per project, collaborators, storage caps.
- Admin/compliance: audit log entries; soft-delete with retention; workspace feature toggles.

## Step-by-step execution (initial sprint)
1) [done] Add Drizzle schema + migration for projects, instructions, files, chats, messages.
2) [done] Implement `/api/projects` CRUD + instructions update.
3) [done] Implement `/api/projects/:id/chat/messages` using AI SDK `streamText` with project prompt context; stream SSE to client.
4) [done] Wire `ChatConsole` for project mode: send via project endpoint and stream.
5) [done] Add project instructions UI (memory is fixed to project-only, no selector).
6) Add project file upload/list/delete UI; enforce limits server-side.
7) Basic list/create UI for projects (name, icon/color placeholder, memory mode selection).
8) Separate project chat storage/endpoints from general chat (project-scoped chats/messages only; distinct local storage key per project).
9) Add project members (invite/manage roles via Stack Auth) so projects can be shared.

## Prompt construction (project-chat)
- System parts: project instructions; memory mode rules; safety/tone; optional tool toggles (web search).
- Context: last N messages in the chat (and, if allowed, other project chats); attached project files as inputs.
- Model: use configured simple-chat model (default `gpt-4o-mini` or env override); streaming via AI SDK.

## Notes
- Streaming: client already parses AI SDK SSE; keep `project-chat` on `/api/ai/simple-chat` until project endpoint replaces it.
- Attachments: disallow for project-chat until project file handling is finished; then switch to file references (not raw data URLs).
- Limits: start with env-based constants; later map to user plan.

## Next actions to start
1) Add minimal project list/create UI on `/chatgpt_projects` (name; memory is always project-only).
2) Add project file upload/list/delete UI; enforce limits server-side.
3) Implement project-scoped chat persistence: project chat list/create endpoints, project messages endpoints, and local storage isolated per projectId; do not mix with `/api/chatgpt/messages`.
4) Add project members: Stack Auth-backed invites/roles (owner/editor/chat) with API + UI to add/remove members; enforce membership on project endpoints.
