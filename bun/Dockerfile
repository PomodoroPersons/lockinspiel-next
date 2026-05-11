FROM oven/bun:alpine AS build

WORKDIR /app

# Cache packages installation
COPY package.json package.json
COPY ./packages/lockinspiel-backend-common/package.json ./packages/lockinspiel-backend-common/package.json
COPY bun.lock bun.lock
ARG PACKAGE
COPY ./packages/$PACKAGE/package.json ./packages/$PACKAGE/package.json

RUN bun install

COPY ./packages/$PACKAGE/src ./packages/$PACKAGE/src
COPY ./packages/$PACKAGE/drizzle ./packages/$PACKAGE/drizzle
COPY ./packages/lockinspiel-backend-common/src ./packages/lockinspiel-backend-common/src
COPY ./packages/lockinspiel-backend-common/tsconfig.json ./packages/lockinspiel-backend-common/tsconfig.json

ENV NODE_ENV=production

RUN bun build \
	--compile \
	--minify-whitespace \
	--minify-syntax \
	--outfile server \
	./packages/$PACKAGE/src/index.ts

FROM oven/bun:alpine

WORKDIR /app

COPY --from=build /app/server server
ARG PACKAGE
COPY --from=build /app/packages/$PACKAGE/drizzle drizzle

ENV NODE_ENV=production
ARG SERVICE_TYPE
ENV SERVICE_TYPE=${SERVICE_TYPE}

CMD ["/app/server"]

EXPOSE 3000
