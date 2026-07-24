import { Switch, Route } from 'wouter';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import HomeScreen from '@/pages/HomeScreen';
import DesignEditorRoute from '@/pages/DesignEditorRoute';

function App() {
  return (
    <TooltipProvider>
      <Switch>
        <Route path="/" component={HomeScreen} />
        <Route path="/editor" component={DesignEditorRoute} />
        {/* Fallback → home */}
        <Route component={HomeScreen} />
      </Switch>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
