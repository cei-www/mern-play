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

  it('tells the learner which tab has the terminal for the check', () => {
    const el = lesson('<div data-check="x"></div>');
    decorateLesson(el, { stepId: 'A.3', tabName: 'Robot' });
    expect(el.textContent).toContain('Terminal of the Robot tab');
    expect(el.textContent).toContain('tutorial check A.3');
    const other = lesson('<div data-check="x"></div>');
    decorateLesson(other, { stepId: '1.1' });
    expect(other.textContent).toContain('Terminal of the Editor tab');
  });

  it('marks translated English blocks', () => {
    const el = lesson('<code>server/app.js</code><div lang="en">A</div><div lang="th">ก</div>');
    decorateLesson(el, { stepId: '1.1' });
    expect(el.querySelector('[lang="en"]').classList.contains('has-th')).toBe(true);
  });
});

describe('bindLessonActions', () => {
  const ports = {
    editor: 8081,
    robot: 8083,
    dbadmin: 8085,
    express: 13000,
    vite: 15173,
    viteStyle: 15174,
    referenceApi: 13001,
    styleApi: 13002,
    report: 19323,
  };

  it('sends preview and swagger button clicks to the handlers, mapped to the configured ports', () => {
    const el = lesson(
      '<a href="#" data-action="preview" data-port="3000" data-path="/api/health">p</a>' +
        '<button data-action="swagger" data-op="listTasks" data-server="app">s</button>' +
        '<a href="#" data-action="preview" data-port="5173">no path</a>' +
        '<a href="#" data-action="preview" data-port="5174">tailwind</a>' +
        '<a href="#" data-action="preview" data-port="9323" data-path="/report.html">report</a>' +
        '<a href="#" data-action="preview" data-port="9999">custom</a>',
    );
    const preview = vi.fn();
    const swagger = vi.fn();
    bindLessonActions(el, { ports, preview, swagger });
    const [a, b, ...rest] = el.querySelectorAll('[data-action]');
    a.click();
    b.click();
    rest.forEach((node) => node.click());
    expect(preview).toHaveBeenNthCalledWith(1, { port: 13000, path: '/api/health' });
    expect(swagger).toHaveBeenCalledWith({ op: 'listTasks', server: 'app' });
    expect(preview).toHaveBeenNthCalledWith(2, { port: 15173, path: '/' });
    expect(preview).toHaveBeenNthCalledWith(3, { port: 15174, path: '/' });
    expect(preview).toHaveBeenNthCalledWith(4, { port: 19323, path: '/report.html' });
    expect(preview).toHaveBeenNthCalledWith(5, { port: 9999, path: '/' });
  });

  it('does not make inline code clickable', () => {
    const el = lesson('<code>server/app.js</code>');
    decorateLesson(el, { stepId: '1.1' });
    expect(el.querySelector('code').getAttribute('role')).toBeNull();
    expect(el.querySelector('code').getAttribute('tabindex')).toBeNull();
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
