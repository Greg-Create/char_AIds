import { useEffect, useState } from 'react';
import { gameApi, type GameSignal, type Session } from '../api';

/**
 * One-way WebRTC video for a turn: the acting player (offerer) sends its
 * camera, the watching player receives it. Signals go through the local API.
 * Both Macs are on the same network, so host candidates are enough; STUN is a
 * harmless extra.
 */
export function usePeerVideo(session: Session | null, localStream: MediaStream | null, active: boolean, offerer: boolean) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');

  useEffect(() => {
    if (!session || !active || typeof RTCPeerConnection === 'undefined') return;
    if (offerer && !localStream) return;
    let lastSignalId = 0;
    const queuedCandidates: RTCIceCandidateInit[] = [];
    const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

    if (offerer && localStream) localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
    else peer.addTransceiver('video', { direction: 'recvonly' });

    peer.ontrack = (event) => setRemoteStream(event.streams[0] ?? new MediaStream([event.track]));
    peer.onconnectionstatechange = () => setConnectionState(peer.connectionState);
    peer.onicecandidate = (event) => {
      if (event.candidate) void gameApi.sendSignal(session, { kind: 'ice', data: event.candidate.toJSON() }).catch(() => undefined);
    };

    const flushCandidates = async () => {
      while (queuedCandidates.length) await peer.addIceCandidate(queuedCandidates.shift()!);
    };

    const handleSignal = async (signal: GameSignal) => {
      if (signal.kind === 'offer' && !offerer) {
        await peer.setRemoteDescription(signal.data as RTCSessionDescriptionInit);
        await flushCandidates();
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await gameApi.sendSignal(session, { kind: 'answer', data: answer });
      } else if (signal.kind === 'answer' && offerer) {
        if (!peer.currentRemoteDescription) {
          await peer.setRemoteDescription(signal.data as RTCSessionDescriptionInit);
          await flushCandidates();
        }
      } else if (signal.kind === 'ice') {
        const candidate = signal.data as RTCIceCandidateInit;
        if (peer.currentRemoteDescription) await peer.addIceCandidate(candidate).catch(() => undefined);
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
        // Retried on the next poll.
      }
    };

    const connect = async () => {
      if (offerer) {
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
      setConnectionState('new');
    };
  }, [active, localStream, offerer, session]);

  return { remoteStream, connectionState };
}
