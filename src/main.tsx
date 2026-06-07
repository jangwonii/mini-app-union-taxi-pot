import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string }> {
  state = { error: '' };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : '앱 실행 중 오류가 발생했습니다.' };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="screen center">
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">!</span>
            <strong>앱을 표시하지 못했어요</strong>
            <p>{this.state.error}</p>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

const root = document.getElementById('root');

if (root) {
  ReactDOM.createRoot(root).render(
  <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
  </React.StrictMode>,
  );
}
