// STUB (Card 2): the sandbox worker that runs instrumented code and posts back a TraceResult.
self.onmessage = () => {
  self.postMessage({
    items: [],
    infinite: false,
    durationMs: 0,
    error: "Not implemented: tracer worker (Card 2)",
  });
};

export {};
