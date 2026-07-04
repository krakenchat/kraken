import { describe, it, expect } from 'vitest';
import { isSwipeExemptTarget } from '../../utils/swipeExempt';

describe('isSwipeExemptTarget', () => {
  it('returns false for a plain div', () => {
    expect(isSwipeExemptTarget(document.createElement('div'))).toBe(false);
  });

  it('returns false for non-Element targets', () => {
    expect(isSwipeExemptTarget(null)).toBe(false);
    expect(isSwipeExemptTarget(document)).toBe(false);
  });

  it('exempts inputs and textareas (text selection surfaces)', () => {
    expect(isSwipeExemptTarget(document.createElement('input'))).toBe(true);
    expect(isSwipeExemptTarget(document.createElement('textarea'))).toBe(true);
  });

  it('exempts code blocks (pre) which scroll horizontally', () => {
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    pre.appendChild(code);
    expect(isSwipeExemptTarget(code)).toBe(true);
  });

  it('exempts elements marked with data-swipe-exempt (and their descendants)', () => {
    const gallery = document.createElement('div');
    gallery.setAttribute('data-swipe-exempt', '');
    const img = document.createElement('img');
    gallery.appendChild(img);
    expect(isSwipeExemptTarget(gallery)).toBe(true);
    expect(isSwipeExemptTarget(img)).toBe(true);
  });

  it('exempts contenteditable regions', () => {
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    expect(isSwipeExemptTarget(editable)).toBe(true);
  });

  it('exempts an ancestor with inline overflow-x: auto', () => {
    const scroller = document.createElement('div');
    scroller.setAttribute('style', 'overflow-x: auto');
    const child = document.createElement('span');
    scroller.appendChild(child);
    expect(isSwipeExemptTarget(child)).toBe(true);
  });
});
