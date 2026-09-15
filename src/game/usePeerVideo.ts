import { useEffect, useState } from 'react';
import { gameApi, type GameSignal, type Session } from '../api';

function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: import.meta.env.VITE_TURN_USERNAME as string | undefined,
      credential: import.meta.env.VITE_TURN_CREDENTIAL as string | undefined,
    });
  }
  return servers;
}

export function usePeerVideo(session: Session | null, localStream: MediaStream | null, active: boolean) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');

  useEffect(() => {
    if (!session || !localStream || !active || typeof RTCPeerConnection === 'undefined') return;
    let lastSignalId = 0;
    const queuedCandidates: RTCIceCandidateInit[] = [];
    const peer = new RTCPeerConnection({ iceServers: iceServers() });

    localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
    peer.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      setRemoteStream(stream);
    };
    peer.onconnectionstatechange = () => setConnectionState(peer.connectionState);
    peer.onicecandidate = (event) => {
      if (event.candidate) void gameApi.sendSignal(session, { kind: 'ice', data: event.candidate.toJSON() }).catch(() => undefined);
    };

    const flushCandidates = async () => {
      while (queuedCandidates.length) await peer.addIceCandidate(queuedCandidates.shift()!);
    };

    const handleSignal = async (signal: GameSignal) => {
      if (signal.kind === 'offer' && session.role === 'guest') {
        await peer.setRemoteDescription(signal.data as RTCSessionDescriptionInit);
        await flushCandidates();
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await gameApi.sendSignal(session, { kind: 'answer', data: answer });
      } else if (signal.kind === 'answer' && session.role === 'host') {
        if (!peer.currentRemoteDescription) {
          await peer.setRemoteDescription(signal.data as RTCSessionDescriptionInit);
          await flushCandidates();
        }
      } else if (signal.kind === 'ice') {
        const candidate = signal.data as RTCIceCandidateInit;
        if (peer.currentRemoteDescription) await peer.addIceCandidate(candidate);
        else queuedCandidates.push(candidate);
      }
    };

    const poll = async () => {
      try {
        const { signals } = await gameApi.getSignals(session, lastSignalId);
        for (const signal of signals) {
          lastSignalId = Math.max(lastSignalId, signal.id);
          await handleSignal(signal);
        }
      } catch {
        // A later poll retries while the round is active.
      }
    };

    const connect = async () => {
      if (session.role === 'host') {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await gameApi.sendSignal(session, { kind: 'offer', data: offer });
      }
      await poll();
    };
    void connect().catch(() => undefined);
    const interval = window.setInterval(() => void poll(), 350);

    return () => {
      window.clearInterval(interval);
      peer.ontrack = null;
      peer.onicecandidate = null;
      peer.onconnectionstatechange = null;
      peer.close();
      setRemoteStream(null);
    };
  }, [active, localStream, session]);

  return { remoteStream, connectionState };
}
