import { useEffect, useRef } from 'react';
import type { ActivePanel, ActiveTool } from '@/store/editorStore';
import type { CanvasController } from './useFabricCanvas';

interface KeyboardShortcutOptions {
  controller: CanvasController;
  activeTool: ActiveTool;
  setTool: (tool: ActiveTool) => void;
  toggleGrid: () => void;
  onSave: () => void | Promise<void>;
  onNewProject: () => void | Promise<void>;
  onOpenProject: () => void;
  onQuickExport: () => void | Promise<void>;
  onEyedropper: () => void | Promise<void>;
  onShowHelp: () => void;
  onNudge: (direction: 'up' | 'down' | 'left' | 'right', amount: number) => void;
}

function isTypingTarget(target: EventTarget | null, controller: CanvasController): boolean {
  const element = target instanceof HTMLElement ? target : document.activeElement;
  const htmlElement = element instanceof HTMLElement ? element : null;
  if (
    htmlElement instanceof HTMLInputElement
    || htmlElement instanceof HTMLTextAreaElement
    || htmlElement instanceof HTMLSelectElement
    || htmlElement?.isContentEditable
    || Boolean(element?.closest('[contenteditable="true"]'))
  ) {
    return true;
  }

  const activeObject = controller.getCanvas()?.getActiveObject() as
    | (FabricObjectWithEditingState)
    | undefined;
  return Boolean(
    activeObject
    && ['i-text', 'textbox', 'text'].includes(activeObject.type ?? '')
    && activeObject.isEditing === true,
  );
}

interface FabricObjectWithEditingState {
  type?: string;
  isEditing?: boolean;
}

