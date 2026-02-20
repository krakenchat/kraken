import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
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

describe('MessageSpan URL rendering', () => {
  it('renders a URL as a clickable link', () => {
    const span: Span = { type: SpanType.PLAINTEXT, text: 'Visit https://example.com for info' };
    renderWithProviders(<MessageSpan span={span} index={0} />);
    const link = screen.getByRole('link', { name: 'https://example.com' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders multiple URLs in one span', () => {
    const span: Span = { type: SpanType.PLAINTEXT, text: 'See https://a.com and http://b.com here' };
    renderWithProviders(<MessageSpan span={span} index={0} />);
    expect(screen.getByRole('link', { name: 'https://a.com' })).toHaveAttribute('href', 'https://a.com');
    expect(screen.getByRole('link', { name: 'http://b.com' })).toHaveAttribute('href', 'http://b.com');
  });

  it('does not render non-URL text as a link', () => {
    const span: Span = { type: SpanType.PLAINTEXT, text: 'no links here' };
    renderWithProviders(<MessageSpan span={span} index={0} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('no links here')).toBeInTheDocument();
  });

  it('strips trailing sentence punctuation from URLs', () => {
    const span: Span = { type: SpanType.PLAINTEXT, text: 'Check https://example.com.' };
    renderWithProviders(<MessageSpan span={span} index={0} />);
    const link = screen.getByRole('link', { name: 'https://example.com' });
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('preserves dots within URL paths', () => {
    const span: Span = { type: SpanType.PLAINTEXT, text: 'See https://example.com/page.html for details' };
    renderWithProviders(<MessageSpan span={span} index={0} />);
    const link = screen.getByRole('link', { name: 'https://example.com/page.html' });
    expect(link).toHaveAttribute('href', 'https://example.com/page.html');
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
