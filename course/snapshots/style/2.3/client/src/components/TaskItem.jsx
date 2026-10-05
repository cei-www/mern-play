import { cx } from '../cx.js';

const PRIORITY = { 1: 'low', 2: 'medium', 3: 'high' };

// One row of the task list. `onChanged` is called after the task was changed on the server.
export default function TaskItem({ task, onChanged }) {
  async function setDone(done) {
    await fetch(`/api/tasks/${task.id}/done`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done }),
    });
    onChanged?.();
  }

  async function remove() {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
    onChanged?.();
  }

  return (
    <li
      className={cx(
        // @tutorial:begin s2-1-row-spacing
        'mb-2 p-3',
        // @tutorial:end s2-1-row-spacing
        // @tutorial:begin s2-2-row-flex
        'flex flex-wrap items-center gap-3',
        // @tutorial:end s2-2-row-flex
        // @tutorial:begin s3-2-row-card
        // TODO (s3-2-row-card): write your code here


        // @tutorial:end s3-2-row-card
        // @tutorial:begin s4-3-row-group
        // TODO (s4-3-row-group): write your code here


        // @tutorial:end s4-3-row-group
        // @tutorial:begin s5-3-dark-row
        // TODO (s5-3-dark-row): write your code here


        // @tutorial:end s5-3-dark-row
        // @tutorial:begin exercise-3-done-row
        // TODO (exercise-3-done-row): write your code here


        // @tutorial:end exercise-3-done-row
      )}
    >
      <input
        type="checkbox"
        checked={task.done === 1}
        onChange={(event) => setDone(event.target.checked)}
        aria-label={`Mark "${task.title}" as done`}
        className={cx(
          // @tutorial:begin s4-3-checkbox
          // TODO (s4-3-checkbox): write your code here


          // @tutorial:end s4-3-checkbox
        )}
      />
      <span
        className={cx(
          // @tutorial:begin s3-1-title-weight
          // TODO (s3-1-title-weight): write your code here


          // @tutorial:end s3-1-title-weight
          // @tutorial:begin s4-3-title-peer
          // TODO (s4-3-title-peer): write your code here


          // @tutorial:end s4-3-title-peer
        )}
      >
        {task.title}
      </span>
      {task.group_name && (
        <span
          className={cx(
            // @tutorial:begin s3-5-group-badge
            // TODO (s3-5-group-badge): write your code here


            // @tutorial:end s3-5-group-badge
          )}
        >
          {task.group_name}
        </span>
      )}
      <span
        className={cx(
          // @tutorial:begin s3-5-priority-base
          // TODO (s3-5-priority-base): write your code here


          // @tutorial:end s3-5-priority-base
          // @tutorial:begin exercise-2-priority-colors
          // TODO (exercise-2-priority-colors): write your code here


          // @tutorial:end exercise-2-priority-colors
        )}
      >
        {PRIORITY[task.priority]}
      </span>
      <span
        className={cx(
          // @tutorial:begin s3-1-due-type
          // TODO (s3-1-due-type): write your code here


          // @tutorial:end s3-1-due-type
        )}
      >
        {task.due_date ? `due ${task.due_date}` : 'no due date'}
      </span>
      <button
        type="button"
        onClick={remove}
        className={cx(
          // @tutorial:begin s4-3-delete-hover
          // TODO (s4-3-delete-hover): write your code here


          // @tutorial:end s4-3-delete-hover
        )}
      >
        Delete
      </button>
    </li>
  );
}
