import { useCallback } from 'react';
import localforage from 'localforage';

export interface Project {
  id: string;
  name: string;
  canvasJSON: object;
  thumbnail: string;
  canvasWidth: number;
  canvasHeight: number;
  updatedAt: number;
}

const PROJECTS_KEY = 'cyber_studio_projects';

async function getAll(): Promise<Project[]> {
  const data = await localforage.getItem<Project[]>(PROJECTS_KEY);
  return (data || []).sort((a, b) => b.updatedAt - a.updatedAt);
}

async function saveAll(projects: Project[]): Promise<void> {
  await localforage.setItem(PROJECTS_KEY, projects);
}

/** Load a single project by ID without requiring the hook. */
export async function loadProjectById(id: string): Promise<Project | null> {
  const projects = await getAll();
  return projects.find((p) => p.id === id) ?? null;
}

/** Duplicate a project — saves a copy with "(Copy)" suffix and a new ID. */
export async function duplicateProject(project: Project): Promise<Project> {
  const projects = await getAll();
  const copy: Project = {
    ...project,
    id: `proj_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: `${project.name} (Copy)`,
    updatedAt: Date.now(),
  };
  projects.unshift(copy);
  await saveAll(projects);
  return copy;
}

export function useProjects() {
  const listProjects = useCallback(async (): Promise<Project[]> => {
    return getAll();
  }, []);

  const saveProject = useCallback(
    async (
      id: string | null,
      name: string,
      canvasJSON: object,
      thumbnail: string,
      canvasWidth: number,
      canvasHeight: number
    ): Promise<Project> => {
      const projects = await getAll();
      const projectId = id || `proj_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const existing = projects.findIndex((p) => p.id === projectId);
      const project: Project = {
        id: projectId,
        name,
        canvasJSON,
        thumbnail,
        canvasWidth,
        canvasHeight,
        updatedAt: Date.now(),
      };
      if (existing >= 0) {
        projects[existing] = project;
      } else {
        projects.unshift(project);
      }
      await saveAll(projects);
      return project;
    },
    []
  );

  const loadProject = useCallback(async (id: string): Promise<Project | null> => {
    const projects = await getAll();
    return projects.find((p) => p.id === id) || null;
  }, []);

  const deleteProject = useCallback(async (id: string): Promise<void> => {
    const projects = await getAll();
    await saveAll(projects.filter((p) => p.id !== id));
  }, []);

  const renameProject = useCallback(async (id: string, newName: string): Promise<void> => {
    const projects = await getAll();
    const idx = projects.findIndex((p) => p.id === id);
    if (idx >= 0) {
      projects[idx] = { ...projects[idx], name: newName, updatedAt: Date.now() };
      await saveAll(projects);
    }
  }, []);

  return { listProjects, saveProject, loadProject, deleteProject, renameProject };
}
