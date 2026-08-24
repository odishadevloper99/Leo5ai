import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { LeoLogoMark } from './LeoLogo';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Leo AI Uncaught Error caught by boundary]:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleResetState = () => {
    try {
      localStorage.removeItem('leo_chat_sessions');
    } catch (e) {}
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-[#0e1424] text-neutral-100 flex items-center justify-center p-4 font-sans z-50">
          <div className="max-w-md w-full bg-[#161f36] border border-neutral-800 rounded-3xl p-6 text-center space-y-5 shadow-2xl">
            <div className="w-14 h-14 mx-auto bg-purple-900/40 rounded-2xl flex items-center justify-center border border-purple-700/50">
              <LeoLogoMark className="w-9 h-9" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-white flex items-center justify-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span>Something went wrong</span>
              </h2>
              <p className="text-xs text-neutral-400 leading-relaxed">
                An unexpected exception was safely intercepted. You can reload the application or reset conversation cache.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 bg-black/40 border border-neutral-800 rounded-xl text-[11px] font-mono text-neutral-400 text-left max-h-24 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload App</span>
              </button>
              <button
                onClick={this.handleResetState}
                className="py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-neutral-300 rounded-xl text-xs font-semibold transition"
              >
                Reset Cache
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
