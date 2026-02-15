import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { SocketContext } from '../../utils/SocketContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { createTestQueryClient } from './queryClient';
import type { MockSocket } from './mockSocket';

const defaultTheme = createTheme({
  palette: {
    semantic: {
      status: {
        positive: '#22c55e',
        negative: '#ef4444',
        positiveText: '#ffffff',
        negativeText: '#ffffff',
      },
      overlay: {
        light: 'rgba(0,0,0,0.3)',
        medium: 'rgba(0,0,0,0.5)',
        heavy: 'rgba(0,0,0,0.7)',
      },
    },
  },
} as Parameters<typeof createTheme>[0]);

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  socket?: MockSocket | null;
  isSocketConnected?: boolean;
  routerProps?: MemoryRouterProps;
  withRouter?: boolean;
  withTheme?: boolean;
}

export function renderWithProviders(
  ui: React.ReactElement,
  options: RenderWithProvidersOptions = {},
) {
  const {
    queryClient = createTestQueryClient(),
    socket = null,
    isSocketConnected = false,
    routerProps = {},
    withRouter = true,
    withTheme = true,
    ...renderOptions
  } = options;

  const user = userEvent.setup();

  function Wrapper({ children }: { children: React.ReactNode }) {
    let content = <>{children}</>;

    // NotificationProvider wraps children (renders Snackbar for assertions)
    content = <NotificationProvider>{content}</NotificationProvider>;

    // Socket context
    content = (
      <SocketContext.Provider
        value={{ socket: socket as never, isConnected: socket ? isSocketConnected : false }}
      >
        {content}
      </SocketContext.Provider>
    );

    // Router (MemoryRouter for test control)
    if (withRouter) {
      content = <MemoryRouter {...routerProps}>{content}</MemoryRouter>;
    }

    // Theme (MUI needs this to render)
    if (withTheme) {
      content = <ThemeProvider theme={defaultTheme}>{content}</ThemeProvider>;
    }

    // QueryClient
    content = (
      <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>
    );

    return content;
  }

  const renderResult = render(ui, { wrapper: Wrapper, ...renderOptions });

  return {
    user,
    queryClient,
    ...renderResult,
  };
}
