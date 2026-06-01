import { t } from "elysia";

import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_INSTANCE_ID,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_NAMESPACE,
} from "@opentelemetry/semantic-conventions";
import { openapi } from "@elysiajs/openapi";
import { opentelemetry } from "@elysiajs/opentelemetry";
import { jwt } from "@elysiajs/jwt";

import { createRemoteJWKSet } from "jose";

export const UserClaims = t.Object({
  exp: t.Integer(),
  user_id: t.String(),
  username: t.String(),
  role: t.String(),
});

const jwksUrl = new URL(`${Bun.env.AUTH_SERVICE}/.well-known/jwks.json`);
const JWKS = createRemoteJWKSet(jwksUrl);

export const otelTracer = opentelemetry({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAMESPACE]: "lockinspiel-bun",
    [ATTR_SERVICE_NAME]: Bun.env.SERVICE_TYPE,
    [ATTR_SERVICE_INSTANCE_ID]: Bun.env.HOSTNAME ?? Bun.env.SERVICE_ID,
  }),
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
  instrumentations: [
    new FetchInstrumentation({
      propagateTraceHeaderCorsUrls: [jwksUrl.toString()],
    }),
  ],
  checkIfShouldTrace: (req) => new URL(req.url).pathname !== "/",
});

export const openapiUse = openapi({
  // references: fromTypes(),
  documentation: {
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  path: `/${Bun.env.SERVICE_TYPE}/openapi`,
  scalar: {
    url: `/${Bun.env.SERVICE_TYPE}/openapi/json`,
  },
});

export const jwtUse = jwt({
  name: "jwt",
  // @ts-expect-error
  secret: JWKS,
  schema: UserClaims,
});
