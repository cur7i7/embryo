import React from 'react';

const CONTAINER_STYLE = {
  width: '100vw',
  height: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#FAF3EB',
  fontFamily: '"DM Sans", sans-serif',
};

const INNER_STYLE = {
  textAlign: 'center',
  color: '#3E3530',
  maxWidth: 400,
  padding: 24,
};

const HEADING_STYLE = {
  fontSize: 18,
  fontWeight: 600,
  marginBottom: 8,
  color: '#3E3530',
};

const BODY_STYLE = {
  fontSize: 14,
  color: '#7A6E65',
  marginBottom: 24,
  lineHeight: 1.5,
};

const BUTTON_STYLE = {
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
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // TODO (P2): integrate error reporting service
    console.error('EMBRYO ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={CONTAINER_STYLE}>
          <div style={INNER_STYLE}>
            <div style={HEADING_STYLE}>Something went wrong</div>
            <div style={BODY_STYLE}>
              An unexpected error occurred. Please reload the page to try again.
            </div>
            <button
              onClick={() => window.location.reload()}
              style={BUTTON_STYLE}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
