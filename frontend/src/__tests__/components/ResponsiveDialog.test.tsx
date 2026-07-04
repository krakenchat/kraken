import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { DialogContent, DialogActions, Button } from '@mui/material';
import { renderWithProviders } from '../test-utils';
import ResponsiveDialog from '../../components/Common/ResponsiveDialog';

// Mock the breakpoint hook so we can toggle mobile vs desktop deterministically.
const { mockUseMobileBreakpoint } = vi.hoisted(() => ({
  mockUseMobileBreakpoint: vi.fn(() => false),
}));

vi.mock('../../hooks/useResponsive', () => ({
  useMobileBreakpoint: mockUseMobileBreakpoint,
}));

const renderDialog = (onClose = vi.fn(), titleActions?: ReactNode) =>
  renderWithProviders(
    <ResponsiveDialog
      open
      onClose={onClose}
      title="My Dialog Title"
      titleActions={titleActions}
      maxWidth="md"
      fullWidth
    >
      <DialogContent>
        <div>Dialog body content</div>
      </DialogContent>
      <DialogActions>
        <Button>Save</Button>
      </DialogActions>
    </ResponsiveDialog>
  );

describe('ResponsiveDialog', () => {
  beforeEach(() => {
    mockUseMobileBreakpoint.mockReset();
    mockUseMobileBreakpoint.mockReturnValue(false);
  });

  it('renders the title and children on desktop without a close button', () => {
    mockUseMobileBreakpoint.mockReturnValue(false);
    renderDialog();

    expect(screen.getByText('My Dialog Title')).toBeInTheDocument();
    expect(screen.getByText('Dialog body content')).toBeInTheDocument();
    // No fullscreen app-bar close button on desktop
    expect(screen.queryByLabelText('close')).not.toBeInTheDocument();
  });

  it('renders fullScreen with a title bar and close button below the breakpoint', () => {
    mockUseMobileBreakpoint.mockReturnValue(true);
    renderDialog();

    expect(screen.getByText('My Dialog Title')).toBeInTheDocument();
    expect(screen.getByText('Dialog body content')).toBeInTheDocument();

    const closeButton = screen.getByLabelText('close');
    expect(closeButton).toBeInTheDocument();

    // MUI applies the fullScreen paper class to the dialog paper when active
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('MuiDialog-paperFullScreen');
  });

  it('renders titleActions content in the DialogTitle on desktop', () => {
    mockUseMobileBreakpoint.mockReturnValue(false);
    renderDialog(vi.fn(), <button aria-label="pin">Pin</button>);

    expect(screen.getByText('My Dialog Title')).toBeInTheDocument();
    expect(screen.getByLabelText('pin')).toBeInTheDocument();
  });

  it('fires onClose when the mobile close button is clicked', async () => {
    mockUseMobileBreakpoint.mockReturnValue(true);
    const onClose = vi.fn();
    const { user } = renderDialog(onClose);

    await user.click(screen.getByLabelText('close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
