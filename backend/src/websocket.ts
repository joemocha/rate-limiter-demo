import type { ServerWebSocket } from 'bun';
import type { RateLimiter } from './types/rate-limiter.interface';
import { LimiterFactory, type AlgorithmType } from './limiter-factory';

interface RaceSession {
  foxLimiter: RateLimiter;
  hedgehogLimiter: RateLimiter;
  foxAlgorithm: AlgorithmType;
  hedgehogAlgorithm: AlgorithmType;
  rps: number;
  duration: number;
  pattern: 'burst' | 'sustained' | 'chaos';
  startTime: number;
  intervalId: Timer | null;
  foxAccepted: number;
  foxRejected: number;
  hedgehogAccepted: number;
  hedgehogRejected: number;
}

interface RaceFrame {
  timestamp: number;
  foxState: {
    tokens?: number;
    capacity?: number;
    accepted: number;
    rejected: number;
  };
  hedgehogState: {
    queueSize?: number;
    maxQueue?: number;
    accepted: number;
    rejected: number;
  };
  event?: 'burst' | 'spike' | 'recovery';
}

const sessions = new Map<ServerWebSocket, RaceSession>();

export function getActiveSessionCount(): number {
  return sessions.size;
}

export function handleWebSocket(ws: ServerWebSocket): void {
  ws.send(JSON.stringify({ type: 'connected' }));
}

export function handleWebSocketMessage(ws: ServerWebSocket, message: string): void {
  try {
    const data = JSON.parse(message);

    if (data.type === 'start-race') {
      startRace(ws, data);
    } else if (data.type === 'stop-race') {
      stopRace(ws);
    }
  } catch (error) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
  }
}

export function handleWebSocketClose(ws: ServerWebSocket): void {
  stopRace(ws);
}

function startRace(ws: ServerWebSocket, config: {
  rps: number;
  duration: number;
  pattern: string;
  foxAlgorithm?: string;
  hedgehogAlgorithm?: string;
}): void {
  const { rps, duration, pattern, foxAlgorithm = 'token-bucket', hedgehogAlgorithm = 'leaky-bucket' } = config;

  // Validation with detailed error messages
  if (typeof rps !== 'number' || isNaN(rps)) {
    ws.send(JSON.stringify({ type: 'error', message: 'RPS must be a valid number' }));
    return;
  }

  if (rps <= 0) {
    ws.send(JSON.stringify({ type: 'error', message: 'RPS must be greater than 0' }));
    return;
  }

  if (rps > 1000) {
    ws.send(JSON.stringify({ type: 'error', message: 'RPS cannot exceed 1000' }));
    return;
  }

  if (typeof duration !== 'number' || isNaN(duration)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Duration must be a valid number' }));
    return;
  }

  if (duration < 5 || duration > 60) {
    ws.send(JSON.stringify({ type: 'error', message: 'Duration must be between 5 and 60 seconds' }));
    return;
  }

  if (!['burst', 'sustained', 'chaos'].includes(pattern)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid pattern (must be: burst, sustained, or chaos)' }));
    return;
  }

  if (!LimiterFactory.isSupported(foxAlgorithm)) {
    ws.send(JSON.stringify({ type: 'error', message: `Invalid Fox algorithm: ${foxAlgorithm}` }));
    return;
  }

  if (!LimiterFactory.isSupported(hedgehogAlgorithm)) {
    ws.send(JSON.stringify({ type: 'error', message: `Invalid Hedgehog algorithm: ${hedgehogAlgorithm}` }));
    return;
  }

  // Stop any existing race
  stopRace(ws);

  // Create new session with user-selected algorithms
  const session: RaceSession = {
    foxLimiter: LimiterFactory.create(foxAlgorithm as AlgorithmType, rps),
    hedgehogLimiter: LimiterFactory.create(hedgehogAlgorithm as AlgorithmType, rps),
    foxAlgorithm: foxAlgorithm as AlgorithmType,
    hedgehogAlgorithm: hedgehogAlgorithm as AlgorithmType,
    rps,
    duration,
    pattern: pattern as 'burst' | 'sustained' | 'chaos',
    startTime: Date.now(),
    intervalId: null,
    foxAccepted: 0,
    foxRejected: 0,
    hedgehogAccepted: 0,
    hedgehogRejected: 0,
  };

  sessions.set(ws, session);

  // Send initial state
  ws.send(JSON.stringify({
    type: 'race-started',
    sessionId: generateSessionId(),
    rps,
    duration,
    pattern,
  }));

  // Start 30fps update loop (33.33ms per frame)
  session.intervalId = setInterval(() => {
    updateRaceFrame(ws, session);
  }, 33.33);

  // Auto-stop after duration
  setTimeout(() => {
    stopRace(ws);
  }, duration * 1000);
}

