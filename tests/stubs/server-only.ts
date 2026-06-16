// Empty stub for the `server-only` package. The real module throws at
// import time when bundled for the client — useful in production, but
// it breaks node-based unit tests that legitimately want to import a
// server module. This stub is wired in `vitest.config.ts`.
export {};
