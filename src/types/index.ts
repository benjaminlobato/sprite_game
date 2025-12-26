// Tile types
export type TileType = 'grass' | 'tree' | 'wall' | 'door' | 'bed' | 'fireplace';

// Tiles that block movement
export const BLOCKING_TILES: TileType[] = ['wall', 'tree'];

// Buildable tile types
export const BUILDABLE_TYPES: TileType[] = ['wall', 'door', 'bed', 'fireplace'];

export interface Tile {
  type: TileType;
  x: number;
  y: number;
}

// Agent types
export type AgentState = 'idle' | 'moving' | 'chopping';

export interface Agent {
  id: string;
  x: number;
  y: number;
  state: AgentState;
  targetX: number | null;
  targetY: number | null;
}

// Selection state
export interface Selection {
  x: number;
  y: number;
  tile: Tile;
}

// Task queue
export type TaskType = 'chop';

export interface Task {
  id: string;
  type: TaskType;
  x: number;
  y: number;
}

// Game constants
export const TILE_SIZE = 32; // pixels
export const TICK_INTERVAL = 500; // milliseconds
export const TREE_DENSITY = 0.12; // 12% of tiles will be trees
