import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { generateTheme } from '../../theme/themeConfig';
import { MessageLinkPreviews } from '../../components/Message/MessageLinkPreviews';
import type { LinkPreview } from '../../types/message.type';

const theme = generateTheme('dark', 'blue', 'balanced');

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

function makePreview(overrides: Partial<LinkPreview> = {}): LinkPreview {
  return {
    url: 'https://example.com/default',
    title: 'Default Title',
    description: 'Default description',
    siteName: 'Example',
    ...overrides,
  };
}

describe('MessageLinkPreviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when linkPreviews is undefined', () => {
    const { container } = renderWithTheme(
      <MessageLinkPreviews linkPreviews={undefined} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('returns null when linkPreviews is empty array', () => {
    const { container } = renderWithTheme(
      <MessageLinkPreviews linkPreviews={[]} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders a single LinkPreviewCard for one preview', () => {
    const previews: LinkPreview[] = [
      makePreview({
        url: 'https://example.com/one',
        title: 'First Article',
      }),
    ];

    renderWithTheme(<MessageLinkPreviews linkPreviews={previews} />);

    expect(screen.getByText('First Article')).toBeDefined();
  });

  it('renders multiple LinkPreviewCard components for multiple previews', () => {
    const previews: LinkPreview[] = [
      makePreview({
        url: 'https://example.com/one',
        title: 'First Article',
        siteName: 'Site A',
      }),
      makePreview({
        url: 'https://example.com/two',
        title: 'Second Article',
        siteName: 'Site B',
      }),
      makePreview({
        url: 'https://example.com/three',
        title: 'Third Article',
        siteName: 'Site C',
      }),
    ];

    renderWithTheme(<MessageLinkPreviews linkPreviews={previews} />);

    expect(screen.getByText('First Article')).toBeDefined();
    expect(screen.getByText('Second Article')).toBeDefined();
    expect(screen.getByText('Third Article')).toBeDefined();
    expect(screen.getByText('Site A')).toBeDefined();
    expect(screen.getByText('Site B')).toBeDefined();
    expect(screen.getByText('Site C')).toBeDefined();
  });
});
