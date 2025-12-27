import { create } from 'zustand';
import type { Tile, Agent, TileType, Selection, Task } from '../types';
import { TREE_DENSITY, BUILD_COSTS } from '../types';

// Tree propagation constants
const PROPAGATION_INTERVAL = 100; // Every 100 ticks
const BASE_PROPAGATION_CHANCE = 0.10; // 10% base chance
const MAX_TREE_COVERAGE = 0.70; // 70% max coverage
const PROPAGATION_RADIUS = 3; // Within 3 tiles

// Worker spawning constants
const WORKER_SPAWN_INTERVAL = 10; // Check every 10 ticks
const WORKER_SPAWN_CHANCE = 0.10; // 10% chance
const MAX_WORKERS = 2;

// Announcement system
export interface Announcement {
  id: number;
  message: string;
  timestamp: number;
}

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
  multiSelection: Tile[];
  contextMenuPos: { x: number; y: number } | null;
  ignoreTileClicks: boolean;

  // Build mode
  buildMode: boolean;
  selectedBuildType: TileType | null;

  // Announcements
  announcements: Announcement[];

  // Actions
  initializeGame: (width: number, height: number) => void;
  tick: () => void;
  startSimulation: () => void;
  stopSimulation: () => void;
  toggleSimulation: () => void;
  selectTile: (x: number, y: number, screenX: number, screenY: number) => void;
  setMultiSelection: (tiles: Tile[], screenX: number, screenY: number) => void;
  clearSelection: () => void;
  chopSelectedTree: () => void;
  chopSelectedTrees: () => void;
  queueChopTask: (x: number, y: number) => void;
  isTaskQueued: (x: number, y: number) => boolean;
  isTileInMultiSelection: (x: number, y: number) => boolean;
  setIgnoreTileClicks: (ignore: boolean) => void;
  toggleBuildMode: () => void;
  selectBuildType: (type: TileType | null) => void;
  buildAt: (x: number, y: number) => void;
  isBuildQueued: (x: number, y: number) => Task | undefined;
  getBuildCost: (type: TileType) => number;
  addAnnouncement: (message: string) => void;
  clearOldAnnouncements: () => void;
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
    currentTask: null,
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
// Returns { map, newTreeCount }
function propagateTrees(
  map: Tile[][],
  gridWidth: number,
  gridHeight: number
): { map: Tile[][]; newTreeCount: number } {
  const totalTiles = gridWidth * gridHeight;
  const treeCount = countTrees(map);
  const currentCoverage = treeCount / totalTiles;

  // No propagation if at or above max coverage
  if (currentCoverage >= MAX_TREE_COVERAGE) return { map, newTreeCount: 0 };

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
    let actualNewTrees = 0;
    for (const { x, y } of newTrees) {
      // Double-check it's still grass (another tree might have spawned here)
      if (newMap[y][x].type === 'grass') {
        newMap[y][x].type = 'tree';
        actualNewTrees++;
      }
    }
    return { map: newMap, newTreeCount: actualNewTrees };
  }

  return { map, newTreeCount: 0 };
}

let taskIdCounter = 0;
let announcementIdCounter = 0;
let workerIdCounter = 1; // Start at 1 since initial worker is agent-1

// Find all fireplaces on the map
function findFireplaces(map: Tile[][], gridWidth: number, gridHeight: number): { x: number; y: number }[] {
  const fireplaces: { x: number; y: number }[] = [];
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      if (map[y][x].type === 'fireplace') {
        fireplaces.push({ x, y });
      }
    }
  }
  return fireplaces;
}

