import { useEffect, useRef, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';

export function ContextMenu() {
  const selection = useGameStore(state => state.selection);
  const multiSelection = useGameStore(state => state.multiSelection);
  const contextMenuPos = useGameStore(state => state.contextMenuPos);
  const clearSelection = useGameStore(state => state.clearSelection);
  const chopSelectedTree = useGameStore(state => state.chopSelectedTree);
  const chopSelectedTrees = useGameStore(state => state.chopSelectedTrees);
  const isTaskQueued = useGameStore(state => state.isTaskQueued);
  const menuRef = useRef<HTMLDivElement>(null);

  // Analyze multi-selection
  const multiSelectionStats = useMemo(() => {
    if (multiSelection.length === 0) return null;

    const typeCounts: Record<string, number> = {};
    let choppableTrees = 0;

    for (const tile of multiSelection) {
      typeCounts[tile.type] = (typeCounts[tile.type] || 0) + 1;
      if (tile.type === 'tree' && !isTaskQueued(tile.x, tile.y)) {
        choppableTrees++;
      }
    }

    return {
      total: multiSelection.length,
      typeCounts,
      choppableTrees,
    };
  }, [multiSelection, isTaskQueued]);

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

  // Nothing to show
  if (!contextMenuPos) {
    return null;
  }

  // No selection at all
  if (!selection && multiSelection.length === 0) {
    return null;
  }

  const style: React.CSSProperties = {
    position: 'fixed',
    left: contextMenuPos.x,
    top: contextMenuPos.y,
    zIndex: 100,
  };

  // Multi-selection mode
  if (multiSelection.length > 0 && multiSelectionStats) {
    const typeList = Object.entries(multiSelectionStats.typeCounts)
      .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
      .join(', ');

    return (
      <div ref={menuRef} className="context-menu" style={style}>
        <div className="context-menu-header">
          <span className="context-menu-icon">
            <span className="multi-select-icon">☐</span>
          </span>
          <span className="context-menu-title">
            {multiSelectionStats.total} tiles
          </span>
        </div>
        <div className="context-menu-types">
          {typeList}
        </div>
        <div className="context-menu-divider" />
        <div className="context-menu-actions">
          {multiSelectionStats.choppableTrees > 0 ? (
            <button className="context-menu-btn" onClick={chopSelectedTrees}>
              <span className="btn-icon">⚒</span>
              Chop {multiSelectionStats.choppableTrees} tree{multiSelectionStats.choppableTrees > 1 ? 's' : ''}
            </button>
          ) : (
            <div className="context-menu-empty">No choppable trees selected</div>
          )}
        </div>
      </div>
    );
  }

  // Single selection mode
  if (!selection) {
    return null;
  }

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
