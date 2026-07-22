import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary that catches JavaScript errors anywhere in its child
 * component tree and displays a fallback UI instead of crashing the whole app.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          padding: '20px',
          margin: '20px',
          border: '1px solid #e74c3c',
          borderRadius: '6px',
          background: '#fdf0ef',
        }}>
          <h2 style={{ color: '#c0392b', margin: '0 0 8px' }}>Something went wrong</h2>
          <p style={{ color: '#666', margin: '0 0 12px' }}>
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <details style={{ fontSize: '0.85em', color: '#888' }}>
            <summary>Error details</summary>
            <pre style={{ marginTop: '8px', whiteSpace: 'pre-wrap' }}>
              {this.state.error?.message}
            </pre>
          </details>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              marginTop: '12px',
              padding: '8px 16px',
              background: '#c0392b',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}