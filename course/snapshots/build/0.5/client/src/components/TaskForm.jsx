import { useState } from 'react';

// Form that adds a task. A new task goes into the group that is selected (or none).
export default function TaskForm({ groupId = null, onCreated }) {
  // @tutorial:begin s2-4-task-form
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState(2);
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, priority, due_date: dueDate || null, group_id: groupId }),
    });
    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }
    setTitle('');
    setDueDate('');
    setError('');
    onCreated?.();
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" aria-label="Title" />
      <select value={priority} onChange={(e) => setPriority(Number(e.target.value))} aria-label="Priority">
        <option value={1}>low</option>
        <option value={2}>medium</option>
        <option value={3}>high</option>
      </select>
      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label="Due date" />
      <button type="submit">Add</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
  // @tutorial:end s2-4-task-form
}
