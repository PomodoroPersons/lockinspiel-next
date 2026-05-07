ARG PACKAGE
ARG SERVICE_TYPE

FROM oven/bun AS build
ARG PACKAGE

WORKDIR /app

# Cache packages installation
COPY package.json package.json
COPY ./packages/lockinspiel-backend-common/package.json ./packages/lockinspiel-backend-common/package.json
COPY ./packages/$PACKAGE/package.json ./packages/$PACKAGE/package.json
COPY bun.lock bun.lock

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
ARG SERVICE_TYPE

WORKDIR /app

COPY --from=build /app/server server

ENV NODE_ENV=production
ENV SERVICE_TYPE=${SERVICE_TYPE}

CMD ["./server"]

EXPOSE 3000
