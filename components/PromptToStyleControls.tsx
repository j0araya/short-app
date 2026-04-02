'use client';

import { useState } from 'react';
import { usePromptToStyle } from './PromptToStyleProvider';

/**
 * Control panel for PromptToStyle
 * 
 * Usage:
 * ```tsx
 * import { PromptToStyleControls } from '@/components/PromptToStyleControls';
 * 
 * export default function Page() {
 *   return (
 *     <div>
 *       <PromptToStyleControls />
 *       <YourContent />
 *     </div>
 *   );
 * }
 * ```
 */
export function PromptToStyleControls() {
  const pts = usePromptToStyle();
  const [isEnabled, setIsEnabled] = useState(false);

  if (!pts) {
    return null; // Not initialized yet or no API key
  }

  const handleToggle = () => {
    pts.toggle();
    setIsEnabled(!isEnabled);
  };

  const handleUndo = () => {
    pts.undo();
  };

  const handleRedo = () => {
    pts.redo();
  };

  const handleClear = () => {
    if (confirm('Clear all changes? This cannot be undone.')) {
      pts.clear();
    }
  };

  const handleCommit = async () => {
    const changes = pts.getChanges();
    
    if (changes.length === 0) {
      alert('No changes to commit');
      return;
    }

    if (confirm(`Commit ${changes.length} change(s) and create MR?`)) {
      await pts.commit();
    }
  };

  const handleExport = () => {
    const json = pts.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-to-style-changes-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed bottom-4 right-4 z-[999998] bg-white rounded-lg shadow-lg border border-gray-200 p-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">PromptToStyle</h3>
          <span className={`text-xs px-2 py-1 rounded ${isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {isEnabled ? 'Active' : 'Inactive'}
          </span>
        </div>

        <button
          onClick={handleToggle}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            isEnabled
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {isEnabled ? 'Disable' : 'Enable'}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleUndo}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium text-gray-700 transition-colors"
            title="Undo (Ctrl+Z)"
          >
            ↶ Undo
          </button>
          <button
            onClick={handleRedo}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium text-gray-700 transition-colors"
            title="Redo (Ctrl+Shift+Z)"
          >
            ↷ Redo
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleClear}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium text-gray-700 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium text-gray-700 transition-colors"
          >
            Export
          </button>
        </div>

        <button
          onClick={handleCommit}
          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm font-medium transition-colors"
          title="Commit (Ctrl+Shift+S)"
        >
          Commit & Create MR
        </button>

        <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
          <p className="mb-1">Shortcuts:</p>
          <p>Ctrl+Shift+E - Toggle</p>
          <p>Ctrl+Z - Undo</p>
          <p>Ctrl+Shift+Z - Redo</p>
          <p>Ctrl+Shift+S - Commit</p>
        </div>
      </div>
    </div>
  );
}
