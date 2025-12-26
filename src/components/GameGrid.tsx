import { useGameStore } from '../store/gameStore';
import { TILE_SIZE } from '../types';
import { Tile } from './Tile';
import { Agent } from './Agent';
import { ContextMenu } from './ContextMenu';
import { BuildPanel } from './BuildPanel';

export function GameGrid() {
  const map = useGameStore(state => state.map);
  const agents = useGameStore(state => state.agents);
  const gridWidth = useGameStore(state => state.gridWidth);
  const gridHeight = useGameStore(state => state.gridHeight);
  const clearSelection = useGameStore(state => state.clearSelection);

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${gridWidth}, ${TILE_SIZE}px)`,
    gridTemplateRows: `repeat(${gridHeight}, ${TILE_SIZE}px)`,
    gap: 0,
    position: 'relative',
    width: gridWidth * TILE_SIZE,
    height: gridHeight * TILE_SIZE,
  };

  const handleBackgroundClick = () => {
    clearSelection();
  };

  return (
    <div className="game-grid-container" onClick={handleBackgroundClick}>
      <div className="game-grid" style={gridStyle}>
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
      </div>

      {/* Context menu */}
      <ContextMenu />

      {/* Build panel */}
      <BuildPanel />
    </div>
  );
}
