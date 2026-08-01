FROM node:24-alpine AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack install --global pnpm@11.10.0

WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter api... build && pnpm --filter web... build

FROM node:24-alpine AS api

ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack install --global pnpm@11.10.0

WORKDIR /app

COPY --from=build /app /app

EXPOSE 3000

CMD ["sh", "-c", "pnpm --filter api db:migrate && pnpm --filter api start:prod"]

FROM nginx:1.28-alpine AS web

COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
