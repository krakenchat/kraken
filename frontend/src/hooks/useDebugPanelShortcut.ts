import { useState, useEffect, useCallback } from "react";

/**
 * Hook to manage debug panel visibility with keyboard shortcut
 *
 * Provides a boolean state and toggle function for showing/hiding
 * a debug panel using Ctrl+Shift+D keyboard shortcut.
 *
 * @returns Object with `showDebugPanel` state and `toggleDebugPanel` function
 *
 * @example
 * ```tsx
 * const { showDebugPanel, toggleDebugPanel } = useDebugPanelShortcut();
 *
 * return (
 *   <>
 *     <button onClick={toggleDebugPanel}>Toggle Debug</button>
 *     {showDebugPanel && <DebugPanel />}
 *   </>
 * );
 * ```
 */
export function useDebugPanelShortcut() {
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  const toggleDebugPanel = useCallback(() => {
    setShowDebugPanel((prev) => !prev);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === "D") {
        event.preventDefault();
        toggleDebugPanel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleDebugPanel]);

  return {
    showDebugPanel,
    toggleDebugPanel,
    setShowDebugPanel,
  };
}
