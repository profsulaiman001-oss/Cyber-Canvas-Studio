import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useProjects, Project, duplicateProject } from '@/hooks/useProjects';
import { setPendingSession } from '@/lib/editorSession';
import {
  MoreVertical, Trash2, Copy, FolderOpen, Settings, Plus,
  Zap, Clock, ChevronRight, ImageIcon,
} from 'lucide-react';

/* ─── Preset canvas sizes ─────────────────────────────── */
interface Preset {
  label: string;
  tag: string;
  w: number | null;
  h: number | null;
  aspectW: number;
  aspectH: number;
  gradient: string;
  custom?: boolean;
}

const PRESETS: Preset[] = [
  {
    label: 'Instagram Post',
    tag: '1080 × 1080',
    w: 1080, h: 1080,
    aspectW: 1, aspectH: 1,
    gradient: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
  },
  {
    label: 'Story',
    tag: '1080 × 1920',
    w: 1080, h: 1920,
    aspectW: 9, aspectH: 16,
    gradient: 'linear-gradient(160deg,#7B2FFF,#00F5FF)',
  },
  {
    label: 'Landscape',
    tag: '1920 × 1080',
    w: 1920, h: 1080,
    aspectW: 16, aspectH: 9,
    gradient: 'linear-gradient(135deg,#00C9FF,#92FE9D)',
  },
  {
    label: 'Custom Size',
    tag: 'Set your own',
    w: null, h: null,
    aspectW: 1, aspectH: 1,
    gradient: 'linear-gradient(135deg,#F7971E,#FFD200)',
    custom: true,
  },
];

/* ─── Helpers ─────────────────────────────────────────── */
function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diffH = (now - ts) / 3_600_000;
  if (diffH < 1) return 'Just now';
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ─── Preset card ─────────────────────────────────────── */
function PresetCard({ preset, onSelect }: { preset: Preset; onSelect: (p: Preset) => void }) {
  const thumbW = 52;
  const thumbH = Math.round((thumbW * preset.aspectH) / preset.aspectW);
  const clampH = Math.min(thumbH, 64);
  const clampW = Math.round((clampH * preset.aspectW) / preset.aspectH);

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      whileHover={{ y: -2 }}
      onClick={() => onSelect(preset)}
      className="flex flex-col items-center gap-2 p-3 rounded-2xl flex-shrink-0 w-[110px]"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center justify-center" style={{ height: 70 }}>
        {preset.custom ? (
          <div
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 48, height: 48,
              background: preset.gradient,
              boxShadow: '0 2px 12px rgba(247,151,30,0.4)',
            }}
          >
            <Plus size={22} color="#fff" />
          </div>
        ) : (
          <div
            className="rounded-lg"
            style={{
              width: clampW,
              height: clampH,
              background: preset.gradient,
              boxShadow: `0 2px 14px rgba(0,0,0,0.4)`,
            }}
          />
        )}
      </div>
      <span className="text-[11px] font-semibold text-center leading-tight" style={{ color: '#E8EAED' }}>
        {preset.label}
      </span>
      <span className="text-[10px] text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {preset.tag}
      </span>
    </motion.button>
  );
}

