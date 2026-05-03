import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import DesignEditor from "@/pages/DesignEditor";
import { EditorProvider } from "@/store/editorStore";

function App() {
  return (
    <EditorProvider>
      <TooltipProvider>
        <DesignEditor />
        <Toaster />
      </TooltipProvider>
    </EditorProvider>
  );
}

export default App;
