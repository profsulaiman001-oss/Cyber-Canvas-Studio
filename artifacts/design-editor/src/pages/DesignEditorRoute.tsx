import { useLocation } from 'wouter';
import { EditorProvider } from '@/store/editorStore';
import DesignEditor from '@/pages/DesignEditor';

/**
 * Wraps the editor with its own EditorProvider so the provider is only
 * mounted when the /editor route is active.
 */
export default function DesignEditorRoute() {
  const [, navigate] = useLocation();
  return (
    <EditorProvider>
      <DesignEditor onGoHome={() => navigate('/')} />
    </EditorProvider>
  );
}
