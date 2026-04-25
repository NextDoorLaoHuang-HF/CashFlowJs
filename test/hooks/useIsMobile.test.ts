import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

describe("useIsMobile", () => {
  let listeners: Array<(e: MediaQueryListEvent) => void> = [];
  let matchesValue = false;

  const mockMatchMedia = (matches: boolean) => {
    matchesValue = matches;
    return {
      matches,
      media: "",
      onchange: null,
      addListener: (cb: any) => listeners.push(cb),
      removeListener: (cb: any) => {
        listeners = listeners.filter((l) => l !== cb);
      },
      addEventListener: (type: string, cb: any) => listeners.push(cb),
      removeEventListener: (type: string, cb: any) => {
        listeners = listeners.filter((l) => l !== cb);
      },
      dispatchEvent: () => false
    } as MediaQueryList;
  };

  beforeEach(() => {
    listeners = [];
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => mockMatchMedia(query.includes("max-width: 767px") ? true : false)
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when media query matches mobile", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: () => mockMatchMedia(true)
    });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("returns false when media query does not match mobile", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: () => mockMatchMedia(false)
    });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("registers and unregisters listener on mount/unmount", () => {
    const queryMock = mockMatchMedia(false);
    const addSpy = vi.spyOn(queryMock, "addEventListener");
    const removeSpy = vi.spyOn(queryMock, "removeEventListener");

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: () => queryMock
    });

    const { unmount } = renderHook(() => useIsMobile());
    expect(addSpy).toHaveBeenCalledWith("change", expect.any(Function));

    unmount();
    expect(removeSpy).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("uses custom breakpoint", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => mockMatchMedia(query.includes("max-width: 1023px"))
    });
    const { result } = renderHook(() => useIsMobile(1024));
    expect(result.current).toBe(true);
  });
});
