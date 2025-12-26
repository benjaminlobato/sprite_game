import type { Tile as TileType } from '../types';
import { useGameStore } from '../store/gameStore';

interface TileProps {
  tile: TileType;
}

const TILE_SPRITES: Record<string, string> = {
  tree: '/sprites/tree.png',
  wall: '/sprites/wall.png',
  door: '/sprites/door.png',
  bed: '/sprites/bed.png',
  fireplace: '/sprites/fireplace.png',
};

export function Tile({ tile }: TileProps) {
  const selection = useGameStore(state => state.selection);
  const selectTile = useGameStore(state => state.selectTile);
  const isTaskQueued = useGameStore(state => state.isTaskQueued);
  const buildMode = useGameStore(state => state.buildMode);
  const buildAt = useGameStore(state => state.buildAt);

  const isSelected = selection?.x === tile.x && selection?.y === tile.y;
  const isQueued = tile.type === 'tree' && isTaskQueued(tile.x, tile.y);

  let tileClass = `tile tile-${tile.type}`;
  if (isSelected) tileClass += ' tile-selected';
  if (isQueued) tileClass += ' tile-queued';
  if (buildMode && tile.type === 'grass') tileClass += ' tile-buildable';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (buildMode) {
      buildAt(tile.x, tile.y);
    } else {
      selectTile(tile.x, tile.y, e.clientX, e.clientY);
    }
  };

  const spriteUrl = TILE_SPRITES[tile.type];

  return (
    <div className={tileClass} onClick={handleClick}>
      {spriteUrl && (
        <img src={spriteUrl} alt={tile.type} className="tile-sprite" />
      )}
      {isQueued && <span className="tile-marker">✕</span>}
    </div>
  );
}
