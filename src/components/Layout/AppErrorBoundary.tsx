import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, message: error.message || 'Unexpected error' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application crashed', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
    if (this.props.onReset) {
      this.props.onReset();
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-16">
        <div className="max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-red-500">Terjadi kesalahan</p>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">Halaman tidak bisa dimuat</h1>
          <p className="mt-3 text-sm text-gray-600">
            Mohon muat ulang halaman atau hubungi admin jika masalah berulang.
          </p>
          {this.state.message && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {this.state.message}
            </p>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
          >
            Muat ulang
          </button>
        </div>
      </div>
    );
  }
}
