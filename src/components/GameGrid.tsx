import { useState, useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { TILE_SIZE } from '../types';
import { Tile } from './Tile';
import { Agent } from './Agent';
import { ContextMenu } from './ContextMenu';
import { BuildPanel } from './BuildPanel';
import { Announcements } from './Announcements';

interface DragState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function GameGrid() {
  const map = useGameStore(state => state.map);
  const agents = useGameStore(state => state.agents);
  const gridWidth = useGameStore(state => state.gridWidth);
  const gridHeight = useGameStore(state => state.gridHeight);
  const buildMode = useGameStore(state => state.buildMode);
  const clearSelection = useGameStore(state => state.clearSelection);
  const setMultiSelection = useGameStore(state => state.setMultiSelection);
  const setIgnoreTileClicks = useGameStore(state => state.setIgnoreTileClicks);

  const [isDragging, setIsDragging] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const justFinishedDragRef = useRef(false);

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${gridWidth}, ${TILE_SIZE}px)`,
    gridTemplateRows: `repeat(${gridHeight}, ${TILE_SIZE}px)`,
    gap: 0,
    position: 'relative',
    width: gridWidth * TILE_SIZE,
    height: gridHeight * TILE_SIZE,
  };

  const getGridPosition = useCallback((clientX: number, clientY: number) => {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start drag on left click and not in build mode
    if (e.button !== 0 || buildMode) return;

    // Only start drag if clicking on the grid itself, not context menu etc.
    if (!gridRef.current?.contains(e.target as Node)) return;

    const pos = getGridPosition(e.clientX, e.clientY);
    if (!pos) return;

    setIsDragging(true);
    setDragState({
      startX: pos.x,
      startY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
    });
    clearSelection();
  }, [buildMode, getGridPosition, clearSelection]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragState) return;

    const pos = getGridPosition(e.clientX, e.clientY);
    if (!pos) return;

    setDragState({
      ...dragState,
      currentX: pos.x,
      currentY: pos.y,
    });
  }, [isDragging, dragState, getGridPosition]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragState) {
      setIsDragging(false);
      setDragState(null);
      return;
    }

    // Calculate selection rectangle in tile coordinates
    const minX = Math.min(dragState.startX, dragState.currentX);
    const maxX = Math.max(dragState.startX, dragState.currentX);
    const minY = Math.min(dragState.startY, dragState.currentY);
    const maxY = Math.max(dragState.startY, dragState.currentY);

    // Convert to tile indices
    const startTileX = Math.floor(minX / TILE_SIZE);
    const endTileX = Math.floor(maxX / TILE_SIZE);
    const startTileY = Math.floor(minY / TILE_SIZE);
    const endTileY = Math.floor(maxY / TILE_SIZE);

    // Check if this was a significant drag (more than ~5 pixels)
    const dragDistance = Math.sqrt(
      Math.pow(dragState.currentX - dragState.startX, 2) +
      Math.pow(dragState.currentY - dragState.startY, 2)
    );

    if (dragDistance > 5) {
      // Collect all tiles in the selection rectangle
      const selectedTiles = [];
      for (let y = startTileY; y <= endTileY; y++) {
        for (let x = startTileX; x <= endTileX; x++) {
          if (y >= 0 && y < gridHeight && x >= 0 && x < gridWidth) {
            selectedTiles.push(map[y][x]);
          }
        }
      }

      if (selectedTiles.length > 0) {
        // Prevent tile click events from clearing the selection
        setIgnoreTileClicks(true);
        setMultiSelection(selectedTiles, e.clientX, e.clientY);
        justFinishedDragRef.current = true;
        setTimeout(() => {
          justFinishedDragRef.current = false;
          setIgnoreTileClicks(false);
        }, 100);
      }
    }

    setIsDragging(false);
    setDragState(null);
  }, [isDragging, dragState, map, gridWidth, gridHeight, setMultiSelection, setIgnoreTileClicks]);

  const handleBackgroundClick = useCallback(() => {
    // Only clear if it's a simple click, not end of drag
    if (!isDragging && !justFinishedDragRef.current) {
      clearSelection();
    }
  }, [isDragging, clearSelection]);

  // Calculate selection rectangle style
  const selectionRectStyle: React.CSSProperties | null = dragState && isDragging ? {
    position: 'absolute',
    left: Math.min(dragState.startX, dragState.currentX),
    top: Math.min(dragState.startY, dragState.currentY),
    width: Math.abs(dragState.currentX - dragState.startX),
    height: Math.abs(dragState.currentY - dragState.startY),
    pointerEvents: 'none',
  } : null;

  return (
    <div
      className="game-grid-container"
      onClick={handleBackgroundClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        if (isDragging) {
          setIsDragging(false);
          setDragState(null);
        }
      }}
    >
      <div className="game-grid" style={gridStyle} ref={gridRef}>
        {/* Render tiles */}
        {map.map((row, y) =>
          row.map((tile, x) => (
            <Tile key={`${x}-${y}`} tile={tile} />
          ))
        )}

        {/* Render agents on top */}
        {agents.map(agent => (
          <Agent key={agent.id} agent={agent} />
        ))}

        {/* Selection rectangle */}
        {selectionRectStyle && (
          <div className="selection-rect" style={selectionRectStyle} />
        )}
      </div>

      {/* Context menu */}
      <ContextMenu />

      {/* Build panel */}
      <BuildPanel />

      {/* Announcements */}
      <Announcements />
    </div>
  );
}
