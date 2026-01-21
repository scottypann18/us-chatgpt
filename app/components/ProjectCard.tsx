"use client";

import { useState } from "react";
import { deleteProject } from "@/app/actions/projects";
import type { Project } from "@/server/db/schema";

interface ProjectCardProps {
  project: Project;
  onDelete: (id: string) => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this project?")) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteProject(project.id);
      onDelete(project.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete project");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow duration-200">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="text-gray-400 hover:text-red-600 transition disabled:opacity-50"
          title="Delete project"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
      {project.description && (
        <p className="text-gray-600 text-sm mb-4">{project.description}</p>
      )}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>
          Created {new Date(project.createdAt).toLocaleDateString()}
        </span>
        {project.updatedAt !== project.createdAt && (
          <span>
            Updated {new Date(project.updatedAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}
