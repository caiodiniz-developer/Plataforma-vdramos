// APIs de navegador que o jsdom não implementa e os componentes Radix usam.
// Só se aplica aos testes de tela (ambiente jsdom); nos demais não há `window`.
if (typeof window !== 'undefined') {
  class ObservadorVazio {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver ??= ObservadorVazio as unknown as typeof ResizeObserver
  window.matchMedia ??= ((consulta: string) => ({
    matches: false,
    media: consulta,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  Element.prototype.scrollIntoView ??= () => {}
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.releasePointerCapture ??= () => {}
  document.elementFromPoint ??= () => null
}
