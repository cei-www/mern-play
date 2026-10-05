import { useState } from 'react';
import { toQuery } from './api.js';
import { cx } from './cx.js';
import GroupFilter from './components/GroupFilter.jsx';
import HistoryView from './components/HistoryView.jsx';
import SortBar from './components/SortBar.jsx';
import TaskForm from './components/TaskForm.jsx';
import TaskList from './components/TaskList.jsx';

export default function App() {
  const [view, setView] = useState('tasks');
  const [groupId, setGroupId] = useState(null);
  const [options, setOptions] = useState({ done: '', sort: '', order: 'asc' });
  // Bumped after every change so the lists load again.
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
  const query = toQuery({ group_id: groupId, ...options });

  return (
    <div
      className={cx(
        // @tutorial:begin s3-2-page-bg
        'min-h-screen bg-slate-50',
        // @tutorial:end s3-2-page-bg
        // @tutorial:begin s5-3-dark-page
        // TODO (s5-3-dark-page): write your code here


        // @tutorial:end s5-3-dark-page
      )}
    >
      <main
        className={cx(
          // @tutorial:begin s2-1-page-spacing
          'p-3',
          // @tutorial:end s2-1-page-spacing
          // @tutorial:begin s2-4-container
          'mx-auto max-w-4xl',
          // @tutorial:end s2-4-container
          // @tutorial:begin s5-1-page-sm
          // TODO (s5-1-page-sm): write your code here


          // @tutorial:end s5-1-page-sm
        )}
      >
        <header
          className={cx(
            // @tutorial:begin s2-2-header-flex
            'mb-4 flex items-center justify-between',
            // @tutorial:end s2-2-header-flex
          )}
        >
          <h1
            className={cx(
              // @tutorial:begin s1-4-title
              'text-2xl font-bold',
              // @tutorial:end s1-4-title
              // @tutorial:begin s3-1-title-type
              'tracking-tight text-slate-900',
              // @tutorial:end s3-1-title-type
              // @tutorial:begin s3-4-title-brand
              // TODO (s3-4-title-brand): write your code here


              // @tutorial:end s3-4-title-brand
              // @tutorial:begin s5-1-title-sm
              // TODO (s5-1-title-sm): write your code here


              // @tutorial:end s5-1-title-sm
              // @tutorial:begin s5-3-dark-title
              // TODO (s5-3-dark-title): write your code here


              // @tutorial:end s5-3-dark-title
            )}
          >
            Task Manager
          </h1>
          <nav
            className={cx(
              // @tutorial:begin s2-2-nav-flex
              'flex gap-2',
              // @tutorial:end s2-2-nav-flex
            )}
          >
            {['tasks', 'history'].map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setView(name)}
                className={cx(
                  // @tutorial:begin s3-3-tab-base
                  // TODO (s3-3-tab-base): write your code here


                  // @tutorial:end s3-3-tab-base
                  // @tutorial:begin s4-1-tab-states
                  // TODO (s4-1-tab-states): write your code here


                  // @tutorial:end s4-1-tab-states
                )}
              >
                {name}
              </button>
            ))}
          </nav>
        </header>

        {view === 'tasks' ? (
          <div
            className={cx(
              // @tutorial:begin s2-3-layout-grid
              'grid grid-cols-[14rem_1fr] gap-6',
              // @tutorial:end s2-3-layout-grid
              // @tutorial:begin s5-2-layout-narrow
              // TODO (s5-2-layout-narrow): write your code here


              // @tutorial:end s5-2-layout-narrow
            )}
          >
            <aside>
              <GroupFilter value={groupId} onChange={setGroupId} reloadKey={version} />
            </aside>
            <section>
              <TaskForm groupId={groupId} onCreated={reload} />
              <SortBar value={options} onChange={setOptions} />
              <TaskList query={query} reloadKey={version} onChanged={reload} />
            </section>
          </div>
        ) : (
          <HistoryView groupId={groupId} reloadKey={version} />
        )}
      </main>
    </div>
  );
}
