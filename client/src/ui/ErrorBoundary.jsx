import { Component } from 'react';
import { L } from '../i18n.js';

/** Last-resort guard: a render crash shows a reload card instead of a blank page. */
export class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[bongo] crashed', error, info?.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="loading">
        <div className="card center" style={{ padding: 24, maxWidth: 320 }}>
          <div style={{ fontSize: 42 }}>😵‍💫</div>
          <h3 style={{ margin: '8px 0' }}>{L('Kuna hitilafu imetokea', 'Something went wrong')}</h3>
          <p className="small muted">{L('Pakia upya kuendelea kucheza. Maendeleo yako yamehifadhiwa.', 'Reload to keep playing. Your progress is saved.')}</p>
          <button className="btn btn-green btn-block" onClick={() => location.reload()}>{L('Pakia upya', 'Reload')}</button>
        </div>
      </div>
    );
  }
}
