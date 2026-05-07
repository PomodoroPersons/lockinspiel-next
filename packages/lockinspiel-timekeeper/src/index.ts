import { Elysia, t } from "elysia";

import { jwtUse, openapiUse, otelTracer } from "lockinspiel-backend-common";


const app = new Elysia()
  .use(openapiUse)
  .use(otelTracer)
  .use(jwtUse)
  .get("/", ({ status }) => { return status(200, { up: true }) }, {
    detail: {
      summary: "Internal route that k8s uses to check for liveliness"
    },
    response: {
      200: t.Object({ up: t.Boolean() })
    }
  })
  .listen(Bun.env.LISTEN_PORT ?? 3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
