import Fastify, { type FastifyServerOptions } from "fastify";

export function buildApp(options: FastifyServerOptions = {}) {
  const app = Fastify(options);

  app.get("/health", async () => ({
    service: "cloud-arena-api",
    status: "ok",
    version: "0.0.0",
  }));

  return app;
}
