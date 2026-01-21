"use server";

import { stackServerApp } from "@/lib/services/stack-auth";
import * as projectsModule from "@/server/modules/projects";
import { createProjectSchema, updateProjectSchema } from "@/server/modules/projects/schemas";
import { revalidatePath } from "next/cache";

/**
 * Server actions for projects.
 * Thin HTTP/auth boundary - validates requests, checks auth, delegates to modules.
 */

export async function getProjects() {
  const user = await stackServerApp.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  return projectsModule.getProjectsByUser(user.id);
}

export async function getProject(projectId: string) {
  const user = await stackServerApp.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  return projectsModule.getProject(projectId, user.id);
}

export async function createProject(formData: FormData) {
  const user = await stackServerApp.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const input = {
    name: formData.get("name") as string,
    description: formData.get("description") as string,
  };

  const validated = createProjectSchema.parse(input);
  const project = await projectsModule.createProject(user.id, validated);

  revalidatePath("/projects");
  return project;
}

export async function updateProject(projectId: string, formData: FormData) {
  const user = await stackServerApp.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const input = {
    name: formData.get("name") as string,
    description: formData.get("description") as string,
  };

  const validated = updateProjectSchema.parse(input);
  const project = await projectsModule.updateProject(projectId, user.id, validated);

  if (!project) {
    throw new Error("Project not found");
  }

  revalidatePath("/projects");
  return project;
}

export async function deleteProject(projectId: string) {
  const user = await stackServerApp.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const deleted = await projectsModule.deleteProject(projectId, user.id);

  if (!deleted) {
    throw new Error("Project not found");
  }

  revalidatePath("/projects");
  return { success: true };
}
