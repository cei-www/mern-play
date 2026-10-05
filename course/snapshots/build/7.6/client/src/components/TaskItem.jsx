const PRIORITY = { 1: 'low', 2: 'medium', 3: 'high' };

// One row of the task list. `onChanged` is called after the task was changed on the server.
export default function TaskItem({ task, onChanged }) {
  return (
    <li className={`task${task.done ? ' task-done' : ''}`}>
      {/* @tutorial:begin s3-4-done-checkbox */}
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
      {/* @tutorial:end s3-4-done-checkbox */}
      <span className="task-title">{task.title}</span>
      {task.group_name && <span className="badge">{task.group_name}</span>}
      <span className={`priority priority-${task.priority}`}>{PRIORITY[task.priority]}</span>
      <span className="due">{task.due_date ? `due ${task.due_date}` : 'no due date'}</span>
      {/* @tutorial:begin s7-6-item-actions */}
      {/* TODO (s7-6-item-actions): write your code here */}


      {/* @tutorial:end s7-6-item-actions */}
    </li>
  );
}
