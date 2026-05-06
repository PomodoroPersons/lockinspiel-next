ARG PACKAGE

FROM oven/bun AS build
ARG PACKAGE

WORKDIR /app

# Cache packages installation
COPY package.json package.json
COPY ./packages/$PACKAGE/package.json ./packages/$PACKAGE/package.json
COPY bun.lock bun.lock

RUN bun install

COPY ./packages/$PACKAGE/src ./packages/$PACKAGE/src

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

CMD ["./server"]

EXPOSE 3000
