import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('EMBRYO Error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF3EB', fontFamily: '"DM Sans", sans-serif' }}>
          <div style={{ textAlign: 'center', color: '#5A5048', maxWidth: 400, padding: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>Something went wrong</div>
            <div style={{ fontSize: 13, color: '#7A6E65', marginBottom: 16 }}>{this.state.error?.message}</div>
            <button onClick={() => window.location.reload()} style={{ padding: '10px 24px', fontSize: 14, fontWeight: 500, backgroundColor: '#D83E7F', color: '#FAF3EB', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: '"DM Sans", sans-serif', minHeight: 44 }}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
