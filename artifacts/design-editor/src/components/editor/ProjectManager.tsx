import { useState, useEffect, useCallback, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import { useProjects, Project, setActiveProjectId } from '@/hooks/useProjects';
import {
  ArrowDownAZ,
  ArrowDownUp,
  ArrowUpAZ,
  CalendarArrowDown,
  CalendarArrowUp,
  Check,
  Clock,
  Copy,
  Ellipsis,
  Image as ImageIcon,
  Pencil,
  Plus,
  Ruler,
  Search,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Capacitor } from '@capacitor/core';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ProjectManagerProps {
  controller: CanvasController;
  currentProjectId: string | null;
  onProjectSaved: (id: string | null) => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'size-desc' | 'size-asc';

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, encoded] = dataUrl.split(',');
  const mime = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
  const binary = atob(encoded || '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], filename, { type: mime });
}

function safeFilename(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'cyber-studio-project';
}

export default function ProjectManager({ controller, currentProjectId, onProjectSaved }: ProjectManagerProps) {
  const { state, dispatch } = useEditor();
  const isOpen = state.activePanel === 'project';
  const { listProjects, saveProject, loadProject, deleteProject, renameProject, duplicateProject } = useProjects();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);

  const refreshProjects = useCallback(async () => {
    setProjects(await listProjects());
  }, [listProjects]);

  useEffect(() => {
    if (isOpen) refreshProjects();
  }, [isOpen, refreshProjects]);

  const visibleProjects = useMemo(() => {
    const normalizedQuery = search.trim().toLocaleLowerCase();
    const filtered = normalizedQuery
      ? projects.filter((project) => project.name.toLocaleLowerCase().includes(normalizedQuery))
      : projects;

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'date-asc':
          return a.updatedAt - b.updatedAt;
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'size-asc':
          return a.canvasWidth * a.canvasHeight - b.canvasWidth * b.canvasHeight;
        case 'size-desc':
          return b.canvasWidth * b.canvasHeight - a.canvasWidth * a.canvasHeight;
        case 'date-desc':
        default:
          return b.updatedAt - a.updatedAt;
      }
    });
  }, [projects, search, sortBy]);

  const handleNew = async () => {
    const c = controller.getCanvas();
    if (!c) return;
    await controller.loadFromJSON({ version: '7.3.1', objects: [], background: '#ffffff' });
    c.renderAll();
    await setActiveProjectId(null);
    onProjectSaved(null);
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
      await setActiveProjectId(project.id);
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
    await setActiveProjectId(project.id);
    dispatch({ type: 'CLOSE_PANEL' });
    toast({ title: 'Loaded', description: `"${project.name}" loaded` });
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteProject(id);
    if (id === currentProjectId) onProjectSaved(null);
    await refreshProjects();
  };

  const startRename = (project: Project) => {
    setRenamingId(project.id);
    setRenameDraft(project.name);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameDraft('');
  };

  const commitRename = async (project: Project) => {
    const nextName = renameDraft.trim();
    if (!nextName || nextName === project.name) {
      cancelRename();
      return;
    }

    setBusyProjectId(project.id);
    try {
      await renameProject(project.id, nextName);
      setProjects((current) => current.map((item) => (
        item.id === project.id ? { ...item, name: nextName, updatedAt: Date.now() } : item
      )));
      if (project.id === currentProjectId) {
        dispatch({ type: 'SET_PROJECT_NAME', payload: nextName });
      }
      toast({ title: 'Project renamed', description: `"${nextName}" is ready to use.` });
    } catch {
      toast({ title: 'Rename failed', description: 'The project name could not be saved.', variant: 'destructive' });
    } finally {
      setBusyProjectId(null);
      cancelRename();
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const project = deleteTarget;
    setBusyProjectId(project.id);
    try {
      await deleteProject(project.id);
      setProjects((current) => current.filter((item) => item.id !== project.id));
      if (project.id === currentProjectId) onProjectSaved(null);
      toast({ title: 'Project deleted', description: `"${project.name}" was removed.` });
    } catch {
      toast({ title: 'Delete failed', description: 'The project could not be removed.', variant: 'destructive' });
    } finally {
      setBusyProjectId(null);
      setDeleteTarget(null);
    }
  };

  const handleDuplicate = async (project: Project) => {
    setBusyProjectId(project.id);
    try {
      const copy = await duplicateProject(project);
      setProjects((current) => [copy, ...current]);
      toast({ title: 'Project duplicated', description: `"${copy.name}" was created.` });
    } catch {
      toast({ title: 'Duplicate failed', description: 'The project could not be copied.', variant: 'destructive' });
    } finally {
      setBusyProjectId(null);
    }
  };

  const handleShare = async (project: Project) => {
    if (!project.thumbnail) {
      toast({ title: 'Nothing to share', description: 'This project does not have a preview image yet.', variant: 'destructive' });
      return;
    }

    setBusyProjectId(project.id);
    const filename = `${safeFilename(project.name)}.jpg`;
    try {
      if (Capacitor.isNativePlatform()) {
        const [{ Filesystem, Directory }, { Share }] = await Promise.all([
          import('@capacitor/filesystem'),
          import('@capacitor/share'),
        ]);
        const [, encoded] = project.thumbnail.split(',');
        const sharePath = `project-shares/${safeFilename(project.name)}.jpg`;
        await Filesystem.writeFile({
          path: sharePath,
          data: encoded || '',
          directory: Directory.Cache,
          recursive: true,
        });
        const { uri } = await Filesystem.getUri({ path: sharePath, directory: Directory.Cache });
        await Share.share({
          title: project.name,
          text: `${project.name} — Cyber Canvas Studio`,
          files: [uri],
          dialogTitle: 'Share project preview',
        });
      } else if ('share' in navigator && typeof navigator.share === 'function') {
        const file = dataUrlToFile(project.thumbnail, filename);
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: project.name,
            text: `${project.name} — Cyber Canvas Studio`,
            files: [file],
          });
        } else {
          await navigator.share({ title: project.name, text: `${project.name} — Cyber Canvas Studio` });
        }
      } else {
        const link = document.createElement('a');
        link.href = project.thumbnail;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: 'Preview exported', description: 'Sharing is not available here, so the preview was downloaded.' });
      }
    } catch (error) {
      if ((error as { name?: string })?.name !== 'AbortError') {
        toast({
          title: 'Share failed',
          description: error instanceof Error ? error.message : 'The project preview could not be shared.',
          variant: 'destructive',
        });
      }
    } finally {
      setBusyProjectId(null);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <SheetContent
        side="left"
        className="w-80 p-0 flex flex-col"
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

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div
            className="sticky top-0 z-10 px-3 pb-3 space-y-2"
            style={{ background: '#0d1017' }}
          >
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search projects"
                  className="h-8 pl-8 text-xs"
                  aria-label="Search projects"
                  data-testid="input-project-search"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-9 px-0" aria-label="Sort projects" data-testid="button-project-sort">
                    <ArrowDownUp size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Sort projects</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                    <DropdownMenuRadioItem value="date-desc"><CalendarArrowDown /> Date modified · Newest</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="date-asc"><CalendarArrowUp /> Date modified · Oldest</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="name-asc"><ArrowDownAZ /> Name · A–Z</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="name-desc"><ArrowUpAZ /> Name · Z–A</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="size-desc"><Ruler /> Dimensions · Largest</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="size-asc"><Ruler /> Dimensions · Smallest</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="px-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {visibleProjects.length} {visibleProjects.length === 1 ? 'project' : 'projects'}
            </p>
          </div>

          <div className="px-3 space-y-2 pb-6">
          {visibleProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2 text-center">
              {projects.length === 0 ? <ImageIcon size={20} className="opacity-40" /> : <Search size={20} className="opacity-40" />}
              <p className="text-sm">{projects.length === 0 ? 'No saved projects yet' : 'No matching projects'}</p>
              <p className="text-xs">{projects.length === 0 ? 'Tap Save to save this design' : 'Try a different title or clear the search'}</p>
            </div>
          ) : (
            visibleProjects.map((project) => (
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
                  {renamingId === project.id ? (
                    <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                      <Input
                        value={renameDraft}
                        onChange={(event) => setRenameDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') void commitRename(project);
                          if (event.key === 'Escape') cancelRename();
                        }}
                        onBlur={() => void commitRename(project)}
                        className="h-7 min-w-0 px-2 text-xs"
                        autoFocus
                        disabled={busyProjectId === project.id}
                        aria-label={`Rename ${project.name}`}
                        data-testid={`input-rename-project-${project.id}`}
                      />
                      <button type="button" onClick={() => void commitRename(project)} className="p-1 text-cyan-300 hover:text-cyan-100" aria-label="Save project name">
                        <Check size={13} />
                      </button>
                      <button type="button" onClick={cancelRename} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Cancel rename">
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm font-medium truncate">{project.name}</p>
                  )}
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock size={10} />
                    {formatDate(project.updatedAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">{project.canvasWidth}×{project.canvasHeight}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      onClick={(event) => event.stopPropagation()}
                      disabled={busyProjectId === project.id}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity disabled:opacity-40"
                      aria-label={`Actions for ${project.name}`}
                      data-testid={`project-actions-${project.id}`}
                    >
                      <Ellipsis size={15} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onSelect={() => startRename(project)}><Pencil /> Rename</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void handleDuplicate(project)}><Copy /> Duplicate</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void handleShare(project)}><Share2 /> Share preview</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setDeleteTarget(project)}
                      className="text-destructive focus:text-destructive"
                      data-testid={`delete-project-${project.id}`}
                    >
                      <Trash2 /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
          </div>
        </div>
      </SheetContent>
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.name}” will be permanently removed from this device. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(busyProjectId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              disabled={Boolean(busyProjectId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
