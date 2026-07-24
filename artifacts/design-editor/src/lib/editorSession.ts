/**
 * Module-level bridge that carries data from HomeScreen → DesignEditor
 * without needing URL params or context.
 * Consumed exactly once on DesignEditor mount.
 */

export interface EditorSessionData {
  /** null = new blank project */
  projectId: string | null;
  projectName: string;
  canvasWidth: number;
  canvasHeight: number;
  /** Full Fabric JSON — only set when opening an existing project */
  canvasJSON: object | null;
}

let _pending: EditorSessionData | null = null;

export function setPendingSession(data: EditorSessionData): void {
  _pending = data;
}

export function consumePendingSession(): EditorSessionData | null {
  const d = _pending;
  _pending = null;
  return d;
}
