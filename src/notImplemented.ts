// Scaffold helper: stubs call this so a missing implementation fails loudly, never silently.
export function notImplemented(what: string, card: string): never {
  throw new Error(`Not implemented: ${what} (${card})`);
}
