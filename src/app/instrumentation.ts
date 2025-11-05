// Global SSR instrumentation to smooth out vendor bundles that expect `self` in Node
// Runs before the app on the server; safe no-op in browsers
export async function register() {
  try {
    if (typeof (globalThis as any).self === 'undefined') {
      (globalThis as any).self = globalThis as any;
    }
  } catch {
    // ignore
  }
}

