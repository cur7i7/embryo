import React from 'react';
import Map from './components/Map.jsx';
import { useConnectionData } from './hooks/useConnectionData.js';

export default function App() {
  const { connectionCounts, loading: connectionsLoading } = useConnectionData();

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Map connectionCounts={connectionCounts} />
    </div>
  );
}
