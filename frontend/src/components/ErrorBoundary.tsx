import { Component, ErrorInfo, ReactNode } from 'react';
import { tokens, radius, fontSize } from '../theme/tokens';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

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
          padding: 24,
          margin: 24,
          border: `1px solid ${tokens.danger}`,
          borderRadius: radius.md,
          background: `rgba(239, 68, 68, 0.05)`,
          maxWidth: 600,
        }}>
          <h2 style={{ color: tokens.danger, margin: '0 0 8px', fontSize: fontSize.lg }}>
            Something went wrong
          </h2>
          <p style={{ color: tokens.textSecondary, margin: '0 0 12px', fontSize: fontSize.base }}>
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <details style={{ fontSize: fontSize.sm, color: tokens.textDim }}>
            <summary style={{ cursor: 'pointer', color: tokens.textSecondary }}>Error details</summary>
            <pre style={{
              marginTop: 8,
              whiteSpace: 'pre-wrap',
              background: tokens.surfaceInset,
              padding: 12,
              borderRadius: radius.sm,
              border: `1px solid ${tokens.borderDefault}`,
              color: tokens.textPrimary,
            }}>
              {this.state.error?.message}
            </pre>
          </details>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              marginTop: 12,
              padding: '10px 20px',
              background: tokens.danger,
              color: '#fff',
              border: 'none',
              borderRadius: radius.sm,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: fontSize.base,
              transition: 'background 0.15s ease',
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
