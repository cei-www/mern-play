import { useEffect, useState } from 'react';

export default function App() {
  const [status, setStatus] = useState('checking...');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('API is not reachable'));
  }, []);

  return (
    <main>
      <h1>Task Manager</h1>
      <p>API status: {status}</p>
    </main>
  );
}
