'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <tr>
          <td colSpan={20} className="px-4 py-6 text-center text-sm text-destructive">
            A row failed to render — {this.state.message}
          </td>
        </tr>
      );
    }
    return this.props.children;
  }
}
