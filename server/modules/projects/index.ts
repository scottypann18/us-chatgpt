import { db } from "@/server/db";
import { projects, type Project, type NewProject } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import type { CreateProjectInput, UpdateProjectInput } from "./schemas";

/**
 * Feature orchestrator for projects.
 * Composes DB operations, services, validation, and business rules.
 * No direct HTTP or auth - that's handled at the API route layer.
 */

export async function createProject(
  userId: string,
  input: CreateProjectInput
): Promise<Project> {
  const newProject: NewProject = {
    ...input,
    userId,
  };

  const [project] = await db.insert(projects).values(newProject).returning();
  return project;
}

export async function getProjectsByUser(userId: string): Promise<Project[]> {
  return db.query.projects.findMany({
    where: eq(projects.userId, userId),
    orderBy: (projects, { desc }) => [desc(projects.updatedAt)],
  });
}

export async function getProject(
  projectId: string,
  userId: string
): Promise<Project | undefined> {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function updateProject(
  projectId: string,
  userId: string,
  input: UpdateProjectInput
): Promise<Project | undefined> {
  const [updated] = await db
    .update(projects)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .returning();

  return updated;
}

export async function deleteProject(
  projectId: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .returning();

  return result.length > 0;
}
