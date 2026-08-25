// Store global para gerenciar localização compartilhada
interface SharedLocationState {
  sharedContent: string | null;
  isFromShare: boolean;
}

class SharedLocationStore {
  private state: SharedLocationState = {
    sharedContent: null,
    isFromShare: false
  };

  private listeners: Set<(state: SharedLocationState) => void> = new Set();

  getState(): SharedLocationState {
    return { ...this.state };
  }

  setSharedContent(content: string | null) {
    console.log('📍 [SHARED STORE] Conteúdo compartilhado recebido:', content);
    this.state = {
      sharedContent: content,
      isFromShare: content !== null
    };
    this.notifyListeners();
  }

  clearSharedContent() {
    console.log('🗑️ [SHARED STORE] Limpando conteúdo compartilhado');
    this.state = {
      sharedContent: null,
      isFromShare: false
    };
    this.notifyListeners();
  }

  subscribe(listener: (state: SharedLocationState) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.getState()));
  }
}

export const sharedLocationStore = new SharedLocationStore();
