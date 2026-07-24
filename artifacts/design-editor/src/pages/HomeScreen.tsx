import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useProjects, Project, duplicateProject } from '@/hooks/useProjects';
import { setPendingSession } from '@/lib/editorSession';
import {
  MoreVertical, Trash2, Copy, FolderOpen, Settings, Plus,
  Clock, ImageIcon, X, User, Palette, HardDrive, Info,
  Check, ChevronRight, Pencil,
} from 'lucide-react';

/* ─── Project accent tokens (match global theme) ─────────── */
const C = {
  bg:      '#0B0C10',
  surface: '#11141A',
  border:  'rgba(0,245,255,0.08)',
  accent:  '#00F5FF',
  violet:  '#7B2FFF',
  text:    '#E4E8EF',
  muted:   '#4A5568',
  dim:     'rgba(0,245,255,0.06)',
} as const;

/* ─── Dot-grid SVG thumbnail ─────────────────────────────── */
function DotGrid({ id }: { id: string }) {
  return (
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id={id} x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.8" fill="#00F5FF" opacity="0.18" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/* ─── Presets ─────────────────────────────────────────────── */
interface Preset {
  label: string;
  tag: string;
  w: number | null;
  h: number | null;
  thumbW: number;  // relative inside 30×30 box
  thumbH: number;
  custom?: boolean;
}

const PRESETS: Preset[] = [
  { label: 'Square 1:1',     tag: '1080 × 1080', w: 1080, h: 1080, thumbW: 28, thumbH: 28 },
  { label: 'Vertical 9:16',  tag: '1080 × 1920', w: 1080, h: 1920, thumbW: 18, thumbH: 32 },
  { label: 'Widescreen 16:9',tag: '1920 × 1080', w: 1920, h: 1080, thumbW: 36, thumbH: 20 },
  { label: 'Custom',         tag: 'Set dimensions', w: null, h: null, thumbW: 0, thumbH: 0, custom: true },
];

/* ─── Helpers ─────────────────────────────────────────────── */
function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function formatDate(ts: number): string {
  const now = Date.now();
  const diffH = (now - ts) / 3_600_000;
  if (diffH < 1) return 'Just now';
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'Yesterday';
  if (diffD < 7) return `${diffD}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ─── Preset card ─────────────────────────────────────────── */
function PresetCard({ preset, onSelect }: { preset: Preset; onSelect: (p: Preset) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={() => onSelect(preset)}
      className="flex flex-col flex-shrink-0 rounded-lg p-2.5 cursor-pointer transition-all w-[88px]"
      style={{
        background: C.surface,
        border: `1px solid ${hovered ? C.accent : C.border}`,
        boxShadow: hovered ? `0 0 0 1px ${C.accent}22` : 'none',
      }}
    >
      <div className="w-full h-[58px] rounded flex items-center justify-center mb-2 relative overflow-hidden"
        style={{ background: C.bg }}>
        <div className="absolute inset-0"><DotGrid id={`dg-${preset.label}`} /></div>
        {preset.custom ? (
          <Plus size={18} color={C.accent} className="opacity-60 z-10" />
        ) : (
          <div
            className="z-10 border"
            style={{
              width: preset.thumbW,
              height: preset.thumbH,
              borderColor: `${C.accent}33`,
            }}
          />
        )}
      </div>
      <span className="text-[10px] font-medium text-left leading-tight truncate w-full" style={{ color: C.text }}>
        {preset.label}
      </span>
      <span className="text-[9px] font-mono mt-0.5 text-left" style={{ color: C.muted }}>
        {preset.tag}
      </span>
    </motion.button>
  );
}

/* ─── Project card ────────────────────────────────────────── */
function ProjectCard({
  project,
  onOpen,
  onDuplicate,
  onDelete,
  onRename,
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
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const actions = [
    { icon: <FolderOpen size={12} />, label: 'Open',      action: () => { setMenuOpen(false); onOpen(project); } },
    { icon: <Pencil size={12} />,     label: 'Rename',    action: () => { setMenuOpen(false); onRename(project); } },
    { icon: <Copy size={12} />,       label: 'Duplicate', action: () => { setMenuOpen(false); onDuplicate(project); } },
    { icon: <Trash2 size={12} color="#F87171" />, label: 'Delete', action: () => { setMenuOpen(false); onDelete(project); }, danger: true },
  ];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="relative rounded-lg overflow-hidden cursor-pointer group"
      style={{ background: C.surface, border: `1px solid ${C.border}` }}
      onClick={() => onOpen(project)}
    >
      {/* Thumbnail */}
      <div
        className="w-full flex items-center justify-center relative overflow-hidden"
        style={{ background: C.bg, aspectRatio: `${project.canvasWidth}/${project.canvasHeight}`, maxHeight: 130 }}
      >
        {/* Faint grid lines behind thumbnail */}
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <line x1="15%" y1="0" x2="15%" y2="100%" stroke={`${C.accent}06`} strokeWidth="1" />
          <line x1="85%" y1="0" x2="85%" y2="100%" stroke={`${C.accent}06`} strokeWidth="1" />
          <line x1="0" y1="15%" x2="100%" y2="15%" stroke={`${C.accent}06`} strokeWidth="1" />
          <line x1="0" y1="85%" x2="100%" y2="85%" stroke={`${C.accent}06`} strokeWidth="1" />
        </svg>
        {project.thumbnail ? (
          <img src={project.thumbnail} alt={project.name} className="w-full h-full object-contain relative z-10" />
        ) : (
          <ImageIcon size={22} color={`${C.accent}30`} className="z-10" />
        )}
      </div>

      {/* Footer */}
      <div className="px-2.5 py-2 flex items-center justify-between gap-1">
        <div className="min-w-0">
          <p className="text-[11px] font-medium truncate" style={{ color: C.text }}>{project.name}</p>
          <p className="text-[9px] font-mono flex items-center gap-1 mt-0.5" style={{ color: C.muted }}>
            <Clock size={8} />
            {formatDate(project.updatedAt)}
          </p>
        </div>

        {/* ⋮ menu */}
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            className="p-1 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            style={{ background: 'rgba(255,255,255,0.06)' }}
            onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }}
          >
            <MoreVertical size={13} color="rgba(255,255,255,0.5)" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -4 }}
                transition={{ duration: 0.1 }}
                className="absolute bottom-full right-0 mb-1 z-50 rounded-xl overflow-hidden py-1 w-32"
                style={{
                  background: '#1A1E2A',
                  border: `1px solid ${C.accent}22`,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                }}
                onClick={e => e.stopPropagation()}
              >
                {actions.map(({ icon, label, action, danger }) => (
                  <button
                    key={label}
                    onClick={action}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[11px] transition-colors"
                    style={{ color: danger ? '#F87171' : 'rgba(255,255,255,0.75)', background: 'transparent' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = danger ? 'rgba(248,113,113,0.08)' : 'rgba(0,245,255,0.05)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
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

/* ─── Rename dialog ───────────────────────────────────────── */
function RenameDialog({
  project,
  onConfirm,
  onCancel,
}: { project: Project | null; onConfirm: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  useEffect(() => { if (project) setName(project.name); }, [project]);
  return (
    <AnimatePresence>
      {project && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
            className="w-full max-w-xs rounded-2xl p-5 space-y-4"
            style={{ background: '#151820', border: `1px solid ${C.accent}22` }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-bold" style={{ color: C.accent }}>Rename Project</p>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onConfirm(name); if (e.key === 'Escape') onCancel(); }}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.accent}22`, color: C.text }}
            />
            <div className="flex gap-2.5">
              <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)' }}>
                Cancel
              </button>
              <button onClick={() => onConfirm(name.trim() || project.name)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: `${C.accent}18`, color: C.accent, border: `1px solid ${C.accent}33` }}>
                Rename
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Custom size dialog ──────────────────────────────────── */
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
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="w-full max-w-sm rounded-t-3xl p-6 pb-10 space-y-4"
            style={{ background: '#151820', border: `1px solid ${C.accent}18`, borderBottom: 'none' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <p className="text-sm font-bold font-mono tracking-wider" style={{ color: C.accent }}>// CUSTOM CANVAS</p>

            <div>
              <label className="text-[10px] font-mono tracking-wider mb-1.5 block" style={{ color: C.muted }}>PROJECT NAME</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.accent}22`, color: C.text }}
                placeholder="Project name" />
            </div>

            <div className="flex gap-3">
              {[{ label: 'WIDTH (px)', val: w, set: setW }, { label: 'HEIGHT (px)', val: h, set: setH }].map(({ label, val, set }) => (
                <div key={label} className="flex-1">
                  <label className="text-[10px] font-mono tracking-wider mb-1.5 block" style={{ color: C.muted }}>{label}</label>
                  <input type="number" value={val} onChange={e => set(e.target.value)} min={100} max={8000}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.accent}22`, color: C.text }} />
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>
                Cancel
              </button>
              <button
                onClick={() => onConfirm(Math.max(100, Math.min(parseInt(w)||1080, 8000)), Math.max(100, Math.min(parseInt(h)||1080, 8000)), name || 'Custom Design')}
                className="flex-1 py-3 rounded-xl text-sm font-bold"
                style={{ background: `linear-gradient(135deg,${C.accent},${C.violet})`, color: '#fff', boxShadow: `0 4px 16px ${C.accent}30` }}>
                Create →
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Delete confirmation ─────────────────────────────────── */
function DeleteDialog({
  project, onConfirm, onCancel,
}: { project: Project | null; onConfirm: () => void; onCancel: () => void }) {
  return (
    <AnimatePresence>
      {project && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
            className="w-full max-w-xs rounded-2xl p-5 space-y-4"
            style={{ background: '#151820', border: '1px solid rgba(248,113,113,0.2)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(248,113,113,0.12)' }}>
                <Trash2 size={15} color="#F87171" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: C.text }}>Delete Project?</p>
                <p className="text-[11px]" style={{ color: C.muted }}>"{project.name}" will be removed</p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)' }}>
                Cancel
              </button>
              <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#F87171', border: '1px solid rgba(248,113,113,0.3)' }}>
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

