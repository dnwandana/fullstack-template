describe("jsdom setup", () => {
  it("provides matchMedia", () => {
    const result = window.matchMedia("(min-width: 768px)")
    expect(result.matches).toBe(false)
    expect(result.media).toBe("(min-width: 768px)")
    expect(typeof result.addEventListener).toBe("function")
  })

  it("provides ResizeObserver and pointer helpers", () => {
    expect(typeof ResizeObserver).toBe("function")
    expect(typeof Element.prototype.scrollIntoView).toBe("function")
    expect(typeof Element.prototype.hasPointerCapture).toBe("function")
  })
})
