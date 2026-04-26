interface ChromeRuntime {
  sendMessage(message: object, responseCallback?: (response: unknown) => void): void;
  onMessage: {
    addListener(callback: (message: any) => void): void;
    removeListener(callback: (message: any) => void): void;
  };
}

interface Chrome {
  runtime: ChromeRuntime;
}

declare global {
  interface Window {
    chrome?: Chrome;
  }
}

export {}