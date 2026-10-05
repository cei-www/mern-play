// Joins class names and leaves out anything that is not a string, so a condition can be written inline:
//   cx('p-3', task.done && 'opacity-60')
export const cx = (...parts) => parts.filter(Boolean).join(' ');
