import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import ConfirmDialog from '../../components/Common/ConfirmDialog';

const defaultProps = {
  open: true,
  title: 'Delete Item',
  description: 'Are you sure you want to delete this item?',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('ConfirmDialog', () => {
  beforeEach(() => {
    defaultProps.onConfirm = vi.fn();
    defaultProps.onCancel = vi.fn();
  });

  it('renders title and description when open', () => {
    renderWithProviders(<ConfirmDialog {...defaultProps} />);

    expect(screen.getByText('Delete Item')).toBeInTheDocument();
    expect(
      screen.getByText('Are you sure you want to delete this item?'),
    ).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    renderWithProviders(<ConfirmDialog {...defaultProps} open={false} />);

    expect(screen.queryByText('Delete Item')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Are you sure you want to delete this item?'),
    ).not.toBeInTheDocument();
  });

  it('renders string description in DialogContentText', () => {
    renderWithProviders(<ConfirmDialog {...defaultProps} />);

    const descriptionElement = screen.getByText(
      'Are you sure you want to delete this item?',
    );
    expect(descriptionElement.tagName).toBe('P');
  });

  it('renders ReactNode description directly', () => {
    renderWithProviders(
      <ConfirmDialog
        {...defaultProps}
        description={<div data-testid="custom">Custom content</div>}
      />,
    );

    expect(screen.getByTestId('custom')).toBeInTheDocument();
    expect(screen.getByText('Custom content')).toBeInTheDocument();
  });

  it('shows default confirm label "Confirm" when confirmLabel not provided', () => {
    renderWithProviders(<ConfirmDialog {...defaultProps} />);

    expect(
      screen.getByRole('button', { name: /confirm/i }),
    ).toBeInTheDocument();
  });

  it('shows custom confirm label when provided', () => {
    renderWithProviders(
      <ConfirmDialog {...defaultProps} confirmLabel="Delete Forever" />,
    );

    expect(
      screen.getByRole('button', { name: /delete forever/i }),
    ).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', async () => {
    const { user } = renderWithProviders(
      <ConfirmDialog {...defaultProps} />,
    );

    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(defaultProps.onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when cancel button clicked', async () => {
    const { user } = renderWithProviders(
      <ConfirmDialog {...defaultProps} />,
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(defaultProps.onCancel).toHaveBeenCalledOnce();
  });

  it('disables both buttons when isLoading is true', () => {
    renderWithProviders(<ConfirmDialog {...defaultProps} isLoading />);

    const buttons = screen.getAllByRole('button');
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    const confirmButton = buttons.find((btn) => btn !== cancelButton)!;

    expect(cancelButton).toBeDisabled();
    expect(confirmButton).toBeDisabled();
  });

  it('shows loading spinner instead of confirm label when isLoading', () => {
    renderWithProviders(<ConfirmDialog {...defaultProps} isLoading />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
  });
});
