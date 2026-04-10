import { type Component } from 'solid-js';

const App: Component = () => {
  return (
    <div class="flex h-screen w-screen bg-background text-foreground">
      <div class="flex flex-1 items-center justify-center text-muted-foreground">
        Chat app loading...
      </div>
    </div>
  );
};

export default App;
