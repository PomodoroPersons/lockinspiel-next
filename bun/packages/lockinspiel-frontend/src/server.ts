import { AngularAppEngine, createRequestHandler } from '@angular/ssr';
import { join } from 'node:path';
let serveStatic;
if (typeof Bun !== 'undefined') {
  serveStatic = (await import('hono/bun')).serveStatic;
  // Use bun-specific features
}
import { Hono } from 'hono';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = new Hono();
const angularApp = new AngularAppEngine();

/**
 * Serve static files from /browser
 */
if (serveStatic) {
  app.use(
    '*',
    serveStatic({
      root: browserDistFolder,
      onFound: (_path, c) => {
        c.header('Cache-Control', `public, immutable, max-age=31536000`);
      },
    }),
  );
}

/**
 * Handle all other requests by rendering the Angular application.
 */
app.all('*', (c, next) =>
  angularApp
    .handle(c.req.raw)
    .then(async (response) => {
      return response ? response : await next();
    })
    .catch(next),
);

const port = process.env['LISTEN_PORT'] || 4000;
export default {
  port,
  fetch: app.fetch,
};
export const reqHandler = createRequestHandler((req: Request) => app.fetch(req));
// export const reqHandler = app.fetch;
// export default {
//   port,
//   fetch: app.fetch,
// }
