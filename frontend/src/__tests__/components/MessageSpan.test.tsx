import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test-utils';
import { MessageSpan, renderMessageSpans } from '../../components/Message/MessageSpan';
import { SpanType } from '../../types/message.type';
import type { Span } from '../../types/message.type';

describe('MessageSpan', () => {
  it('renders PLAINTEXT span text', () => {
    const span: Span = { type: SpanType.PLAINTEXT, text: 'Hello world' };
    renderWithProviders(<MessageSpan span={span} index={0} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders USER_MENTION span with text content', () => {
    const span: Span = { type: SpanType.USER_MENTION, text: '@testuser', userId: 'u1' };
    renderWithProviders(<MessageSpan span={span} index={0} />);
    expect(screen.getByText('@testuser')).toBeInTheDocument();
  });

  it('renders USER_MENTION span with userId fallback when text is absent', () => {
    const span: Span = { type: SpanType.USER_MENTION, userId: 'user-abc-123' };
    renderWithProviders(<MessageSpan span={span} index={0} />);
    expect(screen.getByText('user-abc-123')).toBeInTheDocument();
  });

  it('renders SPECIAL_MENTION span with @specialKind text', () => {
    const span: Span = { type: SpanType.SPECIAL_MENTION, specialKind: 'here' };
    renderWithProviders(<MessageSpan span={span} index={0} />);
    expect(screen.getByText('@here')).toBeInTheDocument();
  });

  it('renders COMMUNITY_MENTION span with text content', () => {
    const span: Span = { type: SpanType.COMMUNITY_MENTION, text: '#general', communityId: 'c1' };
    renderWithProviders(<MessageSpan span={span} index={0} />);
    expect(screen.getByText('#general')).toBeInTheDocument();
  });

  it('renders ALIAS_MENTION span with text content', () => {
    const span: Span = { type: SpanType.ALIAS_MENTION, text: '@devteam', aliasId: 'a1' };
    renderWithProviders(<MessageSpan span={span} index={0} />);
    expect(screen.getByText('@devteam')).toBeInTheDocument();
  });
});

describe('MessageSpan markdown rendering', () => {
  it('renders **bold** text', () => {
    const span: Span = { type: SpanType.PLAINTEXT, text: '**bold text**' };
    renderWithProviders(<MessageSpan span={span} index={0} />);
    expect(screen.getByText('bold text')).toBeInTheDocument();
    expect(screen.getByText('bold text').tagName).toBe('STRONG');
  });

  it('renders *italic* text', () => {
    const span: Span = { type: SpanType.PLAINTEXT, text: '*italic text*' };
    renderWithProviders(<MessageSpan span={span} index={0} />);
    expect(screen.getByText('italic text')).toBeInTheDocument();
    expect(screen.getByText('italic text').tagName).toBe('EM');
  });

  it('renders ~~strikethrough~~ text', () => {
    const span: Span = { type: SpanType.PLAINTEXT, text: '~~struck~~' };
    renderWithProviders(<MessageSpan span={span} index={0} />);
    expect(screen.getByText('struck')).toBeInTheDocument();
    expect(screen.getByText('struck').tagName).toBe('DEL');
  });

  it('renders `inline code`', () => {
    const span: Span = { type: SpanType.PLAINTEXT, text: 'use `myFunc()` here' };
    renderWithProviders(<MessageSpan span={span} index={0} />);
    expect(screen.getByText('myFunc()')).toBeInTheDocument();
    expect(screen.getByText('myFunc()').tagName).toBe('CODE');
  });

  it('renders ||spoiler|| as hidden text that reveals on click', async () => {
    const user = userEvent.setup();
    const span: Span = { type: SpanType.PLAINTEXT, text: '||secret||' };
    renderWithProviders(<MessageSpan span={span} index={0} />);
    const spoiler = screen.getByText('secret');
    expect(spoiler).toBeInTheDocument();
    // Before click: has role button and not yet pressed
    expect(spoiler).toHaveAttribute('role', 'button');
    expect(spoiler).toHaveAttribute('aria-pressed', 'false');
    await user.click(spoiler);
    // After click: aria-pressed is true
    expect(spoiler).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not render raw HTML (XSS prevention)', () => {
    const span: Span = { type: SpanType.PLAINTEXT, text: '<script>alert("xss")</script>' };
    const { container } = renderWithProviders(<MessageSpan span={span} index={0} />);
    expect(container.querySelector('script')).toBeNull();
  });

  it('renders links with target _blank', () => {
    const span: Span = { type: SpanType.PLAINTEXT, text: '[click](https://example.com)' };
    renderWithProviders(<MessageSpan span={span} index={0} />);
    const link = screen.getByText('click');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('does not render images', () => {
    const span: Span = { type: SpanType.PLAINTEXT, text: '![alt](https://example.com/img.png)' };
    const { container } = renderWithProviders(<MessageSpan span={span} index={0} />);
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders empty text without crashing', () => {
    const span: Span = { type: SpanType.PLAINTEXT, text: '' };
    const { container } = renderWithProviders(<MessageSpan span={span} index={0} />);
    expect(container).toBeInTheDocument();
  });
});

describe('renderMessageSpans', () => {
  it('renders an array of multiple spans correctly', () => {
    const spans: Span[] = [
      { type: SpanType.PLAINTEXT, text: 'Hello ' },
      { type: SpanType.USER_MENTION, text: '@alice', userId: 'u1' },
      { type: SpanType.PLAINTEXT, text: ' welcome to ' },
      { type: SpanType.COMMUNITY_MENTION, text: '#general', communityId: 'c1' },
    ];
    renderWithProviders(<div>{renderMessageSpans(spans)}</div>);
    expect(screen.getByText('Hello', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('@alice')).toBeInTheDocument();
    expect(screen.getByText('welcome to', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('#general')).toBeInTheDocument();
  });
});
