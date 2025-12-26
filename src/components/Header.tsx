import { useGameStore } from '../store/gameStore';
import { TILE_SIZE } from '../types';

const HEADER_HEIGHT = 60;

export function Header() {
  const wood = useGameStore(state => state.wood);
  const tickCount = useGameStore(state => state.tickCount);
  const isRunning = useGameStore(state => state.isRunning);
  const toggleSimulation = useGameStore(state => state.toggleSimulation);
  const initializeGame = useGameStore(state => state.initializeGame);
  const taskQueue = useGameStore(state => state.taskQueue);
  const buildMode = useGameStore(state => state.buildMode);
  const toggleBuildMode = useGameStore(state => state.toggleBuildMode);

  const handleReset = () => {
    const gridWidth = Math.floor(window.innerWidth / TILE_SIZE);
    const gridHeight = Math.floor((window.innerHeight - HEADER_HEIGHT) / TILE_SIZE);
    initializeGame(gridWidth, gridHeight);
  };

  return (
    <header className="header">
      <div className="header-left">
        <h1>Colony Sim</h1>
      </div>
      <div className="header-center">
        <div className="resource">
          <span className="resource-icon">🪵</span>
          <span className="resource-value">{wood}</span>
        </div>
        <div className="resource resource-queue">
          <span className="resource-icon">📋</span>
          <span className="resource-value">{taskQueue.length}</span>
        </div>
        <div className="tick-counter">
          Tick: {tickCount}
        </div>
      </div>
      <div className="header-right">
        <button onClick={toggleBuildMode} className={`btn ${buildMode ? 'btn-active' : 'btn-secondary'}`}>
          Build
        </button>
        <button onClick={toggleSimulation} className="btn">
          {isRunning ? 'Pause' : 'Play'}
        </button>
        <button onClick={handleReset} className="btn btn-secondary">
          Reset
        </button>
      </div>
    </header>
  );
}