/* ─── Project card ────────────────────────────────────── */
function ProjectCard({
  project,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  project: Project;
  onOpen: (p: Project) => void;
  onDuplicate: (p: Project) => void;
  onDelete: (p: Project) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="relative rounded-2xl overflow-hidden cursor-pointer group"
      style={{ background: '#11141A', border: '1px solid rgba(255,255,255,0.07)' }}
      onClick={() => onOpen(project)}
    >
      {/* Thumbnail */}
      <div
        className="w-full flex items-center justify-center"
        style={{ background: '#1a1d26', aspectRatio: `${project.canvasWidth}/${project.canvasHeight}`, maxHeight: 160 }}
      >
        {project.thumbnail ? (
          <img
            src={project.thumbnail}
            alt={project.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <ImageIcon size={28} color="rgba(255,255,255,0.2)" />
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold truncate" style={{ color: '#E8EAED' }}>
            {project.name}
          </p>
          <p className="text-[10px] flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <Clock size={9} />
            {formatDate(project.updatedAt)}
            <span className="opacity-50">·</span>
            {project.canvasWidth}×{project.canvasHeight}
          </p>
        </div>

        {/* ⋮ menu */}
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            className="p-1 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            style={{ background: 'rgba(255,255,255,0.08)' }}
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
          >
            <MoreVertical size={14} color="rgba(255,255,255,0.6)" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute bottom-full right-0 mb-1 z-50 rounded-xl overflow-hidden py-1 w-36"
                style={{ background: '#1E2330', border: '1px solid rgba(0,245,255,0.18)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
                onClick={(e) => e.stopPropagation()}
              >
                {[
                  { icon: <FolderOpen size={13} />, label: 'Open', action: () => { setMenuOpen(false); onOpen(project); } },
                  { icon: <Copy size={13} />, label: 'Duplicate', action: () => { setMenuOpen(false); onDuplicate(project); } },
                  { icon: <Trash2 size={13} color="#ff6b6b" />, label: 'Delete', action: () => { setMenuOpen(false); onDelete(project); }, danger: true },
                ].map(({ icon, label, action, danger }) => (
                  <button
                    key={label}
                    onClick={action}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] transition-colors"
                    style={{
                      color: danger ? '#ff6b6b' : 'rgba(255,255,255,0.8)',
                      background: 'transparent',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = danger ? 'rgba(255,107,107,0.1)' : 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Custom size dialog ─────────────────────────────── */
function CustomSizeDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (w: number, h: number, name: string) => void;
}) {
  const [w, setW] = useState('1080');
  const [h, setH] = useState('1080');
  const [name, setName] = useState('Custom Design');

  const submit = () => {
    const pw = parseInt(w) || 1080;
    const ph = parseInt(h) || 1080;
    onConfirm(Math.max(100, Math.min(pw, 8000)), Math.max(100, Math.min(ph, 8000)), name || 'Custom Design');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="w-full max-w-sm rounded-t-3xl p-6 pb-10 space-y-5"
            style={{ background: '#151820', border: '1px solid rgba(0,245,255,0.15)', borderBottom: 'none' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto" style={{ background: 'rgba(255,255,255,0.2)' }} />
            <h2 className="text-[15px] font-bold" style={{ color: '#00F5FF' }}>Custom Canvas Size</h2>

            <div>
              <label className="text-[11px] font-medium mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)' }}>
                PROJECT NAME
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(0,245,255,0.2)',
                  color: '#E8EAED',
                }}
                placeholder="Project name"
              />
            </div>

            <div className="flex gap-3">
              {[
                { label: 'WIDTH (px)', val: w, set: setW },
                { label: 'HEIGHT (px)', val: h, set: setH },
              ].map(({ label, val, set }) => (
                <div key={label} className="flex-1">
                  <label className="text-[11px] font-medium mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {label}
                  </label>
                  <input
                    type="number"
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    min={100} max={8000}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(0,245,255,0.2)',
                      color: '#E8EAED',
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
              >
                Cancel
              </button>
              <button
                onClick={submit}
                className="flex-1 py-3 rounded-xl text-sm font-bold"
                style={{ background: 'linear-gradient(135deg,#00C5FF,#7B2FFF)', color: '#fff', boxShadow: '0 4px 16px rgba(0,197,255,0.3)' }}
              >
                Create →
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Delete confirmation ─────────────────────────────── */
function DeleteConfirmDialog({
  project,
  onConfirm,
  onCancel,
}: {
  project: Project | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      {project && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-xs rounded-2xl p-5 space-y-4"
            style={{ background: '#151820', border: '1px solid rgba(255,107,107,0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,107,107,0.15)' }}>
                <Trash2 size={16} color="#ff6b6b" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: '#E8EAED' }}>Delete Project?</p>
                <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  "{project.name}" will be removed
                </p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
                Cancel
              </button>
              <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-bold" style={{ background: 'rgba(255,107,107,0.2)', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.35)' }}>
                Delete
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Main HomeScreen ─────────────────────────────────── */
export default function HomeScreen() {
  const [, navigate] = useLocation();
  const { listProjects, deleteProject: deleteById } = useProjects();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [customOpen, setCustomOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    const list = await listProjects();
    setProjects(list);
    setLoading(false);
  }, [listProjects]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  /* ── Launch editor with a preset ── */
  const launchNew = useCallback((w: number, h: number, name: string) => {
    setPendingSession({ projectId: null, projectName: name, canvasWidth: w, canvasHeight: h, canvasJSON: null });
    navigate('/editor');
  }, [navigate]);

  const handlePreset = useCallback((preset: Preset) => {
    if (preset.custom) { setCustomOpen(true); return; }
    launchNew(preset.w!, preset.h!, preset.label);
  }, [launchNew]);

  const handleCustomConfirm = useCallback((w: number, h: number, name: string) => {
    setCustomOpen(false);
    launchNew(w, h, name);
  }, [launchNew]);

  /* ── Open existing project ── */
  const handleOpen = useCallback((project: Project) => {
    setPendingSession({
      projectId: project.id,
      projectName: project.name,
      canvasWidth: project.canvasWidth,
      canvasHeight: project.canvasHeight,
      canvasJSON: project.canvasJSON,
    });
    navigate('/editor');
  }, [navigate]);

  /* ── Duplicate project ── */
  const handleDuplicate = useCallback(async (project: Project) => {
    setDuplicating(project.id);
    try {
      await duplicateProject(project);
      await loadProjects();
    } finally {
      setDuplicating(null);
    }
  }, [loadProjects]);

  /* ── Delete project ── */
  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDelete) return;
    await deleteById(pendingDelete.id);
    setPendingDelete(null);
    await loadProjects();
  }, [pendingDelete, deleteById, loadProjects]);

  return (
    <div
      className="flex flex-col h-screen overflow-hidden select-none"
      style={{ background: '#0B0C10', color: '#E8EAED' }}
    >
      {/* ── Header ── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid rgba(0,245,255,0.08)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#00C5FF,#7B2FFF)', boxShadow: '0 0 12px rgba(0,197,255,0.4)' }}
          >
            <Zap size={16} color="#fff" strokeWidth={2.5} />
          </div>
          <span className="text-[13px] font-bold tracking-wide" style={{ color: '#00F5FF', letterSpacing: '0.05em' }}>
            CYBER STUDIO
          </span>
        </div>

        {/* Greeting */}
        <p className="text-[11px] font-medium hidden sm:block" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {greeting()}, Creator
        </p>

        {/* Settings */}
        <button
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          onClick={() => {/* future settings page */}}
        >
          <Settings size={15} color="rgba(255,255,255,0.5)" />
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>

        {/* ── New project section ── */}
        <div className="pt-6 pb-2">
          <div className="flex items-center justify-between px-5 mb-4">
            <h2 className="text-[13px] font-bold tracking-wider" style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em' }}>
              NEW PROJECT
            </h2>
          </div>

          {/* Horizontal scroll preset cards */}
          <div
            className="flex gap-3 px-5 overflow-x-auto pb-2"
            style={{ scrollbarWidth: 'none' }}
          >
            {PRESETS.map((p) => (
              <PresetCard key={p.label} preset={p} onSelect={handlePreset} />
            ))}
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="mx-5 my-4" style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

        {/* ── Recent projects section ── */}
        <div className="pb-8">
          <div className="flex items-center justify-between px-5 mb-4">
            <h2 className="text-[13px] font-bold tracking-wider" style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em' }}>
              RECENT PROJECTS
            </h2>
            {projects.length > 0 && (
              <span className="text-[11px] flex items-center gap-0.5" style={{ color: 'rgba(0,245,255,0.6)' }}>
                {projects.length} saved <ChevronRight size={12} />
              </span>
            )}
          </div>

          {loading ? (
            /* Skeleton grid */
            <div className="grid grid-cols-2 gap-3 px-5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl animate-pulse"
                  style={{ background: 'rgba(255,255,255,0.04)', height: 140 }}
                />
              ))}
            </div>
          ) : projects.length === 0 ? (
            /* Empty state */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-14 px-6 text-center"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(0,245,255,0.06)', border: '1px solid rgba(0,245,255,0.12)' }}
              >
                <ImageIcon size={28} color="rgba(0,245,255,0.4)" />
              </div>
              <p className="text-sm font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                No projects yet
              </p>
              <p className="text-[11px] mb-5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Tap a preset above to start designing
              </p>
              <button
                onClick={() => handlePreset(PRESETS[0])}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'linear-gradient(135deg,#00C5FF22,#7B2FFF22)', border: '1px solid rgba(0,197,255,0.3)', color: '#00F5FF' }}
              >
                <Plus size={14} />
                Start first project
              </button>
            </motion.div>
          ) : (
            /* Project grid */
            <div className="grid grid-cols-2 gap-3 px-5">
              <AnimatePresence>
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onOpen={handleOpen}
                    onDuplicate={handleDuplicate}
                    onDelete={setPendingDelete}
                  />
                ))}
              </AnimatePresence>

              {/* Duplicating overlay feedback */}
              {duplicating && (
                <div className="col-span-2 text-center text-[11px] py-2" style={{ color: 'rgba(0,245,255,0.6)' }}>
                  Duplicating…
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom: Quick-new FAB ── */}
      <div
        className="flex-shrink-0 px-5 pb-8 pt-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(11,12,16,0.95)', backdropFilter: 'blur(12px)' }}
      >
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => handlePreset(PRESETS[0])}
          className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm"
          style={{
            background: 'linear-gradient(135deg,#00C5FF,#7B2FFF)',
            boxShadow: '0 4px 20px rgba(0,197,255,0.3)',
            color: '#fff',
          }}
        >
          <Plus size={16} strokeWidth={2.5} />
          New Instagram Post
        </motion.button>
      </div>

      {/* ── Dialogs ── */}
      <CustomSizeDialog open={customOpen} onClose={() => setCustomOpen(false)} onConfirm={handleCustomConfirm} />
      <DeleteConfirmDialog project={pendingDelete} onConfirm={handleDeleteConfirm} onCancel={() => setPendingDelete(null)} />
    </div>
  );
}
