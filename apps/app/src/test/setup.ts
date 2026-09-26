// jsdom has no matchMedia, ResizeObserver or pointer capture. reka-ui reads
// them on mount.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// A test file with `@vitest-environment node` has no `window`. Skip the stubs there.
if (typeof window !== "undefined") {
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList
  }

  if (typeof globalThis.ResizeObserver !== "function") {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
  }

  if (typeof Element.prototype.scrollIntoView !== "function") {
    Element.prototype.scrollIntoView = () => {}
  }

  if (typeof Element.prototype.hasPointerCapture !== "function") {
    Element.prototype.hasPointerCapture = () => false
    Element.prototype.releasePointerCapture = () => {}
  }
}
