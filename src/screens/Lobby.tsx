import { motion } from 'framer-motion';
import type { Role } from '../App';
import type { RoomView } from '../api';
import { BigButton } from '../components/ui/BigButton';
import { HostWaiting, RoleBadge } from '../components/ui/HostWaiting';

interface LobbyProps {
  role: Role;
  room: RoomView;
  playerId: string;
  consent: boolean;
  busy: boolean;
  onConsent: (consent: boolean) => void;
  onReady: () => void;
  onStart: () => void;
  onHome: () => void;
}

export function Lobby({ role, room, playerId, consent, busy, onConsent, onReady, onStart, onHome }: LobbyProps) {
  const you = room.players.find((player) => player.id === playerId);
  const bothReady = room.players.length === 2 && room.players.every((player) => player.ready);

  return (
    <motion.div className="screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="card" style={{ maxWidth: 620, width: '100%' }}>
        <RoleBadge role={role} />
        <h2 className="display" style={{ color: 'var(--purple-deep)', marginBottom: 4 }}>Room {room.roomCode}</h2>
        <p style={{ fontWeight: 700, color: '#7c6f96' }}>{room.players.length}/2 players connected</p>

        <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 700, color: '#7c6f96' }}>
          <input type="checkbox" checked={consent} disabled={you?.ready || busy} onChange={(event) => onConsent(event.target.checked)} />
          If I lose, allow this recording to be posted on X
        </label>

        <div className="stack">
          {!you?.ready ? (
            <BigButton variant="primary" icon="📸" disabled={busy} onClick={onReady}>Camera ready</BigButton>
          ) : role === 'host' && bothReady ? (
            <BigButton variant="primary" icon="🎡" attention disabled={busy} onClick={onStart}>Start round</BigButton>
          ) : (
            <HostWaiting text={room.players.length < 2 ? 'Share the code with your opponent' : 'Waiting for both players'} />
          )}
          <button type="button" className="link-btn" style={{ color: 'var(--purple-deep)', textShadow: 'none' }} onClick={onHome}>← Leave room</button>
        </div>
      </div>
    </motion.div>
  );
}
