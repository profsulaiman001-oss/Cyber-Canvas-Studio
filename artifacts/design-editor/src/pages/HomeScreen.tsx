import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useProjects, Project, duplicateProject } from '@/hooks/useProjects';
import { setPendingSession } from '@/lib/editorSession';
import { CyberStudioWordmark, CsLogoMark } from '@/components/CyberStudioLogo';
import {
  MoreVertical, Trash2, Copy, FolderOpen, Settings, Plus,
  Clock, ImageIcon, X, User, Palette, HardDrive, Info,
  Check, Pencil, LayoutGrid,
} from 'lucide-react';

/* ─── Design tokens ───────────────────────────────────────── */
const C = {
  bg:       '#0B0C10',
  surface:  '#111318',
  surface2: '#171B24',
  border:   'rgba(255,255,255,0.09)',
  accent:   '#00F5FF',
  violet:   '#7B2FFF',
  text:     '#F0F2F5',
  sub:      'rgba(255,255,255,0.45)',
  muted:    'rgba(255,255,255,0.22)',
} as const;

/* ─── Preset definitions ──────────────────────────────────── */
interface Preset {
  label: string;
  tag: string;
  w: number | null;
  h: number | null;
  ar: string;
  custom?: boolean;
}
const PRESETS: Preset[] = [
  { label: 'Square 1:1',     tag: '1080 × 1080', w: 1080, h: 1080, ar: '1/1'   },
  { label: 'Vertical 9:16',  tag: '1080 × 1920', w: 1080, h: 1920, ar: '9/16'  },
  { label: 'Widescreen 16:9',tag: '1920 × 1080', w: 1920, h: 1080, ar: '16/9'  },
  { label: 'A4 Portrait',    tag: '2480 × 3508', w: 2480, h: 3508, ar: '1/1.41' },
  { label: 'Custom',         tag: 'Any size',    w: null,  h: null,  ar: '1/1', custom: true },
];

