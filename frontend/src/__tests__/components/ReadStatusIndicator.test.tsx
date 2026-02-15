import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import { ReadStatusIndicator } from '../../components/Message/ReadStatusIndicator';
import type { ReadStatus } from '../../components/Message/ReadStatusIndicator';

const defaultProps = (): { status: ReadStatus; showForDm?: boolean; disableTooltip?: boolean } => ({
  status: 'sent',
});

describe('ReadStatusIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders check icon for "sent" status', () => {
    renderWithProviders(<ReadStatusIndicator {...defaultProps()} status="sent" />);

    // DoneIcon (check) should be rendered
    const icon = screen.getByTestId('DoneIcon');
    expect(icon).toBeInTheDocument();
    // VisibilityIcon should NOT be rendered
    expect(screen.queryByTestId('VisibilityIcon')).not.toBeInTheDocument();
  });

  it('renders eye icon for "read" status', () => {
    renderWithProviders(<ReadStatusIndicator {...defaultProps()} status="read" />);

    // VisibilityIcon (eye) should be rendered
    const icon = screen.getByTestId('VisibilityIcon');
    expect(icon).toBeInTheDocument();
    // DoneIcon should NOT be rendered
    expect(screen.queryByTestId('DoneIcon')).not.toBeInTheDocument();
  });

  it('renders eye icon for "delivered" status (treated same as read)', () => {
    renderWithProviders(<ReadStatusIndicator {...defaultProps()} status="delivered" />);

    const icon = screen.getByTestId('VisibilityIcon');
    expect(icon).toBeInTheDocument();
    expect(screen.queryByTestId('DoneIcon')).not.toBeInTheDocument();
  });

  it('returns null when showForDm is false', () => {
    const { container } = renderWithProviders(
      <ReadStatusIndicator {...defaultProps()} showForDm={false} />
    );

    expect(container.innerHTML).toBe('');
  });

  it('shows tooltip with "Sent" text when status is "sent"', async () => {
    const { user } = renderWithProviders(
      <ReadStatusIndicator {...defaultProps()} status="sent" />
    );

    const icon = screen.getByTestId('DoneIcon');
    await user.hover(icon);

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Sent');
  });

  it('shows tooltip with "Seen" text when status is "read"', async () => {
    const { user } = renderWithProviders(
      <ReadStatusIndicator {...defaultProps()} status="read" />
    );

    const icon = screen.getByTestId('VisibilityIcon');
    await user.hover(icon);

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Seen');
  });

  it('renders without tooltip when disableTooltip is true', async () => {
    const { user } = renderWithProviders(
      <ReadStatusIndicator {...defaultProps()} status="sent" disableTooltip={true} />
    );

    const icon = screen.getByTestId('DoneIcon');
    expect(icon).toBeInTheDocument();

    // Hover should NOT produce a tooltip
    await user.hover(icon);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
