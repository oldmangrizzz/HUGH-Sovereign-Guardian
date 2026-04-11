/**
 * harnessDb.ts — Meta-Harness Database Types & Extensions
 *
 * Defines the types for execution traces, harness candidates,
 * and Pareto metrics used by the Meta-Harness optimization loop.
 */
import { Id } from "./_generated/dataModel";

export type FeatureType = "log" | "tool" | "code" | "sensor";

export interface EnvironmentFeature {
  id: string;
  type: FeatureType;
  metadata?: string;
  weight?: number;
  reason?: string;
}

export interface ExecutionResult {
  success: boolean;
  logs: LogEntry[];
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export interface LogEntry {
  type: string;
  content?: string;
  message?: string;
  durationMs?: number;
  toolName?: string;
  path?: string;
  sensorId?: string;
}

export interface ParetoMetrics {
  speed: number;    // 0-1 (higher is better)
  accuracy: number; // 0-1 (higher is better)
  resources: number; // 0-1 (higher is better)
}

export interface ParetoWeights {
  speed: number;
  accuracy: number;
  resources: number;
}

export const DEFAULT_PARETO_WEIGHTS: ParetoWeights = {
  speed: 0.3,
  accuracy: 0.5,
  resources: 0.2,
};

/**
 * Normalizes metrics based on historical distributions.
 */
export function normalizeMetric(value: number, min: number, max: number): number {
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}
