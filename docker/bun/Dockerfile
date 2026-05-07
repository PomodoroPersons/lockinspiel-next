FROM oven/bun AS build

WORKDIR /app

# Cache packages installation
COPY package.json package.json
COPY ./packages/lockinspiel-backend-common/package.json ./packages/lockinspiel-backend-common/package.json
COPY bun.lock bun.lock
ARG PACKAGE
COPY ./packages/$PACKAGE/package.json ./packages/$PACKAGE/package.json

RUN bun install

COPY ./packages/$PACKAGE/src ./packages/$PACKAGE/src
COPY ./packages/lockinspiel-backend-common/src ./packages/lockinspiel-backend-common/src
COPY ./packages/lockinspiel-backend-common/tsconfig.json ./packages/lockinspiel-backend-common/tsconfig.json

ENV NODE_ENV=production

RUN bun build \
	--compile \
	--minify-whitespace \
	--minify-syntax \
	--outfile server \
	./packages/$PACKAGE/src/index.ts

FROM gcr.io/distroless/base

WORKDIR /app

COPY --from=build /app/server server

ENV NODE_ENV=production
ARG SERVICE_TYPE
ENV SERVICE_TYPE=${SERVICE_TYPE}

CMD ["./server"]

EXPOSE 3000