// Find a valid spawn location near a fireplace (grass tile within 2 tiles)
function findSpawnNearFireplace(
  map: Tile[][],
  fireplace: { x: number; y: number },
  agents: Agent[],
  gridWidth: number,
  gridHeight: number
): { x: number; y: number } | null {
  const validSpots: { x: number; y: number }[] = [];

  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx === 0 && dy === 0) continue;
      const x = fireplace.x + dx;
      const y = fireplace.y + dy;

      if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) continue;
      if (map[y][x].type !== 'grass') continue;

      // Check no agent is there
      const occupied = agents.some(a => a.x === x && a.y === y);
      if (occupied) continue;

      validSpots.push({ x, y });
    }
  }

  if (validSpots.length === 0) return null;
  return validSpots[Math.floor(Math.random() * validSpots.length)];
}

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
  multiSelection: [],
  contextMenuPos: null,
  ignoreTileClicks: false,
  buildMode: false,
  selectedBuildType: null,
  announcements: [],

  initializeGame: (width: number, height: number) => {
    const map = generateMap(width, height);
    const agent = createInitialAgent(map, width, height);
    taskIdCounter = 0;
    announcementIdCounter = 0;
    workerIdCounter = 1;

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
      multiSelection: [],
      contextMenuPos: null,
      ignoreTileClicks: false,
      buildMode: false,
      selectedBuildType: null,
      announcements: [],
    });
  },

  tick: () => {
    const { map, agents, taskQueue, wood, tickCount, isRunning, gridWidth, gridHeight, announcements } = get();

    if (!isRunning) return;

    let newMap = map.map(row => row.map(tile => ({ ...tile })));
    let newWood = wood;
    let newTaskQueue = [...taskQueue];
    let newAgents = [...agents];
    let newAnnouncements = [...announcements];
    const newTickCount = tickCount + 1;

    // Helper to add announcement
    const announce = (message: string) => {
      newAnnouncements.push({
        id: ++announcementIdCounter,
        message,
        timestamp: Date.now(),
      });
      // Keep only last 5 announcements
      if (newAnnouncements.length > 5) {
        newAnnouncements = newAnnouncements.slice(-5);
      }
    };

    // Tree propagation every PROPAGATION_INTERVAL ticks
    if (newTickCount % PROPAGATION_INTERVAL === 0) {
      const result = propagateTrees(newMap, gridWidth, gridHeight);
      newMap = result.map;
      if (result.newTreeCount > 0) {
        announce(`${result.newTreeCount} new tree${result.newTreeCount > 1 ? 's' : ''} grew`);
      }
    }

    // Worker spawning near fireplaces every WORKER_SPAWN_INTERVAL ticks
    if (newTickCount % WORKER_SPAWN_INTERVAL === 0 && newAgents.length < MAX_WORKERS) {
      const fireplaces = findFireplaces(newMap, gridWidth, gridHeight);
      if (fireplaces.length > 0 && Math.random() < WORKER_SPAWN_CHANCE) {
        // Pick a random fireplace
        const fireplace = fireplaces[Math.floor(Math.random() * fireplaces.length)];
        const spawnPos = findSpawnNearFireplace(newMap, fireplace, newAgents, gridWidth, gridHeight);
        if (spawnPos) {
          const newWorker: Agent = {
            id: `agent-${++workerIdCounter}`,
            x: spawnPos.x,
            y: spawnPos.y,
            state: 'idle',
            targetX: null,
            targetY: null,
            currentTask: null,
          };
          newAgents.push(newWorker);
          announce('A new visitor has arrived!');
        }
      }
    }

    // Update each agent
    newAgents = newAgents.map(agent => {
      const updatedAgent = { ...agent };

      // If agent has no target, pick up next task from queue
      if (updatedAgent.targetX === null || updatedAgent.targetY === null) {
        if (newTaskQueue.length > 0) {
          const nextTask = newTaskQueue[0];

          // Validate task is still valid
          let taskValid = false;
          if (nextTask.type === 'chop') {
            taskValid = newMap[nextTask.y]?.[nextTask.x]?.type === 'tree';
          } else if (nextTask.type === 'build') {
            // Build task valid if tile is grass and we can afford it
            const cost = BUILD_COSTS[nextTask.buildType || ''] || 0;
            taskValid = newMap[nextTask.y]?.[nextTask.x]?.type === 'grass' && newWood >= cost;
          }

          if (taskValid) {
            updatedAgent.targetX = nextTask.x;
            updatedAgent.targetY = nextTask.y;
            updatedAgent.state = 'moving';
            updatedAgent.currentTask = nextTask;
            newTaskQueue = newTaskQueue.slice(1);
          } else {
            // Check if task is just unaffordable (move to back) vs truly invalid (remove)
            const tileStillValid = nextTask.type === 'build'
              ? newMap[nextTask.y]?.[nextTask.x]?.type === 'grass'
              : newMap[nextTask.y]?.[nextTask.x]?.type === 'tree';

            if (tileStillValid && nextTask.type === 'build') {
              // Can't afford yet - move to back of queue
              newTaskQueue = [...newTaskQueue.slice(1), nextTask];
            } else {
              // Task is truly invalid (tile changed) - remove it
              newTaskQueue = newTaskQueue.slice(1);
            }
          }
        } else {
          updatedAgent.state = 'idle';
        }
        return updatedAgent;
      }

      // Move or work
      const atTarget =
        updatedAgent.x === updatedAgent.targetX &&
        updatedAgent.y === updatedAgent.targetY;

      if (atTarget) {
        const targetTile = newMap[updatedAgent.targetY][updatedAgent.targetX];
        const currentTask = updatedAgent.currentTask;

        if (targetTile.type === 'tree') {
          // Chopping
          updatedAgent.state = 'chopping';
          newMap[updatedAgent.targetY][updatedAgent.targetX].type = 'grass';
          newWood += 1;
        } else if (currentTask?.type === 'build' && currentTask.buildType && targetTile.type === 'grass') {
          // Building
          const cost = BUILD_COSTS[currentTask.buildType] || 0;
          if (newWood >= cost) {
            updatedAgent.state = 'building';
            newMap[updatedAgent.targetY][updatedAgent.targetX].type = currentTask.buildType;
            newWood -= cost;
            announce(`Built ${currentTask.buildType}`);
          }
        }

        updatedAgent.targetX = null;
        updatedAgent.targetY = null;
        updatedAgent.currentTask = null;
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
      announcements: newAnnouncements,
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
        multiSelection: [],
        contextMenuPos: { x: screenX, y: screenY },
      });
    }
  },

  setMultiSelection: (tiles: Tile[], screenX: number, screenY: number) => {
    set({
      selection: null,
      multiSelection: tiles,
      contextMenuPos: tiles.length > 0 ? { x: screenX, y: screenY } : null,
    });
  },

  clearSelection: () => {
    set({ selection: null, multiSelection: [], contextMenuPos: null });
  },

  chopSelectedTree: () => {
    const { selection } = get();
    if (selection && selection.tile.type === 'tree') {
      get().queueChopTask(selection.x, selection.y);
    }
    set({ selection: null, multiSelection: [], contextMenuPos: null });
  },

  chopSelectedTrees: () => {
    const { multiSelection } = get();
    const trees = multiSelection.filter(tile => tile.type === 'tree');
    for (const tree of trees) {
      get().queueChopTask(tree.x, tree.y);
    }
    set({ selection: null, multiSelection: [], contextMenuPos: null });
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

  isTileInMultiSelection: (x: number, y: number) => {
    const { multiSelection } = get();
    return multiSelection.some(tile => tile.x === x && tile.y === y);
  },

  setIgnoreTileClicks: (ignore: boolean) => {
    set({ ignoreTileClicks: ignore });
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
    const { map, selectedBuildType, taskQueue, wood } = get();

    if (!selectedBuildType) return;

    // Can only build on grass
    if (map[y]?.[x]?.type !== 'grass') return;

    // Check if already queued for build at this location
    const alreadyQueued = taskQueue.some(task => task.x === x && task.y === y);
    if (alreadyQueued) return;

    // Check if we have enough wood
    const cost = BUILD_COSTS[selectedBuildType] || 0;
    if (wood < cost) return; // Not enough wood

    // Queue the build task
    const newTask: Task = {
      id: `task-${++taskIdCounter}`,
      type: 'build',
      x,
      y,
      buildType: selectedBuildType,
    };

    set({ taskQueue: [...taskQueue, newTask] });
  },

  isBuildQueued: (x: number, y: number) => {
    const { taskQueue } = get();
    // Check if there's a build task in queue for this location
    const inQueue = taskQueue.find(task => task.type === 'build' && task.x === x && task.y === y);
    if (inQueue) return inQueue;
    return undefined;
  },

  getBuildCost: (type: TileType) => {
    return BUILD_COSTS[type] || 0;
  },

  addAnnouncement: (message: string) => {
    const { announcements } = get();
    const newAnnouncement: Announcement = {
      id: ++announcementIdCounter,
      message,
      timestamp: Date.now(),
    };
    let newAnnouncements = [...announcements, newAnnouncement];
    if (newAnnouncements.length > 5) {
      newAnnouncements = newAnnouncements.slice(-5);
    }
    set({ announcements: newAnnouncements });
  },

  clearOldAnnouncements: () => {
    const { announcements } = get();
    const now = Date.now();
    const filtered = announcements.filter(a => now - a.timestamp < 5000);
    if (filtered.length !== announcements.length) {
      set({ announcements: filtered });
    }
  },
}));
