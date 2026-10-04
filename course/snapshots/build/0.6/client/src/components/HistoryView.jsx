import { useEffect, useState } from 'react';
import { toQuery } from '../api.js';

// The History tab: tasks completed in the last few days, newest first.
export default function HistoryView({ groupId = null, reloadKey = 0 }) {
  // @tutorial:begin s6-4-history-view
  const [days, setDays] = useState(7);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/tasks/history${toQuery({ days, group_id: groupId })}`)
      .then((res) => {
        if (!res.ok) throw new Error(`The server answered ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setTasks(data);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, [days, groupId, reloadKey]);

  return (
    <section>
      <label>
        Completed in the last
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={1}>1 day</option>
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      {tasks.length === 0 && !error && <p>Nothing completed in this period.</p>}
      <ul className="task-list">
        {tasks.map((task) => (
          <li key={task.id} className="task task-done">
            <span className="task-title">{task.title}</span>
            {task.group_name && <span className="badge">{task.group_name}</span>}
            <span className="due">done {task.completed_at}</span>
          </li>
        ))}
      </ul>
    </section>
  );
  // @tutorial:end s6-4-history-view
}
