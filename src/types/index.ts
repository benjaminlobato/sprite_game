// Tile types
export type TileType = 'grass' | 'tree' | 'wall' | 'door' | 'bed' | 'fireplace';

// Tiles that block movement
export const BLOCKING_TILES: TileType[] = ['wall', 'tree'];

// Buildable tile types
export const BUILDABLE_TYPES: TileType[] = ['wall', 'door', 'bed', 'fireplace'];

// Build costs (in wood)
export const BUILD_COSTS: Record<string, number> = {
  wall: 1,
  door: 10,
  bed: 10,
  fireplace: 10,
};

export interface Tile {
  type: TileType;
  x: number;
  y: number;
}

// Agent types
export type AgentState = 'idle' | 'moving' | 'chopping' | 'building';

export interface Agent {
  id: string;
  x: number;
  y: number;
  state: AgentState;
  targetX: number | null;
  targetY: number | null;
  currentTask: Task | null;
}

// Selection state
export interface Selection {
  x: number;
  y: number;
  tile: Tile;
}

// Task queue
export type TaskType = 'chop' | 'build';

export interface Task {
  id: string;
  type: TaskType;
  x: number;
  y: number;
  buildType?: TileType; // For build tasks
}

// Game constants
export const TILE_SIZE = 32; // pixels
export const TICK_INTERVAL = 500; // milliseconds
export const TREE_DENSITY = 0.12; // 12% of tiles will be trees
