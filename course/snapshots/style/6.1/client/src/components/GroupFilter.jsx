import { useEffect, useState } from 'react';
import { cx } from '../cx.js';

// Buttons that choose a group. `value` is the selected group id, or null for "All".
export default function GroupFilter({ value, onChange, reloadKey = 0 }) {
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    fetch('/api/groups')
      .then((res) => res.json())
      .then(setGroups)
      .catch(() => setGroups([]));
  }, [reloadKey]);

  const choices = [{ id: null, name: 'All' }, ...groups];

  return (
    <div
      role="group"
      aria-label="Groups"
      className={cx(
        // @tutorial:begin s2-2-groups-flex
        'flex flex-wrap gap-2',
        // @tutorial:end s2-2-groups-flex
        // @tutorial:begin s5-2-groups-narrow
        'md:flex-col',
        // @tutorial:end s5-2-groups-narrow
      )}
    >
      {choices.map((group) => (
        <button
          key={group.id ?? 'all'}
          type="button"
          onClick={() => onChange(group.id)}
          className={cx(
            // @tutorial:begin s3-3-group-base
            'rounded border border-slate-300 bg-white px-3 py-1 text-left',
            // @tutorial:end s3-3-group-base
            // @tutorial:begin s4-1-group-states
            'hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:scale-95',
            value === group.id && 'border-brand-600 bg-brand-600 text-white hover:bg-brand-600',
            // @tutorial:end s4-1-group-states
          )}
        >
          {group.name}
          {group.task_count !== undefined && ` (${group.task_count})`}
        </button>
      ))}
    </div>
  );
}
