import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  VoiceProvider,
  useVoice,
  useVoiceDispatch,
  VoiceActionType,
} from '../../contexts/VoiceContext';

function TestConsumer() {
  const { stageMounted, showVideoTiles, isConnected } = useVoice();
  const { dispatch } = useVoiceDispatch();

  return (
    <div>
      <span data-testid="stage-mounted">{String(stageMounted)}</span>
      <span data-testid="show-video-tiles">{String(showVideoTiles)}</span>
      <span data-testid="is-connected">{String(isConnected)}</span>
      <button
        onClick={() => dispatch({ type: VoiceActionType.SetStageMounted, payload: true })}
      >
        Mount Stage
      </button>
      <button
        onClick={() => dispatch({ type: VoiceActionType.SetStageMounted, payload: false })}
      >
        Unmount Stage
      </button>
      <button onClick={() => dispatch({ type: VoiceActionType.SetShowVideoTiles, payload: true })}>
        Show Video Tiles
      </button>
      <button onClick={() => dispatch({ type: VoiceActionType.SetDisconnected })}>
        Disconnect
      </button>
    </div>
  );
}

describe('VoiceContext reducer', () => {
  it('stageMounted defaults to false', () => {
    render(
      <VoiceProvider>
        <TestConsumer />
      </VoiceProvider>,
    );

    expect(screen.getByTestId('stage-mounted')).toHaveTextContent('false');
  });

  it('SetStageMounted(true) sets stageMounted to true', async () => {
    const user = userEvent.setup();
    render(
      <VoiceProvider>
        <TestConsumer />
      </VoiceProvider>,
    );

    await user.click(screen.getByText('Mount Stage'));

    expect(screen.getByTestId('stage-mounted')).toHaveTextContent('true');
  });

  it('SetStageMounted(false) sets stageMounted back to false', async () => {
    const user = userEvent.setup();
    render(
      <VoiceProvider>
        <TestConsumer />
      </VoiceProvider>,
    );

    await user.click(screen.getByText('Mount Stage'));
    expect(screen.getByTestId('stage-mounted')).toHaveTextContent('true');

    await user.click(screen.getByText('Unmount Stage'));
    expect(screen.getByTestId('stage-mounted')).toHaveTextContent('false');
  });

  it('SetDisconnected resets stageMounted to false', async () => {
    const user = userEvent.setup();
    render(
      <VoiceProvider>
        <TestConsumer />
      </VoiceProvider>,
    );

    await user.click(screen.getByText('Mount Stage'));
    expect(screen.getByTestId('stage-mounted')).toHaveTextContent('true');

    await user.click(screen.getByText('Disconnect'));

    expect(screen.getByTestId('stage-mounted')).toHaveTextContent('false');
  });

  it('SetDisconnected resets stageMounted to false while preserving showVideoTiles', async () => {
    const user = userEvent.setup();
    render(
      <VoiceProvider>
        <TestConsumer />
      </VoiceProvider>,
    );

    await user.click(screen.getByText('Mount Stage'));
    await user.click(screen.getByText('Show Video Tiles'));
    expect(screen.getByTestId('show-video-tiles')).toHaveTextContent('true');

    await user.click(screen.getByText('Disconnect'));

    expect(screen.getByTestId('stage-mounted')).toHaveTextContent('false');
    expect(screen.getByTestId('show-video-tiles')).toHaveTextContent('true');
    expect(screen.getByTestId('is-connected')).toHaveTextContent('false');
  });
});
