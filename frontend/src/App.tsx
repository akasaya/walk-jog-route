import { useState } from "react";
import { ActiveRoute } from "./pages/ActiveRoute";
import { Home } from "./pages/Home";
import type { Mode, RouteSuggestionResponse } from "./types/route";

interface ActiveRouteData {
  suggestion: RouteSuggestionResponse;
  mode: Mode;
}

function App() {
  const [activeRoute, setActiveRoute] = useState<ActiveRouteData | null>(null);

  if (activeRoute) {
    return (
      <ActiveRoute
        suggestion={activeRoute.suggestion}
        mode={activeRoute.mode}
        onFinish={() => setActiveRoute(null)}
      />
    );
  }

  return (
    <Home
      onStartRoute={(suggestion, mode) => setActiveRoute({ suggestion, mode })}
    />
  );
}

export default App;
