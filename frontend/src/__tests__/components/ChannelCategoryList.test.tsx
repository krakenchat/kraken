import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders, createChannel, resetFactoryCounter } from '../test-utils';
import ChannelCategoryList from '../../components/Channel/ChannelCategoryList';
import type { Channel } from '../../types/channel.type';

const textChannel = createChannel({ id: 'ch-1', name: 'general', type: 'TEXT', position: 0 });
const voiceChannel = createChannel({ id: 'ch-2', name: 'voice-chat', type: 'VOICE', position: 0 });
const privateChannel = createChannel({ id: 'ch-3', name: 'secret', type: 'TEXT', isPrivate: true, position: 1 });

describe('ChannelCategoryList', () => {
  const defaultProps = {
    channels: [] as Channel[],
    onChannelSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('renders "No channels yet" for empty channels array', () => {
    renderWithProviders(<ChannelCategoryList {...defaultProps} channels={[]} />);

    expect(screen.getByText('No channels yet')).toBeInTheDocument();
  });

  it('renders Text Channels and Voice Channels category headers', () => {
    renderWithProviders(
      <ChannelCategoryList
        {...defaultProps}
        channels={[textChannel, voiceChannel] as Channel[]}
      />,
    );

    expect(screen.getByText('TEXT CHANNELS')).toBeInTheDocument();
    expect(screen.getByText('VOICE CHANNELS')).toBeInTheDocument();
  });

  it('renders channel names in correct categories', () => {
    renderWithProviders(
      <ChannelCategoryList
        {...defaultProps}
        channels={[textChannel, voiceChannel] as Channel[]}
      />,
    );

    expect(screen.getByText('general')).toBeInTheDocument();
    expect(screen.getByText('voice-chat')).toBeInTheDocument();
  });

  it('calls onChannelSelect with channel id when channel clicked', async () => {
    const onChannelSelect = vi.fn();
    const { user } = renderWithProviders(
      <ChannelCategoryList
        {...defaultProps}
        onChannelSelect={onChannelSelect}
        channels={[textChannel] as Channel[]}
      />,
    );

    await user.click(screen.getByText('general'));

    expect(onChannelSelect).toHaveBeenCalledWith('ch-1');
  });

  it('collapses category when category header clicked', async () => {
    const { user } = renderWithProviders(
      <ChannelCategoryList
        {...defaultProps}
        channels={[textChannel] as Channel[]}
      />,
    );

    // Channel is visible initially (category starts expanded)
    expect(screen.getByText('general')).toBeVisible();

    // Click the category header to collapse
    await user.click(screen.getByText('TEXT CHANNELS'));

    // Channel should no longer be visible after collapse
    expect(screen.queryByText('general')).not.toBeVisible();
  });

  it('sorts channels by position', () => {
    const channelPos2 = createChannel({ id: 'ch-a', name: 'third', type: 'TEXT', position: 2 });
    const channelPos0 = createChannel({ id: 'ch-b', name: 'first', type: 'TEXT', position: 0 });
    const channelPos1 = createChannel({ id: 'ch-c', name: 'second', type: 'TEXT', position: 1 });

    renderWithProviders(
      <ChannelCategoryList
        {...defaultProps}
        channels={[channelPos2, channelPos0, channelPos1] as Channel[]}
      />,
    );

    const channelNames = screen.getAllByText(/first|second|third/);
    expect(channelNames[0]).toHaveTextContent('first');
    expect(channelNames[1]).toHaveTextContent('second');
    expect(channelNames[2]).toHaveTextContent('third');
  });

  it('shows lock icon for private channels', () => {
    renderWithProviders(
      <ChannelCategoryList
        {...defaultProps}
        channels={[privateChannel] as Channel[]}
      />,
    );

    // The lock icon should be rendered via MUI LockIcon (has data-testid="LockIcon")
    expect(screen.getByTestId('LockIcon')).toBeInTheDocument();
  });

  it('does not show lock icon for public channels', () => {
    renderWithProviders(
      <ChannelCategoryList
        {...defaultProps}
        channels={[textChannel] as Channel[]}
      />,
    );

    expect(screen.queryByTestId('LockIcon')).not.toBeInTheDocument();
  });

  it('does not render empty categories', () => {
    // Only text channels provided - Voice Channels header should not appear
    renderWithProviders(
      <ChannelCategoryList
        {...defaultProps}
        channels={[textChannel] as Channel[]}
      />,
    );

    expect(screen.getByText('TEXT CHANNELS')).toBeInTheDocument();
    expect(screen.queryByText('VOICE CHANNELS')).not.toBeInTheDocument();
  });

  it('applies Mui-selected class to the selected channel', () => {
    renderWithProviders(
      <ChannelCategoryList
        {...defaultProps}
        channels={[textChannel] as Channel[]}
        selectedChannelId="ch-1"
      />,
    );

    // The ListItemButton wrapping the channel text should have the selected class
    const channelButton = screen.getByText('general').closest('.MuiListItemButton-root');
    expect(channelButton).toHaveClass('Mui-selected');
  });
});
