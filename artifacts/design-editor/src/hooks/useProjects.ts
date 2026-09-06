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
const ACTIVE_PROJECT_KEY = 'cyber_studio_active_project';

async function getAll(): Promise<Project[]> {
  const data = await localforage.getItem<Project[]>(PROJECTS_KEY);
  return (data || []).sort((a, b) => b.updatedAt - a.updatedAt);
}

async function saveAll(projects: Project[]): Promise<void> {
  await localforage.setItem(PROJECTS_KEY, projects);
}

/** Return the project that should be restored on the next editor launch. */
export async function getActiveProjectId(): Promise<string | null> {
  return (await localforage.getItem<string>(ACTIVE_PROJECT_KEY)) || null;
}

/** Persist the current project selection separately from the project records. */
export async function setActiveProjectId(id: string | null): Promise<void> {
  if (id) {
    await localforage.setItem(ACTIVE_PROJECT_KEY, id);
  } else {
    await localforage.removeItem(ACTIVE_PROJECT_KEY);
  }
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
      await setActiveProjectId(projectId);
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
    if (await getActiveProjectId() === id) await setActiveProjectId(null);
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
