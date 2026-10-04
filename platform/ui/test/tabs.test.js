import { describe, expect, it } from 'vitest';
import { createTabs, databaseUrl, editorUrl, previewUrl, robotUrl, serviceOf, swaggerUrl, TAB_LIST, unavailableMessage } from '../js/tabs.js';

const ports = { editor: 8081, robot: 8083, dbadmin: 8085, express: 3000, vite: 5173, viteStyle: 5174, referenceApi: 3001, styleApi: 3002, report: 9323 };

describe('tab list and URLs', () => {
  it('has the five tabs in the agreed order', () => {
    expect(TAB_LIST.map((t) => t.id)).toEqual(['editor', 'preview', 'database', 'swagger', 'robot']);
  });

  it('builds service URLs from the ports', () => {
    expect(editorUrl(ports)).toBe('http://localhost:8081/?folder=/workspace');
    expect(robotUrl({ ...ports, robot: 9083 })).toBe('http://localhost:9083/?folder=/workspace');
    expect(databaseUrl(ports)).toContain(':8085/?server=db&username=viewer');
    expect(previewUrl(3000, '/api/tasks')).toBe('http://localhost:3000/api/tasks');
    expect(previewUrl(5173, 'x')).toBe('http://localhost:5173/x');
    expect(previewUrl(5173)).toBe('http://localhost:5173/');
  });

  it('builds the Swagger URL with server, operation and a reload nonce', () => {
    expect(swaggerUrl()).toBe('/swagger/');
    expect(swaggerUrl({ op: 'listTasks', server: 'app' })).toBe('/swagger/?server=app&op=listTasks');
    expect(swaggerUrl({ op: 'health', nonce: 2 })).toBe('/swagger/?op=health&t=2');
  });

  it('knows which service each tab needs', () => {
    expect(serviceOf('editor')).toBe('workspace');
    expect(serviceOf('robot')).toBe('robot');
    expect(serviceOf('database')).toBe('dbadmin');
    expect(serviceOf('preview')).toBeNull();
    expect(serviceOf('swagger')).toBeNull();
  });

  it('explains how to start the Robot workspace', () => {
    const msg = unavailableMessage('robot', { gui: 'Docker Desktop: start ws-robot', cli: 'docker compose start ws-robot' });
    expect(msg.command).toBe('docker compose start ws-robot');
    expect(msg.lines.join(' ')).toMatch(/Docker Desktop/);
    expect(unavailableMessage('robot', undefined).command).toBe('docker compose start ws-robot');
  });
});

describe('createTabs', () => {
  function build() {
    document.body.innerHTML = '<div id="nav"></div><div id="panes"></div>';
    const nav = document.getElementById('nav');
    const panes = document.getElementById('panes');
    const tabs = createTabs({ nav, panes, ports, copyText: async () => true });
    return { tabs, nav, panes };
  }

  it('renders five tabs and shows one pane at a time', () => {
    const { tabs, nav, panes } = build();
    expect(nav.querySelectorAll('[role="tab"]')).toHaveLength(5);
    expect([...panes.querySelectorAll('.pane')].filter((p) => !p.hidden)).toHaveLength(1);
    tabs.show('preview');
    expect(nav.querySelector('#tab-preview').getAttribute('aria-selected')).toBe('true');
    expect(panes.querySelector('#pane-editor').hidden).toBe(true);
    expect(panes.querySelector('#pane-preview').hidden).toBe(false);
  });

  it('gives every tab an "open in a new browser tab" link', () => {
    const { nav } = build();
    const links = nav.querySelectorAll('a.tab-open');
    expect(links).toHaveLength(5);
    links.forEach((a) => {
      expect(a.target).toBe('_blank');
      expect(a.rel).toBe('noopener');
    });
  });

  it('shows a friendly message instead of an iframe while the Robot workspace is down, and loads it when it is up', () => {
    const { tabs, nav, panes } = build();
    tabs.show('robot');
    tabs.update({ workspace: 'up', robot: 'down', app: 'up', dbadmin: 'up', db: 'up' }, undefined);
    const pane = panes.querySelector('#pane-robot');
    expect(pane.classList.contains('is-unavailable')).toBe(true);
    expect(pane.textContent).toContain('Robot workspace is not running');
    expect(nav.querySelector('#tab-robot').parentElement.querySelector('a').getAttribute('aria-disabled')).toBe('true');
    expect(pane.querySelector('iframe').getAttribute('src')).toBeNull();

    tabs.update({ workspace: 'up', robot: 'up', app: 'up', dbadmin: 'up', db: 'up' }, undefined);
    expect(pane.classList.contains('is-unavailable')).toBe(false);
    expect(pane.querySelector('iframe').getAttribute('src')).toBe('http://localhost:8083/?folder=/workspace');
  });

  it('opens Preview and Swagger on the target a lesson asks for', () => {
    const { tabs, panes } = build();
    tabs.openPreview({ port: 3000, path: '/api/hello' });
    expect(tabs.active).toBe('preview');
    expect(panes.querySelector('#pane-preview iframe').getAttribute('src')).toBe('http://localhost:3000/api/hello');
    expect(panes.querySelector('#pane-preview input').value).toBe('/api/hello');

    tabs.openSwagger({ op: 'listTasks', server: 'app' });
    expect(tabs.active).toBe('swagger');
    expect(panes.querySelector('#pane-swagger iframe').getAttribute('src')).toMatch(/^\/swagger\/\?server=app&op=listTasks&t=\d+$/);
  });

  it('moves between tabs with the arrow keys', () => {
    const { tabs, nav } = build();
    nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(tabs.active).toBe('preview');
    nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(tabs.active).toBe('robot');
    nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(tabs.active).toBe('editor');
  });
});
