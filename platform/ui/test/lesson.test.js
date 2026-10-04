import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bindLessonActions, copyText, decorateLesson } from '../js/lesson.js';

function lesson(html) {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.append(el);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('decorateLesson', () => {
  it('adds a Copy button and highlights code, and keeps the snippet text intact', () => {
    const highlightElement = vi.fn();
    const el = lesson('<pre data-snippet><code>a =&gt; b</code></pre>');
    decorateLesson(el, { stepId: '1.1', hljs: { highlightElement } });
    expect(highlightElement).toHaveBeenCalledOnce();
    expect(el.querySelector('pre .copy-btn')).not.toBeNull();
    expect(el.querySelector('pre code').textContent).toBe('a => b');
  });

  it('shows the copy button as an icon with an accessible name, not as text', () => {
    const el = lesson('<pre data-snippet><code>x</code></pre>');
    decorateLesson(el, { stepId: '1.1' });
    const button = el.querySelector('.copy-btn');
    expect(button.querySelector('svg')).not.toBeNull();
    expect(button.getAttribute('aria-label')).toBe('Copy');
    expect(button.textContent).toBe('');
  });

  it('does not highlight terminal commands and decorates a block only once', () => {
    const highlightElement = vi.fn();
    const el = lesson('<pre data-command><code>tutorial wipe</code></pre>');
    decorateLesson(el, { stepId: '1.1', hljs: { highlightElement } });
    decorateLesson(el, { stepId: '1.1', hljs: { highlightElement } });
    expect(highlightElement).not.toHaveBeenCalled();
    expect(el.querySelectorAll('.copy-btn')).toHaveLength(1);
  });

  it('turns a check placeholder into the command to type, and keeps the expected output', () => {
    const el = lesson('<div data-check="c1"><pre><code>PASS  all good</code></pre></div>');
    decorateLesson(el, { stepId: '3.4' });
    const block = el.querySelector('.check-block');
    expect(block.querySelector('code').textContent).toBe('tutorial check 3.4');
    expect(block.querySelector('details summary').textContent).toBe('What you should see');
    expect(block.querySelector('details').textContent).toContain('PASS  all good');
  });

  it('makes file names copyable and marks translated English blocks', () => {
    const el = lesson('<code data-copy>server/app.js</code><div lang="en">A</div><div lang="th">ก</div>');
    decorateLesson(el, { stepId: '1.1' });
    expect(el.querySelector('[data-copy]').getAttribute('role')).toBe('button');
    expect(el.querySelector('[lang="en"]').classList.contains('has-th')).toBe(true);
  });
});

describe('bindLessonActions', () => {
  it('sends preview and swagger button clicks to the handlers', () => {
    const el = lesson(
      '<a href="#" data-action="preview" data-port="3000" data-path="/api/health">p</a>' +
        '<button data-action="swagger" data-op="listTasks" data-server="app">s</button>' +
        '<a href="#" data-action="preview" data-port="5173">no path</a>',
    );
    const preview = vi.fn();
    const swagger = vi.fn();
    bindLessonActions(el, { preview, swagger });
    const [a, b, c] = el.querySelectorAll('[data-action]');
    a.click();
    b.click();
    c.click();
    expect(preview).toHaveBeenNthCalledWith(1, { port: 3000, path: '/api/health' });
    expect(swagger).toHaveBeenCalledWith({ op: 'listTasks', server: 'app' });
    expect(preview).toHaveBeenNthCalledWith(2, { port: 5173, path: '/' });
  });

  it('copies a clicked file name', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const el = lesson('<code data-copy>server/app.js</code>');
    bindLessonActions(el, { preview: () => {}, swagger: () => {} });
    el.querySelector('code').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(writeText).toHaveBeenCalledWith('server/app.js');
  });
});

describe('copyText', () => {
  it('falls back to execCommand when the Clipboard API is unavailable', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no')) } });
    document.execCommand = vi.fn().mockReturnValue(true);
    expect(await copyText('x')).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });
});
