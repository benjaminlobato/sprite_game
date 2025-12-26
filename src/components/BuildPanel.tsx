import { useGameStore } from '../store/gameStore';
import type { TileType } from '../types';

const BUILD_OPTIONS: { type: TileType; label: string; icon: string }[] = [
  { type: 'wall', label: 'Wall', icon: '/sprites/wall.png' },
  { type: 'door', label: 'Door', icon: '/sprites/door.png' },
  { type: 'bed', label: 'Bed', icon: '/sprites/bed.png' },
  { type: 'fireplace', label: 'Fire', icon: '/sprites/fireplace.png' },
];

export function BuildPanel() {
  const buildMode = useGameStore(state => state.buildMode);
  const selectedBuildType = useGameStore(state => state.selectedBuildType);
  const selectBuildType = useGameStore(state => state.selectBuildType);
  const toggleBuildMode = useGameStore(state => state.toggleBuildMode);

  if (!buildMode) return null;

  return (
    <div className="build-panel">
      <div className="build-panel-header">
        <span>Build Mode</span>
        <button className="build-close" onClick={toggleBuildMode}>✕</button>
      </div>
      <div className="build-options">
        {BUILD_OPTIONS.map(option => (
          <button
            key={option.type}
            className={`build-option ${selectedBuildType === option.type ? 'selected' : ''}`}
            onClick={() => selectBuildType(option.type)}
          >
            <img src={option.icon} alt={option.label} className="build-option-icon" />
            <span className="build-option-label">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
