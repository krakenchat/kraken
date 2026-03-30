import { describe, it, expect } from 'vitest';
import { computeVoiceLevel } from '../../utils/audioLevel';

function createMockAnalyser(
  sampleRate: number,
  fftSize: number,
  fillFn: (arr: Uint8Array) => void,
): AnalyserNode {
  const binCount = fftSize / 2;
  return {
    fftSize,
    frequencyBinCount: binCount,
    context: { sampleRate } as AudioContext,
    getByteFrequencyData: fillFn,
  } as unknown as AnalyserNode;
}

describe('computeVoiceLevel', () => {
  it('returns level based only on voice-frequency bins (80-4000Hz)', () => {
    const fftSize = 256;
    const sampleRate = 48000;
    const binHz = sampleRate / fftSize; // 187.5
    const voiceEnd = Math.ceil(4000 / binHz); // 22

    const analyser = createMockAnalyser(sampleRate, fftSize, (arr: Uint8Array) => {
      // Voice bins at 200, rest at 0
      for (let i = 0; i < arr.length; i++) {
        arr[i] = i < voiceEnd ? 200 : 0;
      }
    });

    const dataArray = new Uint8Array(fftSize / 2);
    const level = computeVoiceLevel(analyser, dataArray);

    // Should be ~78.4 (200/255*100), not diluted by zero-filled high bins
    expect(level).toBeGreaterThan(70);
    expect(level).toBeLessThan(85);
  });

  it('returns near-zero for silence', () => {
    const analyser = createMockAnalyser(48000, 256, (arr: Uint8Array) => {
      arr.fill(0);
    });

    const dataArray = new Uint8Array(128);
    const level = computeVoiceLevel(analyser, dataArray);
    expect(level).toBe(0);
  });

  it('returns 100 for max amplitude in voice range', () => {
    const analyser = createMockAnalyser(48000, 256, (arr: Uint8Array) => {
      arr.fill(255);
    });

    const dataArray = new Uint8Array(128);
    const level = computeVoiceLevel(analyser, dataArray);
    expect(level).toBeCloseTo(100, 0);
  });

  it('ignores high-frequency noise outside voice range', () => {
    const fftSize = 256;
    const sampleRate = 48000;
    const binHz = sampleRate / fftSize;
    const voiceEnd = Math.ceil(4000 / binHz);

    const analyser = createMockAnalyser(sampleRate, fftSize, (arr: Uint8Array) => {
      // Voice bins silent, high-frequency bins loud
      for (let i = 0; i < arr.length; i++) {
        arr[i] = i >= voiceEnd ? 255 : 0;
      }
    });

    const dataArray = new Uint8Array(128);
    const level = computeVoiceLevel(analyser, dataArray);
    expect(level).toBe(0);
  });
});
