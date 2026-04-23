interface ChromeRuntime {
  sendMessage(message: object, responseCallback?: (response: unknown) => void): void;
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