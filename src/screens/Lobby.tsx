import { motion } from 'framer-motion';
import type { Role } from '../App';
import type { RoomView } from '../api';
import { BigButton } from '../components/ui/BigButton';
import { HostWaiting, RoleBadge } from '../components/ui/HostWaiting';

interface LobbyProps {
  role: Role;
  room: RoomView;
  playerId: string;
  lanUrls: string[];
  consent: boolean;
  busy: boolean;
  onConsent: (consent: boolean) => void;
  onReady: () => void;
  onStart: () => void;
  onHome: () => void;
}

export function Lobby({ role, room, playerId, lanUrls, consent, busy, onConsent, onReady, onStart, onHome }: LobbyProps) {
  const you = room.players.find((player) => player.id === playerId);
  const opponentHere = room.players.length === 2;
  const bothReady = opponentHere && room.players.every((player) => player.ready);
  const shareUrl = lanUrls[0];

  return (
    <motion.div className="screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="card lobby" style={{ maxWidth: 640, width: '100%' }}>
        <RoleBadge role={role} />
        <h2 className="display" style={{ color: 'var(--purple-deep)', margin: '10px 0 4px', fontSize: 'clamp(30px, 6vw, 44px)' }}>
          {opponentHere ? 'Player 2 is here!' : 'Waiting for player 2'}
        </h2>

        {!opponentHere && (
          <p style={{ fontWeight: 700, color: '#7c6f96', margin: '4px 0 0' }}>
            On the other Mac, open {shareUrl ? <strong className="lobby__url">{shareUrl}</strong> : 'this page'} and press PLAY.
            {shareUrl && <span className="lobby__note"> Accept the self-signed certificate warning once; the camera needs HTTPS.</span>}
          </p>
        )}

        <div className="lobby__players">
          {[0, 1].map((index) => {
            const player = room.players[index];
            const isYou = player?.id === playerId;
            return (
              <div key={index} className={`lobby__player ${player ? 'lobby__player--here' : ''}`}>
                <span style={{ fontSize: 30 }}>{player ? (player.ready ? '📸' : '🙂') : '⏳'}</span>
                <strong>Player {index + 1}{isYou ? ' (you)' : ''}</strong>
                <span className="lobby__status">{!player ? 'not here yet' : player.ready ? 'camera ready' : 'checking camera'}</span>
              </div>
            );
          })}
        </div>

        <label className="lobby__consent">
          <input type="checkbox" checked={consent} disabled={you?.ready || busy} onChange={(event) => onConsent(event.target.checked)} />
          If I lose, allow my clip to be posted on X
        </label>

        <div className="stack">
          {!you?.ready ? (
            <BigButton variant="primary" icon="📸" disabled={busy} onClick={onReady}>Camera ready</BigButton>
          ) : role === 'host' && bothReady ? (
            <BigButton variant="primary" icon="🎡" attention disabled={busy} onClick={onStart}>Start</BigButton>
          ) : (
            <HostWaiting text={!opponentHere ? 'Waiting for player 2' : !bothReady ? 'Waiting for the other camera' : 'Waiting for player 1 to start'} />
          )}
          <button type="button" className="link-btn" style={{ color: 'var(--purple-deep)', textShadow: 'none' }} onClick={onHome}>← Leave</button>
        </div>
      </div>
    </motion.div>
  );
}
