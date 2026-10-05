/** Two dropdowns to choose how the list is sorted. Calls onChange({ sort, order }) with the new choice. */
export default function SortBar({ sort, order, onChange }) {
  return (
    <div>
      <label>
        Sort by
        <select value={sort} onChange={(event) => onChange({ sort: event.target.value, order })}>
          <option value="created_at">Created</option>
          <option value="due_date">Due date</option>
          <option value="priority">Priority</option>
          <option value="title">Title</option>
        </select>
      </label>
      <label>
        Order
        <select value={order} onChange={(event) => onChange({ sort, order: event.target.value })}>
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </label>
    </div>
  );
}
