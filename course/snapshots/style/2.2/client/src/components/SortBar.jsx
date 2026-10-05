import { cx } from '../cx.js';

// Choose which tasks to show and how to sort them. `value` is { done, sort, order }.
export default function SortBar({ value, onChange }) {
  const set = (key) => (event) => onChange({ ...value, [key]: event.target.value });

  return (
    <div
      className={cx(
        // @tutorial:begin s2-2-sort-flex
        // TODO (s2-2-sort-flex): write your code here


        // @tutorial:end s2-2-sort-flex
      )}
    >
      <label>
        Show{' '}
        <select value={value.done} onChange={set('done')}>
          <option value="">all</option>
          <option value="0">open</option>
          <option value="1">done</option>
        </select>
      </label>
      <label>
        Sort by{' '}
        <select value={value.sort} onChange={set('sort')}>
          <option value="">newest</option>
          <option value="due_date">due date</option>
          <option value="priority">priority</option>
          <option value="title">title</option>
        </select>
      </label>
      <label>
        Order{' '}
        <select value={value.order} onChange={set('order')}>
          <option value="asc">ascending</option>
          <option value="desc">descending</option>
        </select>
      </label>
    </div>
  );
}
