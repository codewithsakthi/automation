import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // This is where we would log to Sentry
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle size={40} />
          </div>
          
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground">
            Something went wrong
          </h1>
          
          <p className="mb-8 max-w-md text-muted-foreground">
            We've encountered an unexpected error. Don't worry, our team has been notified (via Sentry) and we're on it.
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 rounded-[1.25rem] bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all hover:scale-105 active:scale-95"
            >
              <RefreshCw size={18} />
              Try Again
            </button>
            
            <a
              href="/"
              className="flex items-center gap-2 rounded-[1.25rem] border border-border bg-card px-6 py-3 font-semibold text-foreground transition-all hover:bg-muted"
            >
              <Home size={18} />
              Return Home
            </a>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="mt-12 w-full max-w-2xl overflow-auto rounded-xl border border-border/50 bg-muted/30 p-4 text-left font-mono text-xs text-muted-foreground/80">
              <p className="mb-2 font-bold text-destructive">Dev Info:</p>
              {this.state.error?.toString()}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
