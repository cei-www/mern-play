/** One row of the list: a checkbox, the title and a Delete button. */
export default function TaskItem({ task, onToggle, onDelete }) {
  return (
    <li className={task.done ? 'task done' : 'task'}>
      <input type="checkbox" checked={Boolean(task.done)} onChange={() => onToggle(task.id)} aria-label={`Mark "${task.title}" as done`} />
      <span>{task.title}</span>
      <button type="button" onClick={() => onDelete(task.id)}>
        Delete
      </button>
    </li>
  );
}