/* ─── Helpers ─────────────────────────────────────────────── */
function formatDate(ts: number): string {
  const diffH = (Date.now() - ts) / 3_600_000;
  if (diffH < 1)  return 'Just now';
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  const d = Math.floor(diffH / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7)  return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ─── New Project Bottom Sheet ────────────────────────────── */
function NewProjectSheet({
  open,
  onClose,
  onPreset,
  onCustom,
}: {
  open: boolean;
  onClose: () => void;
  onPreset: (p: Preset) => void;
  onCustom: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
          >
            <div className="w-full max-w-sm mx-0 rounded-t-3xl overflow-hidden"
              style={{
                background: '#12151E',
                border: `1px solid ${C.border}`,
                borderBottom: 'none',
                boxShadow: '0 -8px 48px rgba(0,0,0,0.7)',
              }}>
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-4">
                <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
              </div>

              <div className="px-5 pb-10">
                <p className="text-[11px] font-mono tracking-widest mb-4" style={{ color: C.muted }}>
                  SELECT CANVAS SIZE
                </p>

                <div className="space-y-2">
                  {PRESETS.map(p => (
                    <motion.button
                      key={p.label}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => p.custom ? onCustom() : onPreset(p)}
                      className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-colors text-left"
                      style={{
                        background: C.surface2,
                        border: `1px solid ${C.border}`,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = `${C.accent}33`)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
                    >
                      {/* Aspect ratio preview */}
                      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl"
                        style={{ background: C.bg, border: `1px solid rgba(255,255,255,0.07)` }}>
                        {p.custom ? (
                          <Plus size={14} color={C.accent} />
                        ) : (
                          <div style={{
                            aspectRatio: p.ar,
                            width: p.ar === '16/9' ? 28 : p.ar === '9/16' ? 12 : p.ar === '1/1.41' ? 16 : 20,
                            background: 'transparent',
                            border: `1.5px solid rgba(0,245,255,0.35)`,
                            maxHeight: 28,
                          }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold" style={{ color: C.text }}>{p.label}</p>
                        <p className="text-[11px] font-mono mt-0.5" style={{ color: C.muted }}>{p.tag}</p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ─── Custom Size Dialog ──────────────────────────────────── */
function CustomSizeDialog({
  open, onClose, onConfirm,
}: { open: boolean; onClose: () => void; onConfirm: (w: number, h: number, name: string) => void }) {
  const [w, setW] = useState('1080');
  const [h, setH] = useState('1080');
  const [name, setName] = useState('Custom Design');

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="w-full max-w-sm rounded-t-3xl p-6 pb-12 space-y-4"
            style={{ background: '#12151E', border: `1px solid ${C.border}`, borderBottom: 'none' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <p className="text-[11px] font-mono tracking-widest" style={{ color: C.muted }}>CUSTOM CANVAS</p>

            <div>
              <label className="text-[10px] font-mono tracking-wider mb-1.5 block" style={{ color: C.muted }}>PROJECT NAME</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-[13px] outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(255,255,255,0.12)`, color: C.text }}
                placeholder="Untitled Project" />
            </div>

            <div className="flex gap-3">
              {[{ label: 'WIDTH (px)', val: w, set: setW }, { label: 'HEIGHT (px)', val: h, set: setH }].map(({ label, val, set }) => (
                <div key={label} className="flex-1">
                  <label className="text-[10px] font-mono tracking-wider mb-1.5 block" style={{ color: C.muted }}>{label}</label>
                  <input type="number" value={val} onChange={e => set(e.target.value)} min={100} max={8000}
                    className="w-full px-4 py-3 rounded-xl text-[13px] outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(255,255,255,0.12)`, color: C.text }} />
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="flex-1 py-3 rounded-2xl text-[13px] font-semibold"
                style={{ background: 'rgba(255,255,255,0.05)', color: C.sub }}>
                Cancel
              </button>
              <button
                onClick={() => onConfirm(
                  Math.max(100, Math.min(parseInt(w) || 1080, 8000)),
                  Math.max(100, Math.min(parseInt(h) || 1080, 8000)),
                  name.trim() || 'Custom Design'
                )}
                className="flex-1 py-3 rounded-2xl text-[13px] font-bold"
                style={{ background: `linear-gradient(135deg,${C.accent},${C.violet})`, color: '#fff' }}>
                Create
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Rename Dialog ───────────────────────────────────────── */
function RenameDialog({
  project, onConfirm, onCancel,
}: { project: Project | null; onConfirm: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  useEffect(() => { if (project) setName(project.name); }, [project]);

  return (
    <AnimatePresence>
      {project && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }}
            className="w-full max-w-xs rounded-3xl p-5 space-y-4"
            style={{ background: '#12151E', border: `1px solid rgba(255,255,255,0.12)` }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-[13px] font-bold" style={{ color: C.text }}>Rename Project</p>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onConfirm(name); if (e.key === 'Escape') onCancel(); }}
              className="w-full px-4 py-3 rounded-xl text-[13px] outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(255,255,255,0.12)`, color: C.text }}
            />
            <div className="flex gap-2.5">
              <button onClick={onCancel} className="flex-1 py-2.5 rounded-2xl text-[13px] font-semibold"
                style={{ background: 'rgba(255,255,255,0.05)', color: C.sub }}>
                Cancel
              </button>
              <button onClick={() => onConfirm(name.trim() || project.name)}
                className="flex-1 py-2.5 rounded-2xl text-[13px] font-bold"
                style={{ background: 'rgba(0,245,255,0.12)', color: C.accent, border: `1px solid rgba(0,245,255,0.2)` }}>
                Rename
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Delete Dialog ───────────────────────────────────────── */
function DeleteDialog({
  project, onConfirm, onCancel,
}: { project: Project | null; onConfirm: () => void; onCancel: () => void }) {
  return (
    <AnimatePresence>
      {project && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }}
            className="w-full max-w-xs rounded-3xl p-5 space-y-4"
            style={{ background: '#12151E', border: '1px solid rgba(248,113,113,0.2)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}>
                <Trash2 size={16} color="#F87171" />
              </div>
              <div>
                <p className="text-[13px] font-bold" style={{ color: C.text }}>Delete Project?</p>
                <p className="text-[11px] mt-0.5 leading-snug" style={{ color: C.sub }}>
                  "{project.name}" will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <button onClick={onCancel} className="flex-1 py-2.5 rounded-2xl text-[13px] font-semibold"
                style={{ background: 'rgba(255,255,255,0.05)', color: C.sub }}>
                Cancel
              </button>
              <button onClick={onConfirm} className="flex-1 py-2.5 rounded-2xl text-[13px] font-bold"
                style={{ background: 'rgba(248,113,113,0.12)', color: '#F87171', border: '1px solid rgba(248,113,113,0.25)' }}>
                Delete
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Settings ────────────────────────────────────────────── */
const SETTINGS_KEY = 'cs_settings';
interface AppSettings { username: string; avatar: string; theme: 'obsidian' | 'cyber' | 'slate'; }

function loadSettings(): AppSettings {
  try { const r = localStorage.getItem(SETTINGS_KEY); if (r) return { username: 'Creator', avatar: '', theme: 'cyber', ...JSON.parse(r) }; }
  catch { /* ignore */ }
  return { username: 'Creator', avatar: '', theme: 'cyber' };
}
function saveSettings(s: AppSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

const THEMES = [
  { id: 'cyber',    label: 'Cyber Dark',  accent: '#00F5FF' },
  { id: 'obsidian', label: 'Obsidian',    accent: '#A78BFA' },
  { id: 'slate',    label: 'Slate Gray',  accent: '#94A3B8' },
] as const;

function storageInfo() {
  try {
    let t = 0;
    for (let i = 0; i < localStorage.length; i++) t += (localStorage.getItem(localStorage.key(i) || '') || '').length;
    return `${(t / 1024).toFixed(1)} KB`;
  } catch { return '—'; }
}

type SettingsTab = 'profile' | 'appearance' | 'storage' | 'about';

function SettingsModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<SettingsTab>('profile');
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [saved, setSaved] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  const persist = (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next); saveSettings(next);
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  };

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => persist({ avatar: ev.target?.result as string });
    reader.readAsDataURL(file);
  };

  const tabs: { id: SettingsTab; icon: React.ReactNode; label: string }[] = [
    { id: 'profile',    icon: <User size={12} />,      label: 'Profile' },
    { id: 'appearance', icon: <Palette size={12} />,   label: 'Appearance' },
    { id: 'storage',    icon: <HardDrive size={12} />, label: 'Storage' },
    { id: 'about',      icon: <Info size={12} />,      label: 'About' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        className="w-full max-w-sm rounded-t-3xl overflow-hidden"
        style={{ background: '#12151E', border: `1px solid ${C.border}`, borderBottom: 'none', maxHeight: '82vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4"
          style={{ borderBottom: `1px solid rgba(255,255,255,0.07)` }}>
          <div>
            <p className="text-[10px] font-mono tracking-widest mb-0.5" style={{ color: C.muted }}>SETTINGS</p>
            <p className="text-[14px] font-bold" style={{ color: C.text }}>Preferences</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            <X size={14} color={C.sub} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-5 pt-3 gap-1 overflow-x-auto" style={{ borderBottom: `1px solid rgba(255,255,255,0.07)`, scrollbarWidth: 'none' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-[11px] font-medium transition-all whitespace-nowrap flex-shrink-0"
              style={{
                color: tab === t.id ? C.accent : C.sub,
                background: tab === t.id ? `${C.accent}10` : 'transparent',
                borderBottom: `1.5px solid ${tab === t.id ? C.accent : 'transparent'}`,
              }}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-5 py-5 space-y-4 overflow-y-auto" style={{ maxHeight: '55vh' }}>
          {tab === 'profile' && (
            <>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0"
                  style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                  {settings.avatar
                    ? <img src={settings.avatar} alt="avatar" className="w-full h-full object-cover" />
                    : <User size={24} color={C.muted} />}
                </div>
                <div>
                  <p className="text-[12px] font-medium mb-2" style={{ color: C.text }}>Profile Photo</p>
                  <button onClick={() => avatarRef.current?.click()}
                    className="text-[11px] px-3 py-1.5 rounded-lg font-medium"
                    style={{ background: `${C.accent}12`, color: C.accent, border: `1px solid ${C.accent}25` }}>
                    Upload Photo
                  </button>
                  <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-mono tracking-wider mb-1.5 block" style={{ color: C.muted }}>DISPLAY NAME</label>
                <input value={settings.username} onChange={e => setSettings(s => ({ ...s, username: e.target.value }))}
                  onBlur={() => persist({ username: settings.username })}
                  className="w-full px-4 py-3 rounded-xl text-[13px] outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(255,255,255,0.12)`, color: C.text }} />
              </div>
              {saved && <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#22C55E' }}><Check size={12} />Saved</div>}
            </>
          )}

          {tab === 'appearance' && (
            <>
              <p className="text-[10px] font-mono tracking-wider" style={{ color: C.muted }}>THEME ACCENT</p>
              <div className="space-y-2">
                {THEMES.map(t => (
                  <button key={t.id} onClick={() => persist({ theme: t.id })}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl"
                    style={{
                      background: settings.theme === t.id ? `${t.accent}10` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${settings.theme === t.id ? t.accent + '33' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ background: t.accent }} />
                      <span className="text-[12px] font-medium" style={{ color: settings.theme === t.id ? t.accent : C.text }}>{t.label}</span>
                    </div>
                    {settings.theme === t.id && <Check size={13} color={t.accent} />}
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === 'storage' && (
            <>
              <div className="rounded-2xl p-4 space-y-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: C.sub }}>Local storage used</span>
                  <span className="text-[12px] font-mono font-bold" style={{ color: C.text }}>{storageInfo()}</span>
                </div>
                <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: C.sub }}>Works offline</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                    <span className="text-[11px] font-mono font-semibold" style={{ color: '#22C55E' }}>YES</span>
                  </div>
                </div>
              </div>
              <button onClick={() => { if (confirm('Clear all local app data? This cannot be undone.')) { localStorage.clear(); window.location.reload(); } }}
                className="w-full py-3 rounded-2xl text-[13px] font-semibold"
                style={{ background: 'rgba(248,113,113,0.08)', color: '#F87171', border: '1px solid rgba(248,113,113,0.18)' }}>
                Reset Local App Cache
              </button>
            </>
          )}

          {tab === 'about' && (
            <div className="space-y-2">
              {[
                ['App', 'Cyber Studio'],
                ['Version', 'v1.0 — Offline Studio'],
                ['Engine', 'Fabric.js v7'],
                ['Storage', 'IndexedDB (localForage)'],
                ['Mode', '100% Offline PWA'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between px-4 py-3 rounded-xl"
                  style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                  <span className="text-[11px]" style={{ color: C.sub }}>{label}</span>
                  <span className="text-[11px] font-mono font-semibold" style={{ color: C.text }}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Project Card (large, immersive) ─────────────────────── */
function ProjectCard({
  project, onOpen, onDuplicate, onDelete, onRename,
}: {
  project: Project;
  onOpen: (p: Project) => void;
  onDuplicate: (p: Project) => void;
  onDelete: (p: Project) => void;
  onRename: (p: Project) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  const actions = [
    { icon: <FolderOpen size={13} />, label: 'Open',      fn: () => { setMenuOpen(false); onOpen(project); } },
    { icon: <Pencil size={13} />,     label: 'Rename',    fn: () => { setMenuOpen(false); onRename(project); } },
    { icon: <Copy size={13} />,       label: 'Duplicate', fn: () => { setMenuOpen(false); onDuplicate(project); } },
    { icon: <Trash2 size={13} color="#F87171" />, label: 'Delete', fn: () => { setMenuOpen(false); onDelete(project); }, danger: true },
  ];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl overflow-hidden cursor-pointer"
      style={{ background: C.surface, border: `1px solid ${C.border}` }}
      onClick={() => onOpen(project)}
    >
      {/* ── Thumbnail ── */}
      <div className="relative overflow-hidden w-full"
        style={{ aspectRatio: '4/3', background: C.bg }}>

        {/* Subtle grid overlay */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id={`grid-${project.id}`} width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#grid-${project.id})`} />
        </svg>

        {project.thumbnail ? (
          <img
            src={project.thumbnail}
            alt={project.name}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ padding: '8px' }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <CsLogoMark size={32} color="rgba(255,255,255,0.1)" />
            <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.15)' }}>
              {project.canvasWidth} × {project.canvasHeight}
            </span>
          </div>
        )}

        {/* Hover overlay with open hint */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="px-4 py-2 rounded-full text-[12px] font-semibold"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', backdropFilter: 'blur(8px)' }}>
            Open
          </div>
        </div>
      </div>

      {/* ── Card footer ── */}
      <div className="px-3 py-3 flex items-center justify-between gap-2"
        style={{ borderTop: `1px solid rgba(255,255,255,0.06)` }}>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold truncate leading-tight" style={{ color: C.text }}>
            {project.name}
          </p>
          <p className="text-[10px] font-mono flex items-center gap-1 mt-0.5" style={{ color: C.muted }}>
            <Clock size={9} />
            Edited {formatDate(project.updatedAt)}
          </p>
        </div>

        {/* Always-visible ⋮ menu */}
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)' }}
            onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          >
            <MoreVertical size={14} color={C.sub} />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -4 }}
                transition={{ duration: 0.1 }}
                className="absolute bottom-full right-0 mb-1.5 z-50 rounded-2xl overflow-hidden py-1.5 w-36"
                style={{ background: '#1C2030', border: `1px solid rgba(255,255,255,0.1)`, boxShadow: '0 8px 40px rgba(0,0,0,0.7)' }}
                onClick={e => e.stopPropagation()}
              >
                {actions.map(({ icon, label, fn, danger }) => (
                  <button key={label} onClick={fn}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] font-medium transition-colors"
                    style={{ color: danger ? '#F87171' : 'rgba(255,255,255,0.8)', background: 'transparent' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = danger ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    {icon}{label}
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

/* ─── Empty State ─────────────────────────────────────────── */
function EmptyHub({ onNew }: { onNew: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className="flex flex-col items-center justify-center text-center py-16 px-8"
    >
      {/* Large logo mark as illustration */}
      <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6"
        style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.07)` }}>
        <CsLogoMark size={52} color="rgba(255,255,255,0.18)" />
      </div>
      <p className="text-[18px] font-bold mb-2" style={{ color: C.text }}>
        Your workspace is empty
      </p>
      <p className="text-[13px] leading-relaxed mb-8" style={{ color: C.sub }}>
        Create your first project to start designing.
      </p>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onNew}
        className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl text-[14px] font-bold"
        style={{
          background: `linear-gradient(135deg, ${C.accent}, ${C.violet})`,
          color: '#fff',
          boxShadow: `0 4px 24px ${C.accent}25`,
        }}>
        <Plus size={16} strokeWidth={2.5} />
        New Project
      </motion.button>
    </motion.div>
  );
}

/* ─── Main HomeScreen (Projects Hub) ─────────────────────── */
export default function HomeScreen() {
  const [, navigate] = useLocation();
  const { listProjects, deleteProject: deleteById, renameProject } = useProjects();

  const [projects, setProjects]           = useState<Project[]>([]);
  const [loading, setLoading]             = useState(true);
  const [sheetOpen, setSheetOpen]         = useState(false);
  const [customOpen, setCustomOpen]       = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [pendingRename, setPendingRename] = useState<Project | null>(null);
  const [duplicating, setDuplicating]     = useState(false);
  const [settingsOpen, setSettingsOpen]   = useState(false);

  const reload = useCallback(async () => {
    const list = await listProjects();
    setProjects(list);
    setLoading(false);
  }, [listProjects]);

  useEffect(() => { reload(); }, [reload]);

  const launchNew = useCallback((w: number, h: number, name: string) => {
    setPendingSession({ projectId: null, projectName: name, canvasWidth: w, canvasHeight: h, canvasJSON: null });
    navigate('/editor');
  }, [navigate]);

  const handlePreset = useCallback((p: Preset) => {
    setSheetOpen(false);
    if (p.custom) { setCustomOpen(true); return; }
    launchNew(p.w!, p.h!, p.label);
  }, [launchNew]);

  const handleCustomConfirm = useCallback((w: number, h: number, name: string) => {
    setCustomOpen(false);
    launchNew(w, h, name);
  }, [launchNew]);

  const handleOpen = useCallback((p: Project) => {
    setPendingSession({ projectId: p.id, projectName: p.name, canvasWidth: p.canvasWidth, canvasHeight: p.canvasHeight, canvasJSON: p.canvasJSON });
    navigate('/editor');
  }, [navigate]);

  const handleDuplicate = useCallback(async (p: Project) => {
    setDuplicating(true);
    try { await duplicateProject(p); await reload(); } finally { setDuplicating(false); }
  }, [reload]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDelete) return;
    await deleteById(pendingDelete.id);
    setPendingDelete(null);
    await reload();
  }, [pendingDelete, deleteById, reload]);

  const handleRenameConfirm = useCallback(async (name: string) => {
    if (!pendingRename) return;
    await renameProject(pendingRename.id, name);
    setPendingRename(null);
    await reload();
  }, [pendingRename, renameProject, reload]);

  return (
    <div className="flex flex-col h-screen" style={{ background: C.bg, color: C.text }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3.5"
        style={{ borderBottom: `1px solid rgba(255,255,255,0.07)` }}>

        <CyberStudioWordmark />

        <div className="flex items-center gap-2">
          {/* Settings */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
          >
            <Settings size={15} color={C.sub} />
          </button>

          {/* New Project CTA */}
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => setSheetOpen(true)}
            className="flex items-center gap-1.5 px-4 h-9 rounded-xl text-[12px] font-bold"
            style={{
              background: `linear-gradient(135deg, ${C.accent}, ${C.violet})`,
              color: '#fff',
              boxShadow: `0 2px 12px ${C.accent}20`,
            }}>
            <Plus size={13} strokeWidth={2.5} />
            New Project
          </motion.button>
        </div>
      </header>

      {/* ── Projects Hub ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>

        {/* Section title */}
        <div className="flex items-center justify-between px-4 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <LayoutGrid size={14} color={C.muted} />
            <span className="text-[11px] font-mono tracking-widest" style={{ color: C.muted }}>
              PROJECTS HUB
            </span>
          </div>
          {!loading && projects.length > 0 && (
            <span className="text-[10px] font-mono" style={{ color: C.muted }}>
              {projects.length} {projects.length === 1 ? 'project' : 'projects'}
            </span>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 px-4 pb-8">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl animate-pulse" style={{ background: C.surface, aspectRatio: '4/3' }} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyHub onNew={() => setSheetOpen(true)} />
        ) : (
          <div className="grid grid-cols-2 gap-3 px-4 pb-10">
            <AnimatePresence>
              {projects.map(p => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onOpen={handleOpen}
                  onDuplicate={handleDuplicate}
                  onDelete={setPendingDelete}
                  onRename={setPendingRename}
                />
              ))}
            </AnimatePresence>
            {duplicating && (
              <div className="col-span-2 py-2 text-center text-[10px] font-mono" style={{ color: C.muted }}>
                Duplicating…
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals & sheets ────────────────────────────────────── */}
      <NewProjectSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onPreset={handlePreset}
        onCustom={() => { setSheetOpen(false); setCustomOpen(true); }}
      />
      <CustomSizeDialog open={customOpen} onClose={() => setCustomOpen(false)} onConfirm={handleCustomConfirm} />
      <DeleteDialog project={pendingDelete} onConfirm={handleDeleteConfirm} onCancel={() => setPendingDelete(null)} />
      <RenameDialog project={pendingRename} onConfirm={handleRenameConfirm} onCancel={() => setPendingRename(null)} />
      <AnimatePresence>
        {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
