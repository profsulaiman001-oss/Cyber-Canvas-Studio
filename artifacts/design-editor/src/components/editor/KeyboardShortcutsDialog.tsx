import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ShortcutSection = {
  title: string;
  rows: Array<{ keys: string; description: string }>;
};

const sections: ShortcutSection[] = [
  {
    title: 'File',
    rows: [
      { keys: '⌘/Ctrl + S', description: 'Save project' },
      { keys: '⌘/Ctrl + N', description: 'Create a new project' },
      { keys: '⌘/Ctrl + O', description: 'Open project manager' },
      { keys: '⌘/Ctrl + Shift + E', description: 'Quick export as PNG' },
    ],
  },
  {
    title: 'Edit',
    rows: [
      { keys: '⌘/Ctrl + Z', description: 'Undo' },
      { keys: '⌘/Ctrl + Shift + Z or Y', description: 'Redo' },
      { keys: '⌘/Ctrl + C / V / X', description: 'Copy / paste / cut' },
      { keys: '⌘/Ctrl + D', description: 'Duplicate selection' },
      { keys: '⌘/Ctrl + A', description: 'Select all objects' },
      { keys: 'Delete / Backspace', description: 'Delete selection' },
      { keys: 'Escape', description: 'Deselect all' },
    ],
  },
  {
    title: 'Tools & View',
    rows: [
      { keys: 'V', description: 'Select tool' },
      { keys: 'T / R / C', description: 'Add text / rectangle / circle' },
      { keys: 'I', description: 'Eyedropper' },
      { keys: 'G', description: 'Toggle Grid Studio' },
      { keys: 'H or hold Space', description: 'Temporarily pan' },
      { keys: '⌘/Ctrl + + / − / 0', description: 'Zoom in / out / fit' },
      { keys: '⌘/Ctrl + mouse wheel', description: 'Zoom canvas' },
      { keys: 'Arrow keys', description: 'Nudge 1px' },
      { keys: 'Shift + Arrow keys', description: 'Nudge 10px' },
    ],
  },
  {
    title: 'Layers',
    rows: [
      { keys: '⌘/Ctrl + G', description: 'Group selection' },
      { keys: '⌘/Ctrl + Shift + G', description: 'Ungroup selection' },
      { keys: '⌘/Ctrl + L', description: 'Toggle lock' },
      { keys: 'Shift + H / V', description: 'Flip horizontal / vertical' },
      { keys: '⌘/Ctrl + ] / [', description: 'Move forward / backward' },
      { keys: '⌘/Ctrl + Shift + ] / [', description: 'Move to front / back' },
    ],
  },
  {
    title: 'Alignment',
    rows: [
      { keys: 'Alt/Option + Shift + C', description: 'Center horizontally' },
      { keys: 'Alt/Option + Shift + M', description: 'Center vertically' },
    ],
  },
];

export default function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(85dvh,720px)] overflow-y-auto sm:max-w-2xl"
        style={{ background: '#11141A', border: '1px solid rgba(0,245,255,0.2)' }}
        data-testid="dialog-keyboard-shortcuts"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Keyboard size={16} style={{ color: '#00F5FF' }} />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 py-2 sm:grid-cols-2">
          {sections.map((section) => (
            <section key={section.title} className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: '#00F5FF' }}>
                {section.title}
              </h3>
              <div className="space-y-1.5">
                {section.rows.map((row) => (
                  <div key={`${section.title}-${row.keys}`} className="flex items-start justify-between gap-3 rounded-lg px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.035)' }}>
                    <span className="text-[11px] text-muted-foreground">{row.description}</span>
                    <kbd className="shrink-0 rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                      {row.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="text-center text-[10px] text-muted-foreground">
          Press <kbd className="rounded border border-white/10 px-1">?</kbd> any time to reopen this guide.
        </p>
      </DialogContent>
    </Dialog>
  );
}