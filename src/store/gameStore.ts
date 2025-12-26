import { create } from 'zustand';
import type { Tile, Agent, TileType, Selection, Task } from '../types';
import { TREE_DENSITY } from '../types';

// Tree propagation constants
const PROPAGATION_INTERVAL = 100; // Every 100 ticks
const BASE_PROPAGATION_CHANCE = 0.10; // 10% base chance
const MAX_TREE_COVERAGE = 0.70; // 70% max coverage
const PROPAGATION_RADIUS = 3; // Within 3 tiles

interface GameState {
  // Grid dimensions (computed from screen)
  gridWidth: number;
  gridHeight: number;

  // Map state
  map: Tile[][];

  // Agents
  agents: Agent[];

  // Task queue
  taskQueue: Task[];

  // Resources
  wood: number;

  // Simulation state
  tickCount: number;
  isRunning: boolean;

  // Selection & context menu
  selection: Selection | null;
  contextMenuPos: { x: number; y: number } | null;

  // Build mode
  buildMode: boolean;
  selectedBuildType: TileType | null;

  // Actions
  initializeGame: (width: number, height: number) => void;
  tick: () => void;
  startSimulation: () => void;
  stopSimulation: () => void;
  toggleSimulation: () => void;
  selectTile: (x: number, y: number, screenX: number, screenY: number) => void;
  clearSelection: () => void;
  chopSelectedTree: () => void;
  queueChopTask: (x: number, y: number) => void;
  isTaskQueued: (x: number, y: number) => boolean;
  toggleBuildMode: () => void;
  selectBuildType: (type: TileType | null) => void;
  buildAt: (x: number, y: number) => void;
}

// Generate the initial map with grass and random trees
function generateMap(width: number, height: number): Tile[][] {
  const map: Tile[][] = [];

  for (let y = 0; y < height; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < width; x++) {
      const type: TileType = Math.random() < TREE_DENSITY ? 'tree' : 'grass';
      row.push({ type, x, y });
    }
    map.push(row);
  }

  return map;
}

// Check if a tile blocks movement
function isBlocking(map: Tile[][], x: number, y: number, gridWidth: number, gridHeight: number): boolean {
  if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return true;
  const tile = map[y]?.[x];
  if (!tile) return true;
  // Trees don't block - agent needs to reach them to chop
  // Only walls block
  return tile.type === 'wall';
}

// Move one step toward target, avoiding blocking tiles
function moveToward(
  currentX: number,
  currentY: number,
  targetX: number,
  targetY: number,
  map: Tile[][],
  gridWidth: number,
  gridHeight: number
): { x: number; y: number } {
  // Try horizontal movement first
  if (currentX < targetX) {
    if (!isBlocking(map, currentX + 1, currentY, gridWidth, gridHeight)) {
      return { x: currentX + 1, y: currentY };
    }
  } else if (currentX > targetX) {
    if (!isBlocking(map, currentX - 1, currentY, gridWidth, gridHeight)) {
      return { x: currentX - 1, y: currentY };
    }
  }

  // Try vertical movement
  if (currentY < targetY) {
    if (!isBlocking(map, currentX, currentY + 1, gridWidth, gridHeight)) {
      return { x: currentX, y: currentY + 1 };
    }
  } else if (currentY > targetY) {
    if (!isBlocking(map, currentX, currentY - 1, gridWidth, gridHeight)) {
      return { x: currentX, y: currentY - 1 };
    }
  }

  // Try alternate directions if primary is blocked
  const directions = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
    { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
  ];

  for (const { dx, dy } of directions) {
    const newX = currentX + dx;
    const newY = currentY + dy;
    if (!isBlocking(map, newX, newY, gridWidth, gridHeight)) {
      // Check if this moves us closer to target
      const currentDist = Math.abs(targetX - currentX) + Math.abs(targetY - currentY);
      const newDist = Math.abs(targetX - newX) + Math.abs(targetY - newY);
      if (newDist < currentDist) {
        return { x: newX, y: newY };
      }
    }
  }

  // Can't move - stuck
  return { x: currentX, y: currentY };
}

// Create a single starting agent in a random grass tile
function createInitialAgent(map: Tile[][], gridWidth: number, gridHeight: number): Agent {
  const grassTiles: { x: number; y: number }[] = [];
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      if (map[y][x].type === 'grass') {
        grassTiles.push({ x, y });
      }
    }
  }

  const startPos = grassTiles[Math.floor(Math.random() * grassTiles.length)] || { x: 0, y: 0 };

  return {
    id: 'agent-1',
    x: startPos.x,
    y: startPos.y,
    state: 'idle',
    targetX: null,
    targetY: null,
  };
}

// Find grass tiles within radius of a position
function getValidSpawnTiles(
  map: Tile[][],
  centerX: number,
  centerY: number,
  radius: number,
  gridWidth: number,
  gridHeight: number
): { x: number; y: number }[] {
  const validTiles: { x: number; y: number }[] = [];

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue; // Skip center tile

      const x = centerX + dx;
      const y = centerY + dy;

      // Check bounds
      if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) continue;

      // Check if it's grass
      if (map[y][x].type === 'grass') {
        validTiles.push({ x, y });
      }
    }
  }

  return validTiles;
}

// Count trees on the map
function countTrees(map: Tile[][]): number {
  let count = 0;
  for (const row of map) {
    for (const tile of row) {
      if (tile.type === 'tree') count++;
    }
  }
  return count;
}

// Propagate trees (called every PROPAGATION_INTERVAL ticks)
function propagateTrees(
  map: Tile[][],
  gridWidth: number,
  gridHeight: number
): Tile[][] {
  const totalTiles = gridWidth * gridHeight;
  const treeCount = countTrees(map);
  const currentCoverage = treeCount / totalTiles;

  // No propagation if at or above max coverage
  if (currentCoverage >= MAX_TREE_COVERAGE) return map;

  // Scale probability: full chance at 0% coverage, 0 chance at MAX_TREE_COVERAGE
  const coverageRatio = currentCoverage / MAX_TREE_COVERAGE;
  const adjustedChance = BASE_PROPAGATION_CHANCE * (1 - coverageRatio);

  // Find all trees and potentially spawn new ones
  const newTrees: { x: number; y: number }[] = [];

  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      if (map[y][x].type === 'tree') {
        // Roll for propagation
        if (Math.random() < adjustedChance) {
          const validSpawns = getValidSpawnTiles(map, x, y, PROPAGATION_RADIUS, gridWidth, gridHeight);
          if (validSpawns.length > 0) {
            // Pick a random valid tile
            const spawn = validSpawns[Math.floor(Math.random() * validSpawns.length)];
            newTrees.push(spawn);
          }
        }
      }
    }
  }

  // Apply new trees to map (create new map to avoid mutation issues)
  if (newTrees.length > 0) {
    const newMap = map.map(row => row.map(tile => ({ ...tile })));
    for (const { x, y } of newTrees) {
      // Double-check it's still grass (another tree might have spawned here)
      if (newMap[y][x].type === 'grass') {
        newMap[y][x].type = 'tree';
      }
    }
    return newMap;
  }

  return map;
}

let taskIdCounter = 0;

export const useGameStore = create<GameState>((set, get) => ({
  gridWidth: 20,
  gridHeight: 15,
  map: [],
  agents: [],
  taskQueue: [],
  wood: 0,
  tickCount: 0,
  isRunning: false,
  selection: null,
  contextMenuPos: null,
  buildMode: false,
  selectedBuildType: null,

  initializeGame: (width: number, height: number) => {
    const map = generateMap(width, height);
    const agent = createInitialAgent(map, width, height);
    taskIdCounter = 0;

    set({
      gridWidth: width,
      gridHeight: height,
      map,
      agents: [agent],
      taskQueue: [],
      wood: 0,
      tickCount: 0,
      isRunning: false,
      selection: null,
      contextMenuPos: null,
      buildMode: false,
      selectedBuildType: null,
    });
  },

  tick: () => {
    const { map, agents, taskQueue, wood, tickCount, isRunning, gridWidth, gridHeight } = get();

    if (!isRunning) return;

    let newMap = map.map(row => row.map(tile => ({ ...tile })));
    let newWood = wood;
    let newTaskQueue = [...taskQueue];
    const newTickCount = tickCount + 1;

    // Tree propagation every PROPAGATION_INTERVAL ticks
    if (newTickCount % PROPAGATION_INTERVAL === 0) {
      newMap = propagateTrees(newMap, gridWidth, gridHeight);
    }

    const newAgents = agents.map(agent => {
      const updatedAgent = { ...agent };

      // If agent has no target, pick up next task from queue
      if (updatedAgent.targetX === null || updatedAgent.targetY === null) {
        if (newTaskQueue.length > 0) {
          const nextTask = newTaskQueue[0];
          // Check if the task target is still valid (tree still exists)
          if (newMap[nextTask.y]?.[nextTask.x]?.type === 'tree') {
            updatedAgent.targetX = nextTask.x;
            updatedAgent.targetY = nextTask.y;
            updatedAgent.state = 'moving';
            newTaskQueue = newTaskQueue.slice(1); // Remove from queue
          } else {
            // Tree is gone, skip this task
            newTaskQueue = newTaskQueue.slice(1);
          }
        } else {
          updatedAgent.state = 'idle';
        }
        return updatedAgent;
      }

      // Move or chop
      const atTarget =
        updatedAgent.x === updatedAgent.targetX &&
        updatedAgent.y === updatedAgent.targetY;

      if (atTarget) {
        if (newMap[updatedAgent.targetY][updatedAgent.targetX].type === 'tree') {
          updatedAgent.state = 'chopping';
          newMap[updatedAgent.targetY][updatedAgent.targetX].type = 'grass';
          newWood += 1;
        }
        updatedAgent.targetX = null;
        updatedAgent.targetY = null;
        // Don't set to idle yet - let next tick pick up new task
      } else {
        updatedAgent.state = 'moving';
        const newPos = moveToward(
          updatedAgent.x,
          updatedAgent.y,
          updatedAgent.targetX,
          updatedAgent.targetY,
          newMap,
          gridWidth,
          gridHeight
        );
        updatedAgent.x = newPos.x;
        updatedAgent.y = newPos.y;
      }

      return updatedAgent;
    });

    set({
      map: newMap,
      agents: newAgents,
      taskQueue: newTaskQueue,
      wood: newWood,
      tickCount: newTickCount,
    });
  },

  startSimulation: () => set({ isRunning: true }),
  stopSimulation: () => set({ isRunning: false }),
  toggleSimulation: () => set(state => ({ isRunning: !state.isRunning })),

  selectTile: (x: number, y: number, screenX: number, screenY: number) => {
    const { map } = get();
    if (y >= 0 && y < map.length && x >= 0 && x < map[0].length) {
      const tile = map[y][x];
      set({
        selection: { x, y, tile },
        contextMenuPos: { x: screenX, y: screenY },
      });
    }
  },

  clearSelection: () => {
    set({ selection: null, contextMenuPos: null });
  },

  chopSelectedTree: () => {
    const { selection } = get();
    if (selection && selection.tile.type === 'tree') {
      get().queueChopTask(selection.x, selection.y);
    }
    set({ selection: null, contextMenuPos: null });
  },

  queueChopTask: (x: number, y: number) => {
    const { taskQueue, map } = get();

    // Check if already queued
    const alreadyQueued = taskQueue.some(task => task.x === x && task.y === y);
    if (alreadyQueued) return;

    // Check if it's actually a tree
    if (map[y]?.[x]?.type !== 'tree') return;

    const newTask: Task = {
      id: `task-${++taskIdCounter}`,
      type: 'chop',
      x,
      y,
    };

    set({ taskQueue: [...taskQueue, newTask] });
  },

  isTaskQueued: (x: number, y: number) => {
    const { taskQueue, agents } = get();
    // Check if in queue
    const inQueue = taskQueue.some(task => task.x === x && task.y === y);
    // Check if agent is currently targeting this
    const agentTargeting = agents.some(
      agent => agent.targetX === x && agent.targetY === y
    );
    return inQueue || agentTargeting;
  },

  toggleBuildMode: () => {
    set(state => ({
      buildMode: !state.buildMode,
      selectedBuildType: state.buildMode ? null : 'wall', // Default to wall when entering
      selection: null,
      contextMenuPos: null,
    }));
  },

  selectBuildType: (type: TileType | null) => {
    set({ selectedBuildType: type });
  },

  buildAt: (x: number, y: number) => {
    const { map, selectedBuildType, agents } = get();

    if (!selectedBuildType) return;

    // Can only build on grass
    if (map[y]?.[x]?.type !== 'grass') return;

    // Can't build where agent is standing
    const agentHere = agents.some(agent => agent.x === x && agent.y === y);
    if (agentHere) return;

    // Build the structure
    const newMap = map.map(row => row.map(tile => ({ ...tile })));
    newMap[y][x].type = selectedBuildType;

    set({ map: newMap });
  },
}));
