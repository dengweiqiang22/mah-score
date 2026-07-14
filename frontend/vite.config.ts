import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

import healthFunction from "../backend/api/health";
import roomRouterFunction from "../backend/api/room/router";

function applyRootEnv(mode: string): void {
  const rootEnv = loadEnv(mode, "..", "");

  for (const [key, value] of Object.entries(rootEnv)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function localApiPlugin(): Plugin {
  async function createRequestFromIncomingMessage(
    request: Parameters<Parameters<Plugin["configureServer"]>[0]["middlewares"]["use"]>[1],
    pathname: string,
  ): Promise<Request> {
    const bodyChunks: Uint8Array[] = [];

    for await (const chunk of request) {
      bodyChunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }

    const requestUrl = new URL(pathname, "http://localhost");

    return new Request(requestUrl, {
      body: bodyChunks.length > 0 ? Buffer.concat(bodyChunks) : undefined,
      headers: {
        "Content-Type": request.headers["content-type"] ?? "application/json",
      },
      method: request.method,
    });
  }

  async function sendApiResponse(
    response: Parameters<Parameters<Plugin["configureServer"]>[0]["middlewares"]["use"]>[2],
    apiResponse: Response,
  ): Promise<void> {
    const responseBody = await apiResponse.text();

    response.statusCode = apiResponse.status;
    apiResponse.headers.forEach((value, key) => {
      response.setHeader(key, value);
    });
    response.end(responseBody);
  }

  return {
    name: "mah-score-local-api",
    configureServer(server) {
      server.middlewares.use("/api/health", async (request, response, next) => {
        if (request.method !== "GET") {
          next();
          return;
        }

        const apiResponse = await healthFunction.fetch();

        await sendApiResponse(response, apiResponse);
      });
      server.middlewares.use("/api/room", async (request, response, next) => {
        if ((request.method !== "GET" && request.method !== "POST") || request.url === undefined) {
          next();
          return;
        }

        const apiRequest =
          request.method === "GET"
            ? new Request(new URL(request.url, "http://localhost"), {
                method: "GET",
              })
            : await createRequestFromIncomingMessage(request, request.url);
        const apiResponse = await roomRouterFunction.fetch(apiRequest);

        await sendApiResponse(response, apiResponse);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  applyRootEnv(mode);

  return {
    plugins: [react(), localApiPlugin()],
    server: {
      port: 5173,
    },
  };
});
