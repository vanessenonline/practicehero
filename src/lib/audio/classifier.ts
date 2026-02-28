/**
 * Instrument classifier module – uses frequency band energy ratios
 * and the instrument's detection profile to classify audio.
 *
 * Classification heuristics:
 * - Piano: strong mid+high harmonics, sharp attack with sustain decay
 * - Drums: dominant low frequencies, broad spectrum transients
 * - Guitar: mid-range fundamental, harmonic overtone series
 *
 * Uses a rolling window of recent samples for stability.
 */

import type { BandEnergies, AudioClassification } from "@/types";

/** Detection profile from the instruments table */
export type DetectionProfile = "pitched" | "percussive";

/** Minimum total energy to consider as non-silence */
const SILENCE_THRESHOLD = 15;

/** Minimum total energy to classify an instrument */
const ACTIVE_THRESHOLD = 25;

/** Rolling window size for classification stability */
const WINDOW_SIZE = 5;

/**
 * Instrument classification profiles with expected band energy ratios.
 * Each value represents the expected proportion of energy in that band
 * relative to total energy (normalized 0-1).
 */
const INSTRUMENT_PROFILES = {
  piano: {
    /** Piano has energy spread across mid and high, less in low */
    lowRatio: { min: 0.15, max: 0.40 },
    midRatio: { min: 0.30, max: 0.55 },
    highRatio: { min: 0.15, max: 0.45 },
    detectionProfile: "pitched" as DetectionProfile,
  },
  drums: {
    /** Drums have dominant low frequencies with some high from cymbals */
    lowRatio: { min: 0.35, max: 0.70 },
    midRatio: { min: 0.15, max: 0.40 },
    highRatio: { min: 0.05, max: 0.35 },
    detectionProfile: "percussive" as DetectionProfile,
  },
  guitar: {
    /** Guitar has mid-range fundamental with harmonic overtones */
    lowRatio: { min: 0.20, max: 0.45 },
    midRatio: { min: 0.35, max: 0.60 },
    highRatio: { min: 0.10, max: 0.35 },
    detectionProfile: "pitched" as DetectionProfile,
  },
} as const;

type InstrumentName = keyof typeof INSTRUMENT_PROFILES;

/**
 * Calculate how well band energies match an instrument profile.
 * Returns a score from 0 (no match) to 1 (perfect match).
 */
function matchScore(
  energies: BandEnergies,
  instrumentName: InstrumentName
): number {
  const profile = INSTRUMENT_PROFILES[instrumentName];
  const total = energies.total || 1; // Prevent division by zero

  const lowRatio = energies.low / total;
  const midRatio = energies.mid / total;
  const highRatio = energies.high / total;

  // Score each band: 1 if within range, decreasing penalty outside
  function bandScore(ratio: number, range: { min: number; max: number }): number {
    if (ratio >= range.min && ratio <= range.max) return 1.0;
    const distance = ratio < range.min
      ? range.min - ratio
      : ratio - range.max;
    return Math.max(0, 1 - distance * 3);
  }

  const lowScore = bandScore(lowRatio, profile.lowRatio);
  const midScore = bandScore(midRatio, profile.midRatio);
  const highScore = bandScore(highRatio, profile.highRatio);

  // Weighted average: mid band is most discriminative
  return lowScore * 0.3 + midScore * 0.4 + highScore * 0.3;
}

export interface ClassifierState {
  /** Rolling window of recent band energies */
  window: BandEnergies[];
  /** Count of each instrument classification in the window */
  counts: Record<string, number>;
}

/**
 * Create a new classifier state.
 */
export function createClassifierState(): ClassifierState {
  return {
    window: [],
    counts: {},
  };
}

/**
 * Classify a single audio frame given band energies.
 * Updates the rolling window and returns the most stable classification.
 *
 * @param state - mutable classifier state (rolling window)
 * @param energies - current frame's band energies
 * @param expectedInstrument - the instrument the child selected (for boosted matching)
 * @param detectionProfile - 'pitched' or 'percussive' from instruments table
 */
export function classifyFrame(
  state: ClassifierState,
  energies: BandEnergies,
  expectedInstrument?: string,
  detectionProfile?: DetectionProfile
): AudioClassification {
  // Check for silence
  if (energies.total < SILENCE_THRESHOLD) {
    return { instrument: "silence", confidence: 0, isActive: false };
  }

  // Check if active enough for classification
  if (energies.total < ACTIVE_THRESHOLD) {
    return { instrument: "unknown", confidence: 0.2, isActive: true };
  }

  // Score each instrument
  const scores: Record<InstrumentName, number> = {
    piano: matchScore(energies, "piano"),
    drums: matchScore(energies, "drums"),
    guitar: matchScore(energies, "guitar"),
  };

  // Boost the expected instrument score slightly (context-aware)
  if (expectedInstrument && expectedInstrument in scores) {
    scores[expectedInstrument as InstrumentName] *= 1.15;
  }

  // Also boost instruments matching the detection profile
  if (detectionProfile) {
    for (const [name, profile] of Object.entries(INSTRUMENT_PROFILES)) {
      if (profile.detectionProfile === detectionProfile) {
        scores[name as InstrumentName] *= 1.1;
      }
    }
  }

  // Find best match
  let bestInstrument: InstrumentName = "piano";
  let bestScore = 0;
  for (const [name, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestInstrument = name as InstrumentName;
    }
  }

  // Add to rolling window
  state.window.push(energies);
  if (state.window.length > WINDOW_SIZE) {
    state.window.shift();
  }

  // Track classifications in the window for stability
  const key = bestInstrument;
  state.counts[key] = (state.counts[key] ?? 0) + 1;

  // Prune old counts (approximate: decrement when window is full)
  if (state.window.length >= WINDOW_SIZE) {
    for (const k of Object.keys(state.counts)) {
      if (k !== key && state.counts[k] > 0) {
        state.counts[k] = Math.max(0, state.counts[k] - 0.5);
      }
    }
  }

  // Find the most frequent classification in recent history
  let stableInstrument = bestInstrument;
  let maxCount = 0;
  for (const [name, count] of Object.entries(state.counts)) {
    if (count > maxCount) {
      maxCount = count;
      stableInstrument = name as InstrumentName;
    }
  }

  // Confidence: combination of match score and classification stability
  const stability = state.window.length >= WINDOW_SIZE
    ? maxCount / WINDOW_SIZE
    : 0.5;
  const confidence = Math.min(1, bestScore * 0.6 + stability * 0.4);

  return {
    instrument: stableInstrument as AudioClassification["instrument"],
    confidence,
    isActive: true,
  };
}
