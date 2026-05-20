import { useState } from "react";
import { ActiveRoute } from "./pages/ActiveRoute";
import { History } from "./pages/History";
import { Home } from "./pages/Home";
import type { Mode, RouteSuggestionResponse } from "./types/route";

interface ActiveRouteData {
  suggestion: RouteSuggestionResponse;
  mode: Mode;
}

function App() {
  const [activeRoute, setActiveRoute] = useState<ActiveRouteData | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  if (activeRoute) {
    return (
      <ActiveRoute
        suggestion={activeRoute.suggestion}
        mode={activeRoute.mode}
        onFinish={() => setActiveRoute(null)}
      />
    );
  }

  if (showHistory) {
    return <History onBack={() => setShowHistory(false)} />;
  }

  return (
    <Home
      onStartRoute={(suggestion, mode) => setActiveRoute({ suggestion, mode })}
      onGoHistory={() => setShowHistory(true)}
    />
  );
}

export default App;
