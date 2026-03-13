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
            <button
              onClick={() => window.location.reload()}
              onFocus={(e) => { if (e.target.matches(':focus-visible')) e.target.style.boxShadow = '0 0 0 2px #B8336A'; }}
              onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
              style={{
                marginTop: 16,
                padding: '10px 24px',
                fontSize: 14,
                fontFamily: '"DM Sans", sans-serif',
                fontWeight: 600,
                color: '#3E3530',
                backgroundColor: 'rgba(250, 243, 235, 0.95)',
                border: '1px solid rgba(168, 144, 128, 0.4)',
                borderRadius: 20,
                cursor: 'pointer',
                minHeight: 44,
              }}
            >Try again</button>
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
