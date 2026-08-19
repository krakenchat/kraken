import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  VoiceProvider,
  useVoice,
  useVoiceDispatch,
  VoiceActionType,
} from '../../contexts/VoiceContext';
import { VideoLayoutMode } from '../../types/videoLayout';

function TestConsumer() {
  const { stageMounted, showVideoTiles, isConnected, layoutMode, pinnedTileId, spotlightTileId } = useVoice();
  const { dispatch } = useVoiceDispatch();

  return (
    <div>
      <span data-testid="stage-mounted">{String(stageMounted)}</span>
      <span data-testid="show-video-tiles">{String(showVideoTiles)}</span>
      <span data-testid="is-connected">{String(isConnected)}</span>
      <span data-testid="layout-mode">{layoutMode}</span>
      <span data-testid="pinned-tile-id">{String(pinnedTileId)}</span>
      <span data-testid="spotlight-tile-id">{String(spotlightTileId)}</span>
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
      <button onClick={() => dispatch({ type: VoiceActionType.SetLayoutMode, payload: VideoLayoutMode.Grid })}>
        Set Grid
      </button>
      <button onClick={() => dispatch({ type: VoiceActionType.SetLayoutMode, payload: VideoLayoutMode.Sidebar })}>
        Set Sidebar
      </button>
      <button onClick={() => dispatch({ type: VoiceActionType.SetLayoutMode, payload: VideoLayoutMode.Spotlight })}>
        Set Spotlight
      </button>
      <button onClick={() => dispatch({ type: VoiceActionType.TogglePinTile, payload: 'tile-a' })}>
        Toggle Pin A
      </button>
      <button onClick={() => dispatch({ type: VoiceActionType.TogglePinTile, payload: 'tile-b' })}>
        Toggle Pin B
      </button>
      <button onClick={() => dispatch({ type: VoiceActionType.ToggleSpotlightTile, payload: 'tile-a' })}>
        Toggle Spotlight A
      </button>
      <button onClick={() => dispatch({ type: VoiceActionType.ToggleSpotlightTile, payload: 'tile-b' })}>
        Toggle Spotlight B
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

  it('layoutMode/pinnedTileId/spotlightTileId default to Grid/null/null', () => {
    render(
      <VoiceProvider>
        <TestConsumer />
      </VoiceProvider>,
    );

    expect(screen.getByTestId('layout-mode')).toHaveTextContent('grid');
    expect(screen.getByTestId('pinned-tile-id')).toHaveTextContent('null');
    expect(screen.getByTestId('spotlight-tile-id')).toHaveTextContent('null');
  });

  it('SetLayoutMode sets layoutMode directly', async () => {
    const user = userEvent.setup();
    render(
      <VoiceProvider>
        <TestConsumer />
      </VoiceProvider>,
    );

    await user.click(screen.getByText('Set Sidebar'));
    expect(screen.getByTestId('layout-mode')).toHaveTextContent('sidebar');

    await user.click(screen.getByText('Set Spotlight'));
    expect(screen.getByTestId('layout-mode')).toHaveTextContent('spotlight');
  });

  it('SetLayoutMode clears spotlightTileId when leaving Spotlight', async () => {
    const user = userEvent.setup();
    render(
      <VoiceProvider>
        <TestConsumer />
      </VoiceProvider>,
    );

    await user.click(screen.getByText('Toggle Spotlight A'));
    expect(screen.getByTestId('layout-mode')).toHaveTextContent('spotlight');
    expect(screen.getByTestId('spotlight-tile-id')).toHaveTextContent('tile-a');

    await user.click(screen.getByText('Set Grid'));
    expect(screen.getByTestId('layout-mode')).toHaveTextContent('grid');
    expect(screen.getByTestId('spotlight-tile-id')).toHaveTextContent('null');
  });

  it('SetLayoutMode does not touch spotlightTileId when re-selecting Spotlight', async () => {
    const user = userEvent.setup();
    render(
      <VoiceProvider>
        <TestConsumer />
      </VoiceProvider>,
    );

    await user.click(screen.getByText('Toggle Spotlight A'));
    await user.click(screen.getByText('Set Spotlight'));

    expect(screen.getByTestId('layout-mode')).toHaveTextContent('spotlight');
    expect(screen.getByTestId('spotlight-tile-id')).toHaveTextContent('tile-a');
  });

  it('TogglePinTile pins a new tile and forces Sidebar layout', async () => {
    const user = userEvent.setup();
    render(
      <VoiceProvider>
        <TestConsumer />
      </VoiceProvider>,
    );

    expect(screen.getByTestId('layout-mode')).toHaveTextContent('grid');

    await user.click(screen.getByText('Toggle Pin A'));

    expect(screen.getByTestId('pinned-tile-id')).toHaveTextContent('tile-a');
    expect(screen.getByTestId('layout-mode')).toHaveTextContent('sidebar');
  });

  it('TogglePinTile unpins the same tile and keeps the current layout', async () => {
    const user = userEvent.setup();
    render(
      <VoiceProvider>
        <TestConsumer />
      </VoiceProvider>,
    );

    await user.click(screen.getByText('Toggle Pin A'));
    expect(screen.getByTestId('layout-mode')).toHaveTextContent('sidebar');

    // Switch to Spotlight to verify unpin does not reset the layout back to Sidebar/Grid.
    await user.click(screen.getByText('Set Spotlight'));
    expect(screen.getByTestId('layout-mode')).toHaveTextContent('spotlight');

    await user.click(screen.getByText('Toggle Pin A'));

    expect(screen.getByTestId('pinned-tile-id')).toHaveTextContent('null');
    expect(screen.getByTestId('layout-mode')).toHaveTextContent('spotlight');
  });

  it('TogglePinTile switches the pin to a different tile and forces Sidebar', async () => {
    const user = userEvent.setup();
    render(
      <VoiceProvider>
        <TestConsumer />
      </VoiceProvider>,
    );

    await user.click(screen.getByText('Toggle Pin A'));
    expect(screen.getByTestId('pinned-tile-id')).toHaveTextContent('tile-a');

    await user.click(screen.getByText('Toggle Pin B'));
    expect(screen.getByTestId('pinned-tile-id')).toHaveTextContent('tile-b');
    expect(screen.getByTestId('layout-mode')).toHaveTextContent('sidebar');
  });

  it('ToggleSpotlightTile spotlights a tile and sets layoutMode to Spotlight', async () => {
    const user = userEvent.setup();
    render(
      <VoiceProvider>
        <TestConsumer />
      </VoiceProvider>,
    );

    await user.click(screen.getByText('Toggle Spotlight A'));

    expect(screen.getByTestId('spotlight-tile-id')).toHaveTextContent('tile-a');
    expect(screen.getByTestId('layout-mode')).toHaveTextContent('spotlight');
  });

  it('ToggleSpotlightTile on the same tile while spotlighted returns to Grid', async () => {
    const user = userEvent.setup();
    render(
      <VoiceProvider>
        <TestConsumer />
      </VoiceProvider>,
    );

    await user.click(screen.getByText('Toggle Spotlight A'));
    await user.click(screen.getByText('Toggle Spotlight A'));

    expect(screen.getByTestId('spotlight-tile-id')).toHaveTextContent('null');
    expect(screen.getByTestId('layout-mode')).toHaveTextContent('grid');
  });

  it('ToggleSpotlightTile on a different tile while spotlighted switches the spotlight', async () => {
    const user = userEvent.setup();
    render(
      <VoiceProvider>
        <TestConsumer />
      </VoiceProvider>,
    );

    await user.click(screen.getByText('Toggle Spotlight A'));
    await user.click(screen.getByText('Toggle Spotlight B'));

    expect(screen.getByTestId('spotlight-tile-id')).toHaveTextContent('tile-b');
    expect(screen.getByTestId('layout-mode')).toHaveTextContent('spotlight');
  });

  it('SetDisconnected resets layoutMode/pinnedTileId/spotlightTileId', async () => {
    const user = userEvent.setup();
    render(
      <VoiceProvider>
        <TestConsumer />
      </VoiceProvider>,
    );

    await user.click(screen.getByText('Toggle Pin A'));
    await user.click(screen.getByText('Toggle Spotlight B'));
    expect(screen.getByTestId('layout-mode')).toHaveTextContent('spotlight');

    await user.click(screen.getByText('Disconnect'));

    expect(screen.getByTestId('layout-mode')).toHaveTextContent('grid');
    expect(screen.getByTestId('pinned-tile-id')).toHaveTextContent('null');
    expect(screen.getByTestId('spotlight-tile-id')).toHaveTextContent('null');
  });
});
