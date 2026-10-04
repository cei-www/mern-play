import { useEffect, useState } from 'react';

// Buttons that choose a group. `value` is the selected group id, or null for "All".
export default function GroupFilter({ value, onChange, reloadKey = 0 }) {
  // @tutorial:begin s4-5-group-filter
  const [groups, setGroups] = useState([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    fetch('/api/groups')
      .then((res) => res.json())
      .then(setGroups)
      .catch(() => setGroups([]));
  }, [reloadKey, version]);

  async function addGroup() {
    const name = window.prompt('Name of the new group');
    if (!name) return;
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) window.alert((await res.json()).error);
    setVersion((v) => v + 1);
  }

  return (
    <div className="groups" role="group" aria-label="Groups">
      <button type="button" className={value === null ? 'active' : ''} onClick={() => onChange(null)}>
        All
      </button>
      {groups.map((group) => (
        <button
          key={group.id}
          type="button"
          className={value === group.id ? 'active' : ''}
          style={{ borderColor: group.color }}
          onClick={() => onChange(group.id)}
        >
          {group.name} ({group.task_count})
        </button>
      ))}
      <button type="button" onClick={addGroup}>
        + Group
      </button>
    </div>
  );
  // @tutorial:end s4-5-group-filter
}