interface AppSettings {
  username: string;
  avatar: string;   // base64 or ''
  theme: 'obsidian' | 'cyber' | 'slate';
}

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...{ username: 'Creator', avatar: '', theme: 'cyber' }, ...JSON.parse(raw) };
  } catch { /* ignore */ }
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
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      total += (localStorage.getItem(k) || '').length;
    }
    const kb = (total / 1024).toFixed(1);
    return `${kb} KB`;
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
    setSettings(next);
    saveSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => persist({ avatar: ev.target?.result as string });
    reader.readAsDataURL(file);
  };

  const clearCache = () => {
    if (!confirm('Clear all local app data? This cannot be undone.')) return;
    try { localStorage.clear(); } catch { /* ignore */ }
    window.location.reload();
  };

  const tabs: { id: SettingsTab; icon: React.ReactNode; label: string }[] = [
    { id: 'profile',    icon: <User size={13} />,      label: 'Profile' },
    { id: 'appearance', icon: <Palette size={13} />,   label: 'Appearance' },
    { id: 'storage',    icon: <HardDrive size={13} />, label: 'Storage' },
    { id: 'about',      icon: <Info size={13} />,      label: 'About' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        className="w-full max-w-sm rounded-t-3xl overflow-hidden"
        style={{ background: '#111520', border: `1px solid ${C.accent}18`, borderBottom: 'none', maxHeight: '82vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3"
          style={{ borderBottom: `1px solid ${C.dim}` }}>
          <div>
            <p className="text-[10px] font-mono tracking-widest" style={{ color: C.muted }}>// SETTINGS</p>
            <p className="text-[13px] font-bold mt-0.5" style={{ color: C.text }}>Preferences</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            <X size={14} color="rgba(255,255,255,0.5)" />
          </button>
        </div>

        {/* Tab nav */}
        <div className="flex px-5 pt-3 gap-1" style={{ borderBottom: `1px solid ${C.dim}` }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-[11px] font-medium transition-all"
              style={{
                color: tab === t.id ? C.accent : C.muted,
                background: tab === t.id ? `${C.accent}10` : 'transparent',
                borderBottom: tab === t.id ? `1px solid ${C.accent}` : '1px solid transparent',
              }}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-5 py-5 space-y-4 overflow-y-auto" style={{ maxHeight: '55vh' }}>

          {tab === 'profile' && (
            <>
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0"
                  style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                  {settings.avatar
                    ? <img src={settings.avatar} alt="avatar" className="w-full h-full object-cover" />
                    : <User size={26} color={C.muted} />
                  }
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-medium mb-2" style={{ color: C.text }}>Profile Photo</p>
                  <button onClick={() => avatarRef.current?.click()}
                    className="text-[11px] px-3 py-1.5 rounded-lg font-medium"
                    style={{ background: `${C.accent}12`, color: C.accent, border: `1px solid ${C.accent}25` }}>
                    Upload Photo
                  </button>
                  <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="text-[10px] font-mono tracking-wider mb-1.5 block" style={{ color: C.muted }}>DISPLAY NAME</label>
                <input
                  value={settings.username}
                  onChange={e => setSettings(s => ({ ...s, username: e.target.value }))}
                  onBlur={() => persist({ username: settings.username })}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.accent}22`, color: C.text }}
                  placeholder="Your name"
                />
              </div>

              {saved && (
                <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#22C55E' }}>
                  <Check size={12} /> Saved
                </div>
              )}
            </>
          )}

          {tab === 'appearance' && (
            <>
              <p className="text-[10px] font-mono tracking-wider" style={{ color: C.muted }}>DARK THEME TINT</p>
              <div className="space-y-2">
                {THEMES.map(t => (
                  <button key={t.id} onClick={() => persist({ theme: t.id })}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all"
                    style={{
                      background: settings.theme === t.id ? `${t.accent}12` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${settings.theme === t.id ? t.accent + '44' : 'rgba(255,255,255,0.07)'}`,
                    }}>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ background: t.accent }} />
                      <span className="text-[12px] font-medium" style={{ color: settings.theme === t.id ? t.accent : C.text }}>
                        {t.label}
                      </span>
                    </div>
                    {settings.theme === t.id && <Check size={13} color={t.accent} />}
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === 'storage' && (
            <>
              <div className="rounded-xl p-4 space-y-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: C.muted }}>Local storage used</span>
                  <span className="text-[12px] font-mono font-bold" style={{ color: C.accent }}>{storageInfo()}</span>
                </div>
                <div className="h-px" style={{ background: C.dim }} />
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: C.muted }}>Works offline</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                    <span className="text-[11px] font-mono" style={{ color: '#22C55E' }}>YES</span>
                  </div>
                </div>
              </div>
              <button onClick={clearCache}
                className="w-full py-3 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(248,113,113,0.08)', color: '#F87171', border: '1px solid rgba(248,113,113,0.2)' }}>
                Reset Local App Cache
              </button>
              <p className="text-[10px] text-center" style={{ color: C.muted }}>
                Clears all saved projects and settings. Cannot be undone.
              </p>
            </>
          )}

          {tab === 'about' && (
            <div className="space-y-3">
              {[
                { label: 'App', value: 'Cyber Studio' },
                { label: 'Version', value: 'v1.0 — Offline Studio' },
                { label: 'Engine', value: 'Fabric.js v7' },
                { label: 'Storage', value: 'IndexedDB (localForage)' },
                { label: 'Mode', value: '100% Offline PWA' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2.5 px-4 rounded-xl"
                  style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                  <span className="text-[11px]" style={{ color: C.muted }}>{label}</span>
                  <span className="text-[11px] font-mono font-medium" style={{ color: C.text }}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Main HomeScreen ─────────────────────────────────────── */
export default function HomeScreen() {
  const [, navigate] = useLocation();
  const { listProjects, deleteProject: deleteById, renameProject } = useProjects();

  const [projects, setProjects]           = useState<Project[]>([]);
  const [loading, setLoading]             = useState(true);
  const [customOpen, setCustomOpen]       = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [pendingRename, setPendingRename] = useState<Project | null>(null);
  const [duplicating, setDuplicating]     = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen]   = useState(false);
  const settings = loadSettings();

  const loadProjects = useCallback(async () => {
    const list = await listProjects();
    setProjects(list);
    setLoading(false);
  }, [listProjects]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

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

  const handleDuplicate = useCallback(async (project: Project) => {
    setDuplicating(project.id);
    try { await duplicateProject(project); await loadProjects(); }
    finally { setDuplicating(null); }
  }, [loadProjects]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDelete) return;
    await deleteById(pendingDelete.id);
    setPendingDelete(null);
    await loadProjects();
  }, [pendingDelete, deleteById, loadProjects]);

  const handleRenameConfirm = useCallback(async (name: string) => {
    if (!pendingRename) return;
    await renameProject(pendingRename.id, name);
    setPendingRename(null);
    await loadProjects();
  }, [pendingRename, renameProject, loadProjects]);

  return (
    <div className="flex flex-col h-screen overflow-hidden select-none"
      style={{ background: C.bg, color: C.text }}>

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `1px solid ${C.border}` }}>
        {/* Wordmark */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 flex items-center justify-center font-mono text-[11px] font-bold rounded"
            style={{
              background: C.surface,
              border: `1px solid ${C.accent}`,
              color: C.accent,
              boxShadow: `0 0 0 1px ${C.accent}18`,
            }}>
            CS
          </div>
          <span className="text-[12px] font-semibold tracking-[0.15em]" style={{ color: C.text }}>
            CYBER STUDIO
          </span>
        </div>

        {/* Settings */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
          style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <Settings size={14} color={C.muted} />
        </button>
      </div>

      {/* ── Status strip ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-1.5"
        style={{ background: C.surface, borderBottom: `1px solid ${C.dim}` }}>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#22C55E' }} />
          <span className="text-[9px] font-mono tracking-wider" style={{ color: C.muted }}>OFFLINE READY</span>
        </div>
        <span className="text-[9px] font-mono tracking-wider" style={{ color: C.muted }}>
          {greeting()}, {settings.username}
        </span>
        <span className="text-[9px] font-mono tracking-wider" style={{ color: C.muted }}>v1.0</span>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>

        {/* ── Canvas presets ── */}
        <div className="pt-5 pb-2">
          <p className="text-[10px] font-mono tracking-wider px-4 mb-3" style={{ color: C.muted }}>
            // NEW CANVAS
          </p>
          <div className="flex gap-2 px-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {PRESETS.map(p => <PresetCard key={p.label} preset={p} onSelect={handlePreset} />)}
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="mx-4 my-3" style={{ height: '1px', background: C.dim }} />

        {/* ── Recent projects ── */}
        <div className="pb-8">
          <div className="flex items-center justify-between px-4 mb-3">
            <p className="text-[10px] font-mono tracking-wider" style={{ color: C.muted }}>// RECENT</p>
            {projects.length > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] font-mono" style={{ color: `${C.accent}80` }}>
                {projects.length} saved <ChevronRight size={11} />
              </span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-2.5 px-4">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="rounded-lg animate-pulse" style={{ background: C.surface, height: 130 }} />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-14 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: `${C.accent}08`, border: `1px solid ${C.accent}15` }}>
                <ImageIcon size={24} color={`${C.accent}50`} />
              </div>
              <p className="text-sm font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>No projects yet</p>
              <p className="text-[11px] font-mono mb-5" style={{ color: C.muted }}>
                Select a canvas preset above to begin
              </p>
              <button onClick={() => handlePreset(PRESETS[0])}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-semibold"
                style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}30`, color: C.accent }}>
                <Plus size={13} /> Start first project
              </button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 px-4">
              <AnimatePresence>
                {projects.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onOpen={handleOpen}
                    onDuplicate={handleDuplicate}
                    onDelete={setPendingDelete}
                    onRename={setPendingRename}
                  />
                ))}
              </AnimatePresence>
              {duplicating && (
                <div className="col-span-2 text-center text-[10px] font-mono py-2" style={{ color: `${C.accent}80` }}>
                  Duplicating…
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <div className="flex-shrink-0 px-4 pb-8 pt-3"
        style={{ borderTop: `1px solid ${C.dim}`, background: `${C.bg}F2`, backdropFilter: 'blur(12px)' }}>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setCustomOpen(true)}
          className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2 font-bold text-[13px] tracking-wide"
          style={{
            background: `linear-gradient(135deg, ${C.accent}, ${C.violet})`,
            boxShadow: `0 4px 20px ${C.accent}28`,
            color: '#fff',
          }}>
          <Plus size={15} strokeWidth={2.5} />
          + Blank Project
        </motion.button>
      </div>

      {/* ── Dialogs & modals ── */}
      <CustomSizeDialog open={customOpen} onClose={() => setCustomOpen(false)} onConfirm={handleCustomConfirm} />
      <DeleteDialog project={pendingDelete} onConfirm={handleDeleteConfirm} onCancel={() => setPendingDelete(null)} />
      <RenameDialog project={pendingRename} onConfirm={handleRenameConfirm} onCancel={() => setPendingRename(null)} />

      <AnimatePresence>
        {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
