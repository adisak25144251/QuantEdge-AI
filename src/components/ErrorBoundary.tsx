import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    const message = error?.message || '';
    const isDynamicImportFailure =
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('Importing a module script failed') ||
      message.includes('ChunkLoadError');

    if (isDynamicImportFailure && typeof window !== 'undefined') {
      const reloadKey = 'quantedge:dynamic-import-reload';
      if (window.sessionStorage.getItem(reloadKey) !== '1') {
        window.sessionStorage.setItem(reloadKey, '1');
        window.location.reload();
        return;
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      const message = this.state.error?.message || '';
      const isDynamicImportFailure =
        message.includes('Failed to fetch dynamically imported module') ||
        message.includes('Importing a module script failed') ||
        message.includes('ChunkLoadError');

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#050014] text-white p-4">
          <div className="bg-[#111827] p-8 rounded-2xl border border-rose-500/30 max-w-lg w-full shadow-[0_0_30px_rgba(244,63,94,0.1)]">
            <h2 className="text-2xl font-bold text-rose-400 mb-4">
              {isDynamicImportFailure ? 'กำลังโหลดโมดูลใหม่ไม่สำเร็จ' : 'Oops, something went wrong.'}
            </h2>
            <p className="text-slate-300 mb-6">
              {isDynamicImportFailure
                ? 'ระบบพบไฟล์โมดูลหน้าเว็บรุ่นเก่าหรือโหลดไม่ครบ กรุณากด Reload อีกครั้งเพื่อดึงเวอร์ชันล่าสุด'
                : 'The application encountered an unexpected error. Our systems have logged the issue.'}
            </p>
            <div className="bg-black/50 p-4 rounded-lg overflow-auto text-sm font-mono text-rose-200/70 mb-6 max-h-40">
              {this.state.error?.message}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-gradient-to-r from-rose-500 to-fuchsia-500 rounded-xl font-bold hover:shadow-[0_0_20px_rgba(244,63,94,0.4)] transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
