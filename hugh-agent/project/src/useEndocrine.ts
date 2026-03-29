/**
 * useEndocrine.ts — Reactive endocrine state hook
 *
 * Returns the live endocrine state for H.U.G.H. and derived
 * polymorphic UI tokens that the entire app shell uses to morph.
 */
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useMemo } from "react";

const NODE_ID = "hugh-primary";

export type EndocrineTokens = {
  // Raw values
  cortisol: number;
  dopamine: number;
  adrenaline: number;
  holographic: boolean;

  // Derived UI tokens
  accentColor: string;        // primary glow color
  accentRgb: string;          // for rgba()
  bgTint: string;             // subtle background tint
  borderColor: string;        // panel borders
  glowIntensity: number;      // 0–1, drives box-shadow spread
  pulseSpeed: string;         // CSS animation duration
  scanlineColor: string;      // scanline gradient color
  gridOpacity: number;        // workshop grid opacity
  fontWeight: number;         // 400–700
  layoutDensity: "tight" | "normal" | "expansive";
  cognitiveMode: string;      // human-readable label
  modeColor: string;          // mode indicator color
  noiseOpacity: number;       // film grain intensity
  breatheSpeed: string;       // avatar breathe animation
  messageGlow: string;        // message bubble glow
};

export function useEndocrine(): EndocrineTokens {
  const state = useQuery(api.endocrine.getState, { nodeId: NODE_ID });

  return useMemo(() => {
    const cortisol   = state?.cortisol   ?? 0.2;
    const dopamine   = state?.dopamine   ?? 0.2;
    const adrenaline = state?.adrenaline ?? 0.2;
    const holographic = state?.holographicMode ?? false;

    // Dominant hormone determines the UI character
    const dominant = cortisol > dopamine && cortisol > adrenaline ? "cortisol"
      : dopamine > adrenaline ? "dopamine"
      : "adrenaline";

    // Intensity of the dominant hormone above baseline
    const baseline = 0.2;
    const intensity = Math.max(0, Math.min(1,
      (Math.max(cortisol, dopamine, adrenaline) - baseline) / (1 - baseline)
    ));

    // Color system
    let accentColor: string;
    let accentRgb: string;
    let bgTint: string;
    let modeColor: string;

    if (holographic) {
      accentColor = "#a78bfa";
      accentRgb = "167,139,250";
      bgTint = `rgba(139,92,246,${0.02 + intensity * 0.04})`;
      modeColor = "#a78bfa";
    } else if (dominant === "cortisol" && cortisol > 0.4) {
      accentColor = "#ef4444";
      accentRgb = "239,68,68";
      bgTint = `rgba(239,68,68,${0.01 + intensity * 0.03})`;
      modeColor = "#ef4444";
    } else if (dominant === "adrenaline" && adrenaline > 0.4) {
      accentColor = "#f59e0b";
      accentRgb = "245,158,11";
      bgTint = `rgba(245,158,11,${0.01 + intensity * 0.03})`;
      modeColor = "#f59e0b";
    } else {
      accentColor = "#10b981";
      accentRgb = "16,185,129";
      bgTint = "transparent";
      modeColor = "#10b981";
    }

    const borderColor = `rgba(${accentRgb},${0.15 + intensity * 0.25})`;
    const glowIntensity = 0.2 + intensity * 0.8;

    // Pulse speed: adrenaline makes everything faster
    const pulseMs = Math.round(4000 - adrenaline * 2500);
    const pulseSpeed = `${Math.max(800, pulseMs)}ms`;

    // Breathe speed
    const breatheMs = Math.round(4000 - dopamine * 1500 - adrenaline * 1000);
    const breatheSpeed = `${Math.max(1500, breatheMs)}ms`;

    // Scanline color follows accent
    const scanlineColor = `rgba(${accentRgb},${0.3 + intensity * 0.3})`;

    // Grid opacity: dopamine expands awareness, cortisol contracts it
    const gridOpacity = holographic
      ? 0.08 + dopamine * 0.06
      : 0.02 + dopamine * 0.03 - cortisol * 0.01;

    // Font weight: cortisol = heavier/tighter, dopamine = lighter
    const fontWeight = Math.round(400 + cortisol * 200 - dopamine * 50);

    // Layout density
    const layoutDensity: "tight" | "normal" | "expansive" =
      cortisol > 0.6 ? "tight"
      : dopamine > 0.6 || holographic ? "expansive"
      : "normal";

    // Cognitive mode label
    const cognitiveMode =
      holographic ? "HOLOGRAPHIC"
      : cortisol > 0.6 ? "HIGH ALERT"
      : adrenaline > 0.6 ? "COMBAT READY"
      : dopamine > 0.5 ? "SYNTHESIS"
      : "NOMINAL";

    // Noise: cortisol increases grain
    const noiseOpacity = 0.4 + cortisol * 0.4;

    // Message glow
    const messageGlow = `0 0 ${Math.round(8 + intensity * 16)}px rgba(${accentRgb},${0.1 + intensity * 0.2})`;

    return {
      cortisol, dopamine, adrenaline, holographic,
      accentColor, accentRgb, bgTint, borderColor,
      glowIntensity, pulseSpeed, scanlineColor, gridOpacity,
      fontWeight, layoutDensity, cognitiveMode, modeColor,
      noiseOpacity, breatheSpeed, messageGlow,
    };
  }, [state]);
}
