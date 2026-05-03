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

  return { listProjects, saveProject, loadProject, deleteProject };
}
