import { useEffect, useCallback } from 'react';
import { useGameStore } from './store/gameStore';
import { Header } from './components/Header';
import { GameGrid } from './components/GameGrid';
import { TILE_SIZE, TICK_INTERVAL } from './types';
import './App.css';

const HEADER_HEIGHT = 60; // approximate header height in px

function App() {
  const initializeGame = useGameStore(state => state.initializeGame);
  const tick = useGameStore(state => state.tick);
  const isRunning = useGameStore(state => state.isRunning);

  // Calculate grid dimensions from window size
  const calculateGridSize = useCallback(() => {
    const availableWidth = window.innerWidth;
    const availableHeight = window.innerHeight - HEADER_HEIGHT;

    const gridWidth = Math.floor(availableWidth / TILE_SIZE);
    const gridHeight = Math.floor(availableHeight / TILE_SIZE);

    return { gridWidth, gridHeight };
  }, []);

  // Initialize the game on mount
  useEffect(() => {
    const { gridWidth, gridHeight } = calculateGridSize();
    initializeGame(gridWidth, gridHeight);

    // Handle window resize
    const handleResize = () => {
      const { gridWidth, gridHeight } = calculateGridSize();
      initializeGame(gridWidth, gridHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initializeGame, calculateGridSize]);

  // Set up the tick loop with setInterval
  useEffect(() => {
    if (!isRunning) return;

    const intervalId = setInterval(() => {
      tick();
    }, TICK_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isRunning, tick]);

  return (
    <div className="app">
      <Header />
      <main className="main">
        <GameGrid />
      </main>
    </div>
  );
}

export default App;
