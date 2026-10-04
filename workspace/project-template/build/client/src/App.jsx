import { useState } from 'react';
import { toQuery } from './api.js';
import GroupFilter from './components/GroupFilter.jsx';
import HistoryView from './components/HistoryView.jsx';
import SortBar from './components/SortBar.jsx';
import TaskForm from './components/TaskForm.jsx';
import TaskList from './components/TaskList.jsx';

const APP_TITLE = 'Task Manager';

export default function App() {
  const [view, setView] = useState('tasks');
  const [groupId, setGroupId] = useState(null);
  const [options, setOptions] = useState({ done: '', sort: '', order: 'asc' });
  // Bumped after every change so the lists load again.
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  // For example "?group_id=1&sort=priority". Empty while no filter or sort is chosen.
  const query = toQuery({ group_id: groupId, ...options });

  return (
    <main className="app">
      <h1>{APP_TITLE}</h1>
      <nav className="tabs">
        <button type="button" className={view === 'tasks' ? 'active' : ''} onClick={() => setView('tasks')}>
          Tasks
        </button>
        <button type="button" className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}>
          History
        </button>
      </nav>

      {view === 'tasks' ? (
        <>
          <TaskForm groupId={groupId} onCreated={reload} />
          <GroupFilter value={groupId} onChange={setGroupId} reloadKey={version} />
          <SortBar value={options} onChange={setOptions} />
          <TaskList query={query} reloadKey={version} onChanged={reload} />
        </>
      ) : (
        <HistoryView groupId={groupId} reloadKey={version} />
      )}
    </main>
  );
}
