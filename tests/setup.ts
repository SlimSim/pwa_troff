import { vi } from 'vitest';

/**
 * Happy-dom resolves the page URL to http://localhost:3000, so any fetch() in
 * app code (e.g. <t-icon> loading /assets/icons/*.svg) would open real network
 * connections from every test. Stub fetch to a local no-op so tests never do
 * network I/O. Tests that need controlled fetch responses override this via
 * their own vi.stubGlobal('fetch', ...) / globalThis.fetch assignment.
 */
globalThis.fetch = vi.fn(
  async (_input: string | URL | Request) =>
    new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor"><path d="M0 0h24v24H0z" fill="none"/></svg>`,
      { status: 200 }
    )
) as unknown as typeof fetch;