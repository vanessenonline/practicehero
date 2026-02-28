/**
 * Audio analyser module – sets up Web Audio API and extracts frequency data.
 * Uses AnalyserNode with configurable FFT size for band energy extraction.
 */

import type { BandEnergies } from "@/types";

/** FFT size for frequency analysis (higher = more resolution, more latency) */
const FFT_SIZE = 2048;

/** Frequency ranges for band energy calculation (Hz) */
const BANDS = {
  low: { min: 20, max: 300 },
  mid: { min: 300, max: 2000 },
  high: { min: 2000, max: 8000 },
} as const;

export interface AudioAnalyzerHandle {
  /** Get the current frequency data as Uint8Array */
  getFrequencyData: () => Uint8Array;
  /** Calculate band energies from current frequency data */
  getBandEnergies: () => BandEnergies;
  /** Get the average volume level (0-255) */
  getAverageVolume: () => number;
  /** Get the sample rate of the audio context */
  sampleRate: number;
  /** Clean up all resources */
  destroy: () => void;
}

/**
 * Create an audio analyser from a microphone stream.
 * Returns a handle with methods to extract frequency and volume data.
 */
export function createAudioAnalyzer(stream: MediaStream): AudioAnalyzerHandle {
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();

  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0.8;
  source.connect(analyser);

  const frequencyBuffer = new Uint8Array(analyser.frequencyBinCount);
  const sampleRate = ctx.sampleRate;

  /**
   * Convert a frequency (Hz) to the corresponding FFT bin index.
   */
  function freqToBin(freq: number): number {
    const binWidth = sampleRate / FFT_SIZE;
    return Math.round(freq / binWidth);
  }

  /**
   * Calculate average energy for a frequency range from the buffer.
   */
  function bandEnergy(minHz: number, maxHz: number): number {
    const minBin = Math.max(0, freqToBin(minHz));
    const maxBin = Math.min(frequencyBuffer.length - 1, freqToBin(maxHz));

    if (maxBin <= minBin) return 0;

    let sum = 0;
    for (let i = minBin; i <= maxBin; i++) {
      sum += frequencyBuffer[i];
    }
    return sum / (maxBin - minBin + 1);
  }

  return {
    getFrequencyData() {
      analyser.getByteFrequencyData(frequencyBuffer);
      return frequencyBuffer;
    },

    getBandEnergies() {
      analyser.getByteFrequencyData(frequencyBuffer);

      const low = bandEnergy(BANDS.low.min, BANDS.low.max);
      const mid = bandEnergy(BANDS.mid.min, BANDS.mid.max);
      const high = bandEnergy(BANDS.high.min, BANDS.high.max);
      const total = low + mid + high;

      return { low, mid, high, total };
    },

    getAverageVolume() {
      analyser.getByteFrequencyData(frequencyBuffer);
      let sum = 0;
      for (let i = 0; i < frequencyBuffer.length; i++) {
        sum += frequencyBuffer[i];
      }
      return sum / frequencyBuffer.length;
    },

    sampleRate,

    destroy() {
      source.disconnect();
      analyser.disconnect();
      ctx.close();
      stream.getTracks().forEach((track) => track.stop());
    },
  };
}
