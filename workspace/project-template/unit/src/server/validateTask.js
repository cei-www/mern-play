/** Checks a task from a request body. Returns { value } or { error }. */
export function validateTask(body) {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (title.length < 1 || title.length > 100) return { error: 'title is required (1-100 characters)' };

  const priority = body.priority === undefined ? 2 : body.priority;
  if (![1, 2, 3].includes(priority)) return { error: 'priority must be 1, 2 or 3' };

  return { value: { title, priority } };
}
