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
        // TODO (s2-2-groups-flex): write your code here


        // @tutorial:end s2-2-groups-flex
        // @tutorial:begin s5-2-groups-narrow
        // TODO (s5-2-groups-narrow): write your code here


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
            // TODO (s3-3-group-base): write your code here


            // @tutorial:end s3-3-group-base
            // @tutorial:begin s4-1-group-states
            // TODO (s4-1-group-states): write your code here


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
