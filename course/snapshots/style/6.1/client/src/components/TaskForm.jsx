import { useState } from 'react';
import { cx } from '../cx.js';

// Form that adds a task. A new task goes into the group that is selected (or none).
export default function TaskForm({ groupId = null, onCreated }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState(2);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, priority, group_id: groupId }),
    });
    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }
    setTitle('');
    setError('');
    onCreated?.();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cx(
        // @tutorial:begin s2-1-form-spacing
        'mb-4',
        // @tutorial:end s2-1-form-spacing
        // @tutorial:begin s2-2-form-flex
        'flex flex-wrap gap-2',
        // @tutorial:end s2-2-form-flex
      )}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs doing?"
        aria-label="Title"
        className={cx(
          // @tutorial:begin s3-3-input-base
          'min-w-48 flex-1 rounded border border-slate-300 bg-white px-2 py-1',
          // @tutorial:end s3-3-input-base
          // @tutorial:begin s4-2-input-focus
          'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30',
          // @tutorial:end s4-2-input-focus
        )}
      />
      <select value={priority} onChange={(e) => setPriority(Number(e.target.value))} aria-label="Priority">
        <option value={1}>low</option>
        <option value={2}>medium</option>
        <option value={3}>high</option>
      </select>
      <button
        type="submit"
        disabled={!title.trim()}
        className={cx(
          // @tutorial:begin exercise-1-add-button
          // TODO (exercise-1-add-button): write your code here


          // @tutorial:end exercise-1-add-button
          // @tutorial:begin s4-2-add-disabled
          'disabled:cursor-not-allowed disabled:opacity-50',
          // @tutorial:end s4-2-add-disabled
        )}
      >
        Add
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
