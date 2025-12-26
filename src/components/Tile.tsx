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
  const isBuildQueued = useGameStore(state => state.isBuildQueued);
  const isTileInMultiSelection = useGameStore(state => state.isTileInMultiSelection);
  const ignoreTileClicks = useGameStore(state => state.ignoreTileClicks);
  const buildMode = useGameStore(state => state.buildMode);
  const buildAt = useGameStore(state => state.buildAt);

  const isSelected = selection?.x === tile.x && selection?.y === tile.y;
  const isMultiSelected = isTileInMultiSelection(tile.x, tile.y);
  const isChopQueued = tile.type === 'tree' && isTaskQueued(tile.x, tile.y);
  const buildTask = isBuildQueued(tile.x, tile.y);
  const hasBuildQueued = !!buildTask;

  let tileClass = `tile tile-${tile.type}`;
  if (isSelected) tileClass += ' tile-selected';
  if (isMultiSelected) tileClass += ' tile-multi-selected';
  if (isChopQueued) tileClass += ' tile-queued';
  if (hasBuildQueued) tileClass += ' tile-build-queued';
  if (buildMode && tile.type === 'grass' && !hasBuildQueued) tileClass += ' tile-buildable';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Ignore clicks right after a drag selection
    if (ignoreTileClicks) return;

    if (buildMode) {
      buildAt(tile.x, tile.y);
    } else {
      selectTile(tile.x, tile.y, e.clientX, e.clientY);
    }
  };

  const spriteUrl = TILE_SPRITES[tile.type];
  const ghostSpriteUrl = buildTask?.buildType ? TILE_SPRITES[buildTask.buildType] : null;

  return (
    <div className={tileClass} onClick={handleClick}>
      {spriteUrl && (
        <img src={spriteUrl} alt={tile.type} className="tile-sprite" />
      )}
      {ghostSpriteUrl && buildTask && (
        <img src={ghostSpriteUrl} alt={`planned ${buildTask.buildType}`} className="tile-sprite tile-ghost" />
      )}
      {isChopQueued && <span className="tile-marker">✕</span>}
    </div>
  );
}
