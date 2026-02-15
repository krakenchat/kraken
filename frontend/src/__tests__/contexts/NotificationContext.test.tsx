import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { generateTheme } from '../../theme/themeConfig';
import {
  NotificationProvider,
  useNotification,
} from '../../contexts/NotificationContext';

const theme = generateTheme('dark', 'blue', 'balanced');

function TestConsumer() {
  const { showNotification } = useNotification();
  return (
    <div>
      <button onClick={() => showNotification('Test message')}>
        Show Info
      </button>
      <button onClick={() => showNotification('Error occurred', 'error')}>
        Show Error
      </button>
    </div>
  );
}

function renderWithTheme(ui: React.ReactElement) {
  const user = userEvent.setup();
  const result = render(
    <ThemeProvider theme={theme}>{ui}</ThemeProvider>,
  );
  return { user, ...result };
}

describe('NotificationContext', () => {
  it('showNotification renders Snackbar with message text', async () => {
    const { user } = renderWithTheme(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>,
    );

    await user.click(screen.getByText('Show Info'));

    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('severity prop controls Alert type', async () => {
    const { user } = renderWithTheme(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>,
    );

    await user.click(screen.getByText('Show Error'));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Error occurred');
  });

  it('throws when useNotification is used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      render(
        <ThemeProvider theme={theme}>
          <TestConsumer />
        </ThemeProvider>,
      ),
    ).toThrow('useNotification must be used within a NotificationProvider');

    consoleSpy.mockRestore();
  });

  it('close button hides notification', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={theme}>
        <NotificationProvider>
          <TestConsumer />
        </NotificationProvider>
      </ThemeProvider>,
    );

    await user.click(screen.getByText('Show Info'));
    expect(screen.getByText('Test message')).toBeInTheDocument();

    // MUI Alert renders a close button with title="Close"
    const closeButton = screen.getByTitle('Close');
    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText('Test message')).not.toBeInTheDocument();
    });
  });
});
