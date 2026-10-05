// @tutorial:begin exercise-4-task-item
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TaskItem from '../src/client/components/TaskItem.jsx';

const open = { id: 5, title: 'Buy milk', done: 0 };
const finished = { id: 6, title: 'Walk the dog', done: 1 };

describe('TaskItem toggling', () => {
  it('calls onToggle with the id of the task when the box is clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<TaskItem task={open} onToggle={onToggle} onDelete={() => {}} />);

    await user.click(screen.getByRole('checkbox'));

    expect(onToggle).toHaveBeenCalledWith(5);
  });

  it('shows an open task with an empty box', () => {
    render(<TaskItem task={open} onToggle={() => {}} onDelete={() => {}} />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('shows a done task with a checked box', () => {
    render(<TaskItem task={finished} onToggle={() => {}} onDelete={() => {}} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});
// @tutorial:end exercise-4-task-item
