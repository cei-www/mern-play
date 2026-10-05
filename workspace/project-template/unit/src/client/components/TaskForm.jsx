import { useState } from 'react';

/** The form that adds a task. Calls onAdd({ title, priority }) and clears the field. */
export default function TaskForm({ onAdd }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState(2);

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed === '') return;
    onAdd({ title: trimmed, priority });
    setTitle('');
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Title
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label>
        Priority
        <select value={priority} onChange={(event) => setPriority(Number(event.target.value))}>
          <option value={1}>Low</option>
          <option value={2}>Medium</option>
          <option value={3}>High</option>
        </select>
      </label>
      <button type="submit">Add</button>
    </form>
  );
}
