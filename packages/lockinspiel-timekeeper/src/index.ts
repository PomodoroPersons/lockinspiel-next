import { Elysia } from "elysia";

import { jwtUse, openapiUse, otelTracer } from "lockinspiel-backend-common";


const app = new Elysia()
  .use(openapiUse)
  .use(otelTracer)
  .use(jwtUse)
  .get("/", ({ status }) => { return status(200, 'up') })
  .listen(Bun.env.LISTEN_PORT ?? 3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
