import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import { useProjects, Project } from '@/hooks/useProjects';
import { Plus, Trash2, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProjectManagerProps {
  controller: CanvasController;
  currentProjectId: string | null;
  onProjectSaved: (id: string) => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ProjectManager({ controller, currentProjectId, onProjectSaved }: ProjectManagerProps) {
  const { state, dispatch } = useEditor();
  const isOpen = state.activePanel === 'project';
  const { listProjects, saveProject, loadProject, deleteProject } = useProjects();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);

  const refreshProjects = useCallback(async () => {
    setProjects(await listProjects());
  }, [listProjects]);

  useEffect(() => {
    if (isOpen) refreshProjects();
  }, [isOpen, refreshProjects]);

  const handleNew = () => {
    const c = controller.getCanvas();
    if (!c) return;
    c.clear();
    c.backgroundColor = '#ffffff';
    c.renderAll();
    dispatch({ type: 'SET_PROJECT_NAME', payload: 'Untitled Design' });
    dispatch({ type: 'SET_DIRTY', payload: false });
    dispatch({ type: 'CLOSE_PANEL' });
  };

  const handleSave = async () => {
    const c = controller.getCanvas();
    if (!c) return;
    setSaving(true);
    try {
      const json = controller.getJSON();
      const thumbnail = c.toDataURL({ format: 'jpeg', quality: 0.3, multiplier: Math.min(200 / state.canvasSize.width, 200 / state.canvasSize.height) });
      const project = await saveProject(
        currentProjectId,
        state.projectName,
        json,
        thumbnail,
        state.canvasSize.width,
        state.canvasSize.height
      );
      onProjectSaved(project.id);
      dispatch({ type: 'SET_DIRTY', payload: false });
      toast({ title: 'Saved', description: `"${state.projectName}" saved successfully` });
      await refreshProjects();
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = async (project: Project) => {
    await controller.loadFromJSON(project.canvasJSON);
    controller.setCanvasSize(project.canvasWidth, project.canvasHeight);
    dispatch({ type: 'SET_PROJECT_NAME', payload: project.name });
    dispatch({ type: 'SET_CANVAS_SIZE', payload: { width: project.canvasWidth, height: project.canvasHeight } });
    dispatch({ type: 'SET_DIRTY', payload: false });
    onProjectSaved(project.id);
    dispatch({ type: 'CLOSE_PANEL' });
    toast({ title: 'Loaded', description: `"${project.name}" loaded` });
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteProject(id);
    await refreshProjects();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <SheetContent
        side="left"
        className="w-72 p-0 flex flex-col"
        style={{ background: '#0d1017', borderRight: '1px solid rgba(0,245,255,0.1)' }}
        data-testid="project-manager"
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-sm font-semibold">Projects</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-3 flex gap-2">
          <Button size="sm" variant="secondary" className="flex-1 gap-1.5 h-8 text-xs" onClick={handleNew} data-testid="button-new-project">
            <Plus size={13} /> New
          </Button>
          <Button size="sm" className="flex-1 gap-1.5 h-8 text-xs" onClick={handleSave} disabled={saving} data-testid="button-save-project">
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-2 pb-6">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
              <p className="text-sm">No saved projects yet</p>
              <p className="text-xs">Tap Save to save this design</p>
            </div>
          ) : (
            projects.map((project) => (
              <div
                key={project.id}
                onClick={() => handleLoad(project)}
                className="relative flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all group"
                style={{
                  background: project.id === currentProjectId ? 'rgba(0,245,255,0.08)' : 'rgba(255,255,255,0.03)',
                  border: project.id === currentProjectId ? '1px solid rgba(0,245,255,0.3)' : '1px solid transparent',
                }}
                data-testid={`project-item-${project.id}`}
              >
                {project.thumbnail && (
                  <img
                    src={project.thumbnail}
                    alt={project.name}
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    style={{ background: '#fff' }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{project.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock size={10} />
                    {formatDate(project.updatedAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">{project.canvasWidth}×{project.canvasHeight}</p>
                </div>
                <button
                  onClick={(e) => handleDelete(e, project.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-destructive hover:bg-destructive/10"
                  data-testid={`delete-project-${project.id}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
