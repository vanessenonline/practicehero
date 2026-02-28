/**
 * Audio detection module – public API.
 * Combines the analyzer and classifier into a simple hook-friendly interface.
 */

export { createAudioAnalyzer } from "./analyzer";
export type { AudioAnalyzerHandle } from "./analyzer";

export {
  classifyFrame,
  createClassifierState,
} from "./classifier";
export type { ClassifierState, DetectionProfile } from "./classifier";
