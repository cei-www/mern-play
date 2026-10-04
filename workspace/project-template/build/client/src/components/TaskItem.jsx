const PRIORITY = { 1: 'low', 2: 'medium', 3: 'high' };

// One row of the task list. `onChanged` is called after the task was changed on the server.
export default function TaskItem({ task, onChanged }) {
  return (
    <li className={`task${task.done ? ' task-done' : ''}`}>
      {/* @tutorial:begin s3-3-done-checkbox */}
      <input
        type="checkbox"
        checked={task.done === 1}
        aria-label={`Mark "${task.title}" as done`}
        onChange={(event) =>
          fetch(`/api/tasks/${task.id}/done`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ done: event.target.checked }),
          }).then(() => onChanged?.())
        }
      />
      {/* @tutorial:end s3-3-done-checkbox */}
      <span className="task-title">{task.title}</span>
      {task.group_name && <span className="badge">{task.group_name}</span>}
      <span className={`priority priority-${task.priority}`}>{PRIORITY[task.priority]}</span>
      <span className="due">{task.due_date ? `due ${task.due_date}` : 'no due date'}</span>
      {/* @tutorial:begin s7-5-item-actions */}
      <button
        type="button"
        onClick={async () => {
          const title = window.prompt('New title', task.title);
          if (!title) return;
          const res = await fetch(`/api/tasks/${task.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, priority: task.priority, due_date: task.due_date, group_id: task.group_id }),
          });
          if (!res.ok) window.alert((await res.json()).error);
          onChanged?.();
        }}
      >
        Edit
      </button>
      <button
        type="button"
        onClick={async () => {
          if (!window.confirm(`Delete "${task.title}"?`)) return;
          await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
          onChanged?.();
        }}
      >
        Delete
      </button>
      {/* @tutorial:end s7-5-item-actions */}
    </li>
  );
}
