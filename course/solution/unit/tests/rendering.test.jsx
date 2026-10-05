// @tutorial:begin c1-render
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Summary from '../src/client/components/Summary.jsx';
import TaskItem from '../src/client/components/TaskItem.jsx';

describe('Summary', () => {
  it('says how many tasks are done', () => {
    const tasks = [
      { id: 1, done: 1 },
      { id: 2, done: 0 },
      { id: 3, done: 0 },
    ];

    render(<Summary tasks={tasks} />);

    expect(screen.getByText('1 of 3 done')).toBeInTheDocument();
  });

  it('says 0 of 0 when there are no tasks', () => {
    render(<Summary tasks={[]} />);
    expect(screen.getByText('0 of 0 done')).toBeInTheDocument();
  });
});

describe('TaskItem', () => {
  it('shows the title and a Delete button', () => {
    render(<TaskItem task={{ id: 1, title: 'Buy milk', done: 0 }} onToggle={() => {}} onDelete={() => {}} />);

    expect(screen.getByText('Buy milk')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Mark "Buy milk" as done' })).toBeInTheDocument();
  });
});
// @tutorial:end c1-render
