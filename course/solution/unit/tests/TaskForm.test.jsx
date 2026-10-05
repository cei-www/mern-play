// @tutorial:begin c2-form
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TaskForm from '../src/client/components/TaskForm.jsx';

describe('TaskForm', () => {
  it('sends the title and the priority when the form is sent', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<TaskForm onAdd={onAdd} />);

    await user.type(screen.getByLabelText('Title'), 'Buy milk');
    await user.selectOptions(screen.getByLabelText('Priority'), 'High');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith({ title: 'Buy milk', priority: 3 });
  });

  it('empties the title field after adding', async () => {
    const user = userEvent.setup();
    render(<TaskForm onAdd={() => {}} />);

    await user.type(screen.getByLabelText('Title'), 'Buy milk');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByLabelText('Title')).toHaveValue('');
  });

  it('does not add a title that is empty or only spaces', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<TaskForm onAdd={onAdd} />);

    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.type(screen.getByLabelText('Title'), '   ');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(onAdd).not.toHaveBeenCalled();
  });
});
// @tutorial:end c2-form
