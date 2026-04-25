import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

// Polyfill crypto.randomUUID for jsdom / test consistency
let _uuidCounter = 0;
Object.defineProperty(globalThis, "crypto", {
  writable: true,
  value: {
    ...(globalThis.crypto ?? {}),
    randomUUID: () => `mock-uuid-${++_uuidCounter}-${Date.now()}`
  }
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => {
    const maxMatch = /max-width:\s*(\d+)px/.exec(query);
    const minMatch = /min-width:\s*(\d+)px/.exec(query);
    const width = window.innerWidth;
    const matchesMax = maxMatch ? width <= Number(maxMatch[1]) : true;
    const matchesMin = minMatch ? width >= Number(minMatch[1]) : true;
    const matches = matchesMax && matchesMin;

    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false
    };
  }
});
