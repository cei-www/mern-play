const PRIORITY = { 1: 'low', 2: 'medium', 3: 'high' };

// One row of the task list. `onChanged` is called after the task was changed on the server.
export default function TaskItem({ task, onChanged }) {
  return (
    <li className={`task${task.done ? ' task-done' : ''}`}>
      {/* @tutorial:begin s3-3-done-checkbox */}
      {/* TODO (s3-3-done-checkbox): write your code here */}


      {/* @tutorial:end s3-3-done-checkbox */}
      <span className="task-title">{task.title}</span>
      {task.group_name && <span className="badge">{task.group_name}</span>}
      <span className={`priority priority-${task.priority}`}>{PRIORITY[task.priority]}</span>
      <span className="due">{task.due_date ? `due ${task.due_date}` : 'no due date'}</span>
      {/* @tutorial:begin s7-5-item-actions */}
      {/* TODO (s7-5-item-actions): write your code here */}


      {/* @tutorial:end s7-5-item-actions */}
    </li>
  );
}
