import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';

export function ContextMenu() {
  const selection = useGameStore(state => state.selection);
  const contextMenuPos = useGameStore(state => state.contextMenuPos);
  const clearSelection = useGameStore(state => state.clearSelection);
  const chopSelectedTree = useGameStore(state => state.chopSelectedTree);
  const isTaskQueued = useGameStore(state => state.isTaskQueued);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        clearSelection();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearSelection();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [clearSelection]);

  if (!selection || !contextMenuPos) {
    return null;
  }

  const style: React.CSSProperties = {
    position: 'fixed',
    left: contextMenuPos.x,
    top: contextMenuPos.y,
    zIndex: 100,
  };

  const tileType = selection.tile.type;
  const isTree = tileType === 'tree';
  const isQueued = isTree && isTaskQueued(selection.x, selection.y);

  return (
    <div ref={menuRef} className="context-menu" style={style}>
      <div className="context-menu-header">
        <span className="context-menu-icon">
          {isTree ? (
            <img src="/sprites/tree.png" alt="tree" className="menu-sprite" />
          ) : (
            <span className="grass-icon"></span>
          )}
        </span>
        <span className="context-menu-title">
          {isTree ? 'Tree' : 'Grass'}
        </span>
        <span className="context-menu-coords">
          ({selection.x}, {selection.y})
        </span>
      </div>
      <div className="context-menu-divider" />
      <div className="context-menu-actions">
        {isTree ? (
          isQueued ? (
            <div className="context-menu-status">
              <span className="status-icon">✕</span>
              Queued for chopping
            </div>
          ) : (
            <button className="context-menu-btn" onClick={chopSelectedTree}>
              <span className="btn-icon">⚒</span>
              Chop
            </button>
          )
        ) : (
          <div className="context-menu-empty">No actions available</div>
        )}
      </div>
    </div>
  );
}
