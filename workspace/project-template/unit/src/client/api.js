/** Loads the task list from the API. Throws when the server answers with an error. */
export async function fetchTasks() {
  const response = await fetch('/api/tasks');
  if (!response.ok) throw new Error(`Could not load tasks (${response.status})`);
  return response.json();
}
