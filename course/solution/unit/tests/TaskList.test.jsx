// @tutorial:begin c3-list
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TaskList from '../src/client/components/TaskList.jsx';

let fetchMock;
// What fetch gives back: an object with ok, status and a json() function.
const answer = (body, { ok = true, status = 200 } = {}) => ({ ok, status, json: async () => body });

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TaskList', () => {
  it('shows Loading... while the tasks are on their way', () => {
    fetchMock.mockReturnValue(new Promise(() => {})); // never answers

    render(<TaskList />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows the tasks it receives', async () => {
    fetchMock.mockResolvedValue(
      answer([
        { id: 1, title: 'Buy milk', done: 0 },
        { id: 2, title: 'Walk the dog', done: 1 },
      ]),
    );

    render(<TaskList />);

    expect(await screen.findByText('Buy milk')).toBeInTheDocument();
    expect(screen.getByText('Walk the dog')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledWith('/api/tasks');
  });

  it('shows a friendly message when there are no tasks', async () => {
    fetchMock.mockResolvedValue(answer([]));

    render(<TaskList />);

    expect(await screen.findByText(/No tasks yet/)).toBeInTheDocument();
  });

  it('shows an error when the server answers with an error', async () => {
    fetchMock.mockResolvedValue(answer([], { ok: false, status: 500 }));

    render(<TaskList />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load tasks (500)');
  });
});
// @tutorial:end c3-list
