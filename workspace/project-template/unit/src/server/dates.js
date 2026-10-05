const day = (date) => new Date(date).toISOString().slice(0, 10);

/** Text for a due date: "No due date", "Due today", "Overdue (2026-01-05)" or "Due 2026-12-31". */
export function formatDueDate(dueDate, now = new Date()) {
  if (!dueDate) return 'No due date';
  const due = day(dueDate);
  const today = day(now);
  if (due === today) return 'Due today';
  if (due < today) return `Overdue (${due})`;
  return `Due ${due}`;
}

/** A task is overdue when it is not done and its due date is before today. */
export function isOverdue(task, now = new Date()) {
  if (!task.due_date || task.done) return false;
  return day(task.due_date) < day(now);
}
