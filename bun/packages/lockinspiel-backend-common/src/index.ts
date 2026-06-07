import { t } from "elysia";

import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
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

import { importX509 } from "jose";

export const UserClaims = t.Object({
  identity: t.Union([
    t.Object({
      default: t.Object({
        email: t.String()
      })
    })
  ]),
  sid: t.String(),
  sub: t.String(),
});

const JWT_ALG = 'ES256';
const x509_cert = await Bun.file(Bun.env['AUTH_CERTIFICATE_PATH'] ?? '').text();
console.log(x509_cert);
const JWT_SECRET = await importX509(x509_cert, JWT_ALG);
console.log(JWT_SECRET)

export const otelTracer = opentelemetry({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAMESPACE]: "lockinspiel-bun",
    [ATTR_SERVICE_NAME]: Bun.env.SERVICE_TYPE,
    [ATTR_SERVICE_INSTANCE_ID]: Bun.env.HOSTNAME ?? Bun.env.SERVICE_ID,
  }),
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
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
  secret: JWT_SECRET,
  schema: UserClaims,
  alg: JWT_ALG
});
