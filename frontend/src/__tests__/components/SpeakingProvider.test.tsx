import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpeakingProvider } from '../../contexts/SpeakingContext';
import { useSpeaking } from '../../hooks/useSpeaking';

// The provider is a thin wrapper that mounts useSpeakingDetection exactly once
// and shares its result via context — mock the underlying hook.
const mockUseSpeakingDetection = vi.fn();
vi.mock('../../hooks/useSpeakingDetection', () => ({
  useSpeakingDetection: () => mockUseSpeakingDetection(),
}));

function Probe({ userId, testId }: { userId: string; testId: string }) {
  const { isSpeaking } = useSpeaking();
  return <div data-testid={testId}>{isSpeaking(userId) ? 'speaking' : 'silent'}</div>;
}

describe('SpeakingProvider', () => {
  beforeEach(() => {
    mockUseSpeakingDetection.mockReset();
    mockUseSpeakingDetection.mockReturnValue({
      speakingMap: new Map<string, boolean>([
        ['alice', true],
        ['bob', false],
      ]),
      isSpeaking: (id: string) => id === 'alice',
    });
  });

  it('renders its children', () => {
    render(
      <SpeakingProvider>
        <div data-testid="child">hello</div>
      </SpeakingProvider>,
    );

    expect(screen.getByTestId('child')).toHaveTextContent('hello');
  });

  it('exposes isSpeaking backed by the detection hook speakingMap', () => {
    render(
      <SpeakingProvider>
        <Probe userId="alice" testId="alice" />
        <Probe userId="bob" testId="bob" />
        <Probe userId="unknown" testId="unknown" />
      </SpeakingProvider>,
    );

    expect(screen.getByTestId('alice')).toHaveTextContent('speaking');
    expect(screen.getByTestId('bob')).toHaveTextContent('silent');
    expect(screen.getByTestId('unknown')).toHaveTextContent('silent');
  });

  it('mounts the detection hook exactly once regardless of consumer count', () => {
    render(
      <SpeakingProvider>
        <Probe userId="alice" testId="a" />
        <Probe userId="alice" testId="b" />
        <Probe userId="alice" testId="c" />
      </SpeakingProvider>,
    );

    expect(mockUseSpeakingDetection).toHaveBeenCalledTimes(1);
  });

  it('degrades to "nobody speaking" when used outside a provider', () => {
    render(<Probe userId="alice" testId="orphan" />);

    expect(screen.getByTestId('orphan')).toHaveTextContent('silent');
    expect(mockUseSpeakingDetection).not.toHaveBeenCalled();
  });
});
