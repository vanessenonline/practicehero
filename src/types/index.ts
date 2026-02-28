export * from "./database";

export interface AudioClassification {
  instrument: "piano" | "drums" | "guitar" | "unknown" | "silence";
  confidence: number;
  isActive: boolean;
}

export interface BandEnergies {
  low: number;
  mid: number;
  high: number;
  total: number;
}

export interface TimerState {
  elapsed: number;
  remaining: number;
  isRunning: boolean;
  isPaused: boolean;
  isComplete: boolean;
  isBonus: boolean;
}

export interface SessionResult {
  durationSeconds: number;
  bonusMinutes: number;
  pointsEarned: number;
  streakUpdated: boolean;
  newStreak: number;
  achievementsUnlocked: string[];
}
