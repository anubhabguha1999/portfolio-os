import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Short name shown in the fallback, e.g. "Inspector". */
  area?: string;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  compact?: boolean;
  onReset?: () => void;
  resetKeys?: unknown[];
}

interface State {
  error: Error | null;
}

/** Isolates failures so one broken panel never takes down the application. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[ErrorBoundary${this.props.area ? `:${this.props.area}` : ''}]`, error, info.componentStack);
  }

  componentDidUpdate(prev: Props): void {
    if (this.state.error && prev.resetKeys && this.props.resetKeys && prev.resetKeys.some((k, i) => !Object.is(k, this.props.resetKeys?.[i]))) {
      this.reset();
    }
  }

  reset = () => {
    this.props.onReset?.();
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div role="alert" className={this.props.compact ? 'm-3 rounded-xl border border-danger/30 bg-danger/5 p-3' : 'mx-auto my-16 max-w-md rounded-2xl border border-danger/30 bg-danger/5 p-6 text-center'}>
        <AlertTriangle className={this.props.compact ? 'mb-2 size-4 text-danger' : 'mx-auto mb-3 size-6 text-danger'} aria-hidden="true" />
        <p className="text-[13px] font-semibold">{this.props.area ? `${this.props.area} hit a problem` : 'Something went wrong'}</p>
        <p className="mt-1 break-words text-[12px] text-fg-muted">{error.message}</p>
        <p className="mt-1 text-[12px] text-fg-subtle">Your work is saved locally and is not affected.</p>
        <button onClick={this.reset} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-elevated px-3 py-1.5 text-[12px] font-medium hover:bg-hover">
          <RotateCcw className="size-3.5" /> Try again
        </button>
      </div>
    );
  }
}
