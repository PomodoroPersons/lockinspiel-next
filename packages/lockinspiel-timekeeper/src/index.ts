import { Elysia, t } from "elysia";
import { openapi, fromTypes } from '@elysiajs/openapi'
import { opentelemetry } from '@elysiajs/opentelemetry'
import { jwt } from "@elysiajs/jwt";

import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_INSTANCE_ID, ATTR_SERVICE_NAME, ATTR_SERVICE_NAMESPACE } from "@opentelemetry/semantic-conventions";
import { registerInstrumentations } from "@opentelemetry/instrumentation";

import { createRemoteJWKSet } from "jose";

const UserClaims = t.Object({
  exp: t.Integer(),
  user_id: t.String(),
  username: t.String(),
  role: t.String()
});

const jwksUrl = new URL(`${Bun.env.AUTH_SERVICE}/.well-known/jwks.json`);
const JWKS = createRemoteJWKSet(jwksUrl);

const otelTracer = opentelemetry({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAMESPACE]: 'lockinspiel-bun',
    [ATTR_SERVICE_NAME]: Bun.env.SERVICE_TYPE,
    [ATTR_SERVICE_INSTANCE_ID]: Bun.env.HOSTNAME ?? Bun.env.SERVICE_ID
  }),
  spanProcessors: [
    new BatchSpanProcessor(
      new OTLPTraceExporter()
    )
  ],
});

registerInstrumentations({
  instrumentations: [new FetchInstrumentation({
    propagateTraceHeaderCorsUrls: [
      jwksUrl.toString()
    ]
  })],
});

const app = new Elysia()
  .use(openapi({
    references: fromTypes(),
    documentation: {
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      }
    },
    path: "/timekeeper/openapi",
    scalar: {
      url: "/timekeeper/openapi/json"
    }
    // specPath: "/timekeeper/openapi.json"
  }))
  .use(otelTracer)
  .use(jwt({
    name: "jwt",
    // @ts-expect-error
    secret: JWKS,
    schema: UserClaims
  }))
  .get("/", ({ status }) => { return status(200, 'up') })
  .listen(Bun.env.LISTEN_PORT ?? 3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
