// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import React from 'react';
import { BASE_URL } from '../lib/baseConfig';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Intentionally keep this quiet in production — just enough to investigate.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-red-200 dark:border-red-800">
          <h1 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">
            Something went wrong
          </h1>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
            An unexpected error occurred while rendering this page. You can try reloading,
            or go back to the dashboard.
          </p>
          <pre className="text-xs bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded p-3 mb-4 overflow-auto max-h-48 whitespace-pre-wrap break-words">
            {this.state.error.message}
          </pre>
          <div className="flex gap-2">
            <button
              onClick={() => { this.reset(); window.location.reload(); }}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Reload
            </button>
            <button
              onClick={() => { this.reset(); window.location.href = BASE_URL; }}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}
