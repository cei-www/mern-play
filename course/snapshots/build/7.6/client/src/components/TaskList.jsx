import { useEffect, useState } from 'react';
import TaskItem from './TaskItem.jsx';

// Shows the tasks from GET /api/tasks. `query` is a string such as "?done=0" (empty by default).
export default function TaskList({ query = '', reloadKey = 0, onChanged }) {
  // @tutorial:begin s1-8-task-list
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tasks${query}`)
      .then((res) => {
        if (!res.ok) throw new Error(`The server answered ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setTasks(data);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [query, reloadKey]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p role="alert">Could not load the tasks: {error}</p>;
  if (tasks.length === 0) return <p>No tasks yet.</p>;

  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} onChanged={onChanged} />
      ))}
    </ul>
  );
  // @tutorial:end s1-8-task-list
}
