import { Component, type ReactNode } from 'react';

export class LoadBoundary extends Component<{ children: ReactNode; optional?: boolean }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.optional) return null;
    return <main className="route-loading"><h1>Chưa mở được nội dung</h1><p>Kết nối có thể bị gián đoạn. Bạn có thể tải lại trang để tiếp tục.</p><button type="button" onClick={() => window.location.reload()}>Tải lại trang</button><a href="/">Về SPOFY</a></main>;
  }
}
