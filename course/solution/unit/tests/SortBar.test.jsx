// @tutorial:begin c4-sortbar
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SortBar from '../src/client/components/SortBar.jsx';

describe('SortBar', () => {
  it('shows the current choice', () => {
    render(<SortBar sort="priority" order="desc" onChange={() => {}} />);

    expect(screen.getByLabelText('Sort by')).toHaveValue('priority');
    expect(screen.getByLabelText('Order')).toHaveValue('desc');
  });

  it('reports the new sort and keeps the order', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SortBar sort="created_at" order="desc" onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText('Sort by'), 'title');

    expect(onChange).toHaveBeenCalledWith({ sort: 'title', order: 'desc' });
  });

  it('reports the new order and keeps the sort', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SortBar sort="priority" order="asc" onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText('Order'), 'desc');

    expect(onChange).toHaveBeenCalledWith({ sort: 'priority', order: 'desc' });
  });
});
// @tutorial:end c4-sortbar