function updateRaceFrame(ws: ServerWebSocket, session: RaceSession): void {
  const elapsed = Date.now() - session.startTime;

  // Generate requests based on pattern
  const requestsThisFrame = generateRequests(session.pattern, session.rps);

  // Process requests through both algorithms
  for (let i = 0; i < requestsThisFrame; i++) {
    // Fox (Token Bucket)
    if (session.foxLimiter.allow()) {
      session.foxAccepted++;
    } else {
      session.foxRejected++;
    }

    // Hedgehog (Leaky Bucket)
    if (session.hedgehogLimiter.allow()) {
      session.hedgehogAccepted++;
    } else {
      session.hedgehogRejected++;
    }
  }

  // Get current state
  const foxStats = session.foxLimiter.getStats();
  const hedgehogStats = session.hedgehogLimiter.getStats();

  // Calculate internal state for visualization - EQUAL CAPACITY for fair comparison
  const sharedCapacity = Math.floor(session.rps * 2.0);

  // Fox visualization (works for both Token Bucket and Leaky Bucket)
  const foxCapacity = sharedCapacity;
  const foxValue = session.foxAlgorithm === 'token-bucket'
    ? foxStats.remaining  // Token Bucket: show remaining tokens
    : (sharedCapacity - foxStats.remaining); // Leaky Bucket: show queue size

  // Hedgehog visualization (works for both Token Bucket and Leaky Bucket)
  const hedgehogCapacity = sharedCapacity;
  const hedgehogValue = session.hedgehogAlgorithm === 'token-bucket'
    ? hedgehogStats.remaining  // Token Bucket: show remaining tokens
    : (sharedCapacity - hedgehogStats.remaining); // Leaky Bucket: show queue size

  const frame: RaceFrame = {
    timestamp: Date.now(),
    foxState: {
      tokens: foxValue,
      capacity: foxCapacity,
      accepted: session.foxAccepted,
      rejected: session.foxRejected,
    },
    hedgehogState: {
      queueSize: hedgehogValue,
      maxQueue: hedgehogCapacity,
      accepted: session.hedgehogAccepted,
      rejected: session.hedgehogRejected,
    },
  };

  // Detect events
  if (requestsThisFrame > session.rps / 10) {
    frame.event = 'burst';
  }

  ws.send(JSON.stringify({ type: 'race-frame', frame }));
}

function stopRace(ws: ServerWebSocket): void {
  const session = sessions.get(ws);
  if (!session) return;

  if (session.intervalId) {
    clearInterval(session.intervalId);
  }

  // Send final results
  const foxTotal = session.foxAccepted + session.foxRejected;
  const hedgehogTotal = session.hedgehogAccepted + session.hedgehogRejected;

  let winner: 'fox' | 'hedgehog' | 'tie';
  if (session.foxAccepted > session.hedgehogAccepted) {
    winner = 'fox';
  } else if (session.hedgehogAccepted > session.foxAccepted) {
    winner = 'hedgehog';
  } else {
    winner = 'tie';
  }

  ws.send(JSON.stringify({
    type: 'race-stopped',
    winner,
    metrics: {
      fox: { accepted: session.foxAccepted, rejected: session.foxRejected },
      hedgehog: { accepted: session.hedgehogAccepted, rejected: session.hedgehogRejected },
    },
  }));

  sessions.delete(ws);
}

function generateRequests(pattern: string, rps: number): number {
  switch (pattern) {
    case 'burst':
      // Random bursts
      return Math.random() < 0.1 ? Math.floor(rps * 2 * Math.random()) : 0;
    case 'sustained':
      // Steady rate (rps / 30fps)
      return rps / 30;
    case 'chaos':
      // Random chaos
      return Math.floor(Math.random() * rps);
    default:
      return 0;
  }
}

function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15);
}
