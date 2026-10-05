// Only these names may be used for sorting. The value ends up in SQL text, so it must never come straight from a request.
const COLUMNS = { created_at: 't.created_at', due_date: 't.due_date', priority: 't.priority', title: 't.title' };

/** Builds the ORDER BY clause of the task list, for example "ORDER BY t.priority DESC". Throws for anything not allowed. */
export function buildOrderBy(sort = 'created_at', order = 'asc') {
  if (!Object.hasOwn(COLUMNS, sort)) {
    throw new Error(`sort must be one of: ${Object.keys(COLUMNS).join(', ')}`);
  }
  if (order !== 'asc' && order !== 'desc') {
    throw new Error('order must be asc or desc');
  }
  return `ORDER BY ${COLUMNS[sort]} ${order.toUpperCase()}`;
}