export function useKeyboardShortcuts(options: KeyboardShortcutOptions): void {
  const optionsRef = useRef(options);
  const panRestoreToolRef = useRef<ActiveTool | null>(null);
  const panHeldRef = useRef(false);

  optionsRef.current = options;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const current = optionsRef.current;
      const key = event.key;
      const lowerKey = key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      const shift = event.shiftKey;
      const alt = event.altKey;

      if (key === '?' || (modifier && key === '/')) {
        if (isTypingTarget(event.target, current.controller)) return;
        event.preventDefault();
        current.onShowHelp();
        return;
      }

      if (isTypingTarget(event.target, current.controller)) return;

      if (modifier && shift && lowerKey === 'e') {
        event.preventDefault();
        void current.onQuickExport();
        return;
      }

      if (modifier && lowerKey === 's') {
        event.preventDefault();
        void current.onSave();
        return;
      }

      if (modifier && lowerKey === 'n') {
        event.preventDefault();
        void current.onNewProject();
        return;
      }

      if (modifier && lowerKey === 'o') {
        event.preventDefault();
        current.onOpenProject();
        return;
      }

      if (modifier && shift && lowerKey === 'z') {
        event.preventDefault();
        void current.controller.redo();
        return;
      }

      if (modifier && lowerKey === 'y') {
        event.preventDefault();
        void current.controller.redo();
        return;
      }

      if (modifier && lowerKey === 'z') {
        event.preventDefault();
        void current.controller.undo();
        return;
      }

      if (modifier && shift && lowerKey === 'g') {
        event.preventDefault();
        current.controller.ungroupSelected();
        return;
      }

      if (modifier && lowerKey === 'g') {
        event.preventDefault();
        current.controller.groupSelected();
        return;
      }

      if (modifier && lowerKey === 'c') {
        event.preventDefault();
        current.controller.copySelected();
        return;
      }

      if (modifier && lowerKey === 'v') {
        event.preventDefault();
        current.controller.pasteSelected(15);
        return;
      }

      if (modifier && lowerKey === 'x') {
        event.preventDefault();
        current.controller.copySelected();
        current.controller.deleteSelected();
        return;
      }

      if (modifier && lowerKey === 'd') {
        event.preventDefault();
        current.controller.duplicateSelected(15);
        return;
      }

      if (modifier && lowerKey === 'a') {
        event.preventDefault();
        current.controller.selectAll();
        return;
      }

      if (modifier && lowerKey === 'l') {
        const active = current.controller.getCanvas()?.getActiveObject();
        if (!active) return;
        event.preventDefault();
        current.controller.toggleLock(active);
        return;
      }

      if (modifier && shift && key === ']') {
        const active = current.controller.getCanvas()?.getActiveObject();
        if (!active) return;
        event.preventDefault();
        current.controller.bringToFront(active);
        return;
      }

      if (modifier && shift && key === '[') {
        const active = current.controller.getCanvas()?.getActiveObject();
        if (!active) return;
        event.preventDefault();
        current.controller.sendToBack(active);
        return;
      }

      if (modifier && key === ']') {
        const active = current.controller.getCanvas()?.getActiveObject();
        if (!active) return;
        event.preventDefault();
        current.controller.bringForward(active);
        return;
      }

      if (modifier && key === '[') {
        const active = current.controller.getCanvas()?.getActiveObject();
        if (!active) return;
        event.preventDefault();
        current.controller.sendBackward(active);
        return;
      }

      if (alt && shift && lowerKey === 'c') {
        event.preventDefault();
        current.controller.alignObjects('centerH');
        return;
      }

      if (alt && shift && lowerKey === 'm') {
        event.preventDefault();
        current.controller.alignObjects('centerV');
        return;
      }

      if (shift && lowerKey === 'h' && !modifier && !alt) {
        event.preventDefault();
        current.controller.flipHorizontal();
        return;
      }

      if (shift && lowerKey === 'v' && !modifier && !alt) {
        event.preventDefault();
        current.controller.flipVertical();
        return;
      }

      if (key === 'Delete' || key === 'Backspace') {
        event.preventDefault();
        current.controller.deleteSelected();
        return;
      }

      if (key === 'Escape') {
        event.preventDefault();
        current.controller.clearSelection();
        return;
      }

      if (modifier && (key === '+' || key === '=')) {
        event.preventDefault();
        current.controller.zoomIn();
        return;
      }

      if (modifier && (key === '-' || key === '_')) {
        event.preventDefault();
        current.controller.zoomOut();
        return;
      }

      if (modifier && key === '0') {
        event.preventDefault();
        current.controller.resetZoom();
        return;
      }

      if (!modifier && !alt && !shift && (key === ' ' || key === 'Spacebar' || lowerKey === 'h')) {
        if (panHeldRef.current) return;
        event.preventDefault();
        panHeldRef.current = true;
        panRestoreToolRef.current = current.activeTool === 'pan' ? 'select' : current.activeTool;
        current.setTool('pan');
        return;
      }

      if (!modifier && !alt && !shift && key === 'v') {
        event.preventDefault();
        current.setTool('select');
        return;
      }

      if (!modifier && !alt && !shift && key === 't') {
        event.preventDefault();
        current.controller.addText();
        current.setTool('select');
        return;
      }

      if (!modifier && !alt && !shift && key === 'r') {
        event.preventDefault();
        current.controller.addRect();
        current.setTool('select');
        return;
      }

      if (!modifier && !alt && !shift && key === 'c') {
        event.preventDefault();
        current.controller.addCircle();
        current.setTool('select');
        return;
      }

      if (!modifier && !alt && !shift && key === 'i') {
        event.preventDefault();
        void current.onEyedropper();
        return;
      }

      if (!modifier && !alt && !shift && key === 'g') {
        event.preventDefault();
        current.toggleGrid();
        return;
      }

      if (!modifier && !alt && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        event.preventDefault();
        const direction = key === 'ArrowUp'
          ? 'up'
          : key === 'ArrowDown'
            ? 'down'
            : key === 'ArrowLeft'
              ? 'left'
              : 'right';
        current.onNudge(direction, shift ? 10 : 1);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!panHeldRef.current) return;
      if (!['h', 'H', ' ', 'Spacebar'].includes(event.key)) return;
      event.preventDefault();
      panHeldRef.current = false;
      const current = optionsRef.current;
      current.setTool(panRestoreToolRef.current ?? 'select');
      panRestoreToolRef.current = null;
    };

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      const current = optionsRef.current;
      if (isTypingTarget(event.target, current.controller)) return;
      event.preventDefault();
      if (event.deltaY < 0) current.controller.zoomIn();
      else if (event.deltaY > 0) current.controller.zoomOut();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);
}