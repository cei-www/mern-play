import { useEffect, useState } from 'react';
import { fetchTasks } from '../api.js';
import TaskItem from './TaskItem.jsx';

/** Loads the tasks and shows them: "Loading...", an error message, an empty message or the list. */
export default function TaskList() {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTasks()
      .then(setTasks)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (tasks === null) return <p>Loading...</p>;
  if (tasks.length === 0) return <p>No tasks yet. Add your first one!</p>;
  return (
    <ul>
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} onToggle={() => {}} onDelete={() => {}} />
      ))}
    </ul>
  );
}
