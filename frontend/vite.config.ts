import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

import createRoomFunction from "../backend/api/room/create";
import joinRoomFunction from "../backend/api/room/join";

function applyRootEnv(mode: string): void {
  const rootEnv = loadEnv(mode, "..", "");

  for (const [key, value] of Object.entries(rootEnv)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function localApiPlugin(): Plugin {
  return {
    name: "mah-score-local-api",
    configureServer(server) {
      server.middlewares.use("/api/room/create", async (request, response, next) => {
        if (request.method !== "POST") {
          next();
          return;
        }

        const apiResponse = await createRoomFunction.fetch();
        const responseBody = await apiResponse.text();

        response.statusCode = apiResponse.status;
        apiResponse.headers.forEach((value, key) => {
          response.setHeader(key, value);
        });
        response.end(responseBody);
      });
      server.middlewares.use("/api/room/join", async (request, response, next) => {
        if (request.method !== "POST") {
          next();
          return;
        }

        const bodyChunks: Uint8Array[] = [];

        for await (const chunk of request) {
          bodyChunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        }

        const apiRequest = new Request("http://localhost/api/room/join", {
          body: Buffer.concat(bodyChunks),
          headers: {
            "Content-Type": request.headers["content-type"] ?? "application/json",
          },
          method: "POST",
        });
        const apiResponse = await joinRoomFunction.fetch(apiRequest);
        const responseBody = await apiResponse.text();

        response.statusCode = apiResponse.status;
        apiResponse.headers.forEach((value, key) => {
          response.setHeader(key, value);
        });
        response.end(responseBody);
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
