type MessageHandler = (data: any) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<MessageHandler>> = new Map();
  private reconnectInterval = 3000;
  private isConnecting = false;

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.isConnecting = true;
    const isDesktop = typeof window !== 'undefined' && (
      '__TAURI_INTERNALS__' in window ||
      '__TAURI__' in window ||
      window.location.hostname === 'tauri.localhost' ||
      window.location.protocol === 'tauri:'
    );
    const protocol = (window.location.protocol === 'https:' && !isDesktop) ? 'wss:' : 'ws:';
    const host = isDesktop ? '127.0.0.1:8000' : window.location.host;
    const url = `${protocol}//${host}/ws`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnecting = false;
        // Broadcast connection status
        this.emit('connection_status', { connected: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type) {
            this.emit(parsed.type, parsed.data);
          }
        } catch {
          // ignore non-json messages
        }
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        if (isDesktop) {
          this.emit('connection_status', { connected: false });
          setTimeout(() => this.connect(), this.reconnectInterval);
        } else {
          // In web mode, we stay in web cloud mode
          this.emit('connection_status', { connected: true });
        }
      };

      this.ws.onerror = () => {
        if (this.ws) {
          this.ws.close();
        }
      };
    } catch {
      this.isConnecting = false;
      if (!isDesktop) {
        this.emit('connection_status', { connected: true });
      } else {
        setTimeout(() => this.connect(), this.reconnectInterval);
      }
    }
  }

  on(eventType: string, handler: MessageHandler) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler);
    return () => this.off(eventType, handler);
  }

  off(eventType: string, handler: MessageHandler) {
    const set = this.listeners.get(eventType);
    if (set) {
      set.delete(handler);
    }
  }

  public emit(eventType: string, data: any) {
    const set = this.listeners.get(eventType);
    if (set) {
      set.forEach((handler) => {
        try {
          handler(data);
        } catch (e) {
          console.error(`Error in ws listener for ${eventType}`, e);
        }
      });
    }
  }
}

export const wsService = new WebSocketService();
