import type { Agent as AgentType } from '../types';
import { TILE_SIZE } from '../types';

interface AgentProps {
  agent: AgentType;
}

export function Agent({ agent }: AgentProps) {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: agent.x * TILE_SIZE,
    top: agent.y * TILE_SIZE,
    width: TILE_SIZE,
    height: TILE_SIZE,
    transition: 'left 0.3s ease, top 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 10,
  };

  const agentClass = `agent agent-${agent.state}`;

  return (
    <div className={agentClass} style={style}>
      <img src="/sprites/worker.png" alt="worker" className="agent-sprite" />
    </div>
  );
}
