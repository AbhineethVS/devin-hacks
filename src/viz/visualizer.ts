import type { Step } from "../engine/types";

export interface Visualizer {
  onStep(step: Step): void;
  resize(): void;
  dispose(): void;
}

// STUB (Card 4): Canvas 2D visualizer. For now it only keeps the canvas sized to its box.
export function createVisualizer(canvas: HTMLCanvasElement, _analyser: AnalyserNode): Visualizer {
  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
  };
  resize();
  return { onStep: () => {}, resize, dispose: () => {} };
}
