/** One line that says how many tasks are done, for example "2 of 5 done". */
export default function Summary({ tasks }) {
  const done = tasks.filter((task) => task.done).length;
  return <p>{`${done} of ${tasks.length} done`}</p>;
}
