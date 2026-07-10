import { useState, useMemo } from 'react';
import { Search, Trash2, Type, Check, ChevronDown } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { removeStoredFont } from './FontUploader';
import { useEditor } from '@/store/editorStore';
import { useToast } from '@/hooks/use-toast';

interface FontPickerProps {
  value: string;
  onChange: (font: string) => void;
  systemFonts: string[];
  customFonts: string[];
  'data-testid'?: string;
}

export default function FontPicker({ value, onChange, systemFonts, customFonts, 'data-testid': testId }: FontPickerProps) {
  const { dispatch } = useEditor();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const sortedCustom = useMemo(() => [...customFonts].sort((a, b) => a.localeCompare(b)), [customFonts]);

  const filteredSystem = useMemo(
    () => systemFonts.filter((f) => f.toLowerCase().includes(query.trim().toLowerCase())),
    [systemFonts, query]
  );
  const filteredCustom = useMemo(
    () => sortedCustom.filter((f) => f.toLowerCase().includes(query.trim().toLowerCase())),
    [sortedCustom, query]
  );

  const handleSelect = (font: string) => {
    onChange(font);
    setOpen(false);
    setQuery('');
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const fontName = pendingDelete;
    await removeStoredFont(fontName, dispatch);
    toast({ title: 'Font removed', description: `"${fontName}" deleted` });
    if (value === fontName && filteredSystem[0]) {
      onChange(filteredSystem[0]);
    }
    setPendingDelete(null);
  };

  return (
    <>
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(''); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid={testId}
            className="w-full h-9 px-3 rounded-md text-xs flex items-center justify-between gap-2 border border-input bg-transparent"
            style={{ fontFamily: value }}
          >
            <span className="truncate">{value || 'Select font'}</span>
            <ChevronDown size={14} className="opacity-60 flex-shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0 overflow-hidden"
          align="start"
          style={{ width: 'var(--radix-popover-trigger-width)' }}
        >
          <div className="sticky top-0 z-10 p-2 border-b border-border bg-popover">
            <div className="relative">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search fonts..."
                data-testid="input-font-search"
                className="w-full h-8 pl-7 pr-2 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>
          </div>

          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {filteredSystem.length === 0 && filteredCustom.length === 0 && (
              <div className="px-3 py-4 text-xs text-center text-muted-foreground">No fonts found</div>
            )}

            {filteredSystem.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => handleSelect(f)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-left hover:bg-white/5"
                style={{ fontFamily: f }}
              >
                <span className="truncate">{f}</span>
                {value === f && <Check size={13} className="text-primary flex-shrink-0" />}
              </button>
            ))}

            {filteredCustom.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wider font-medium sticky top-0 bg-popover">
                  Custom
                </div>
                {filteredCustom.map((f) => (
                  <div
                    key={f}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-white/5"
                  >
                    <button
                      type="button"
                      onClick={() => handleSelect(f)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                      style={{ fontFamily: f }}
                    >
                      <Type size={11} className="text-primary flex-shrink-0" />
                      <span className="truncate">{f}</span>
                      {value === f && <Check size={13} className="text-primary flex-shrink-0" />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setPendingDelete(f); }}
                      className="text-destructive hover:text-red-400 p-1 rounded flex-shrink-0"
                      title={`Delete ${f}`}
                      data-testid={`button-delete-font-${f}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete font?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this font{pendingDelete ? ` ("${pendingDelete}")` : ''}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} data-testid="button-confirm-delete-font">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
