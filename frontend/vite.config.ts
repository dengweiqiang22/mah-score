import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

import roomFunction from "../backend/api/room";
import createRoomFunction from "../backend/api/room/create";
import roomEventFunction from "../backend/api/room/event";
import roomEventsFunction from "../backend/api/room/events";
import joinRoomFunction from "../backend/api/room/join";
import scoreFunction from "../backend/api/room/score";
import startRoomFunction from "../backend/api/room/start";
import undoFunction from "../backend/api/room/undo";
import removePlayerFunction from "../backend/api/room/player/remove";
import renamePlayerFunction from "../backend/api/room/player/rename";

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
      server.middlewares.use("/api/room/player/rename", async (request, response, next) => {
        if (request.method !== "POST") {
          next();
          return;
        }

        const apiRequest = await createRequestFromIncomingMessage(
          request,
          "/api/room/player/rename",
        );
        const apiResponse = await renamePlayerFunction.fetch(apiRequest);

        await sendApiResponse(response, apiResponse);
      });
      server.middlewares.use("/api/room/player/remove", async (request, response, next) => {
        if (request.method !== "POST") {
          next();
          return;
        }

        const apiRequest = await createRequestFromIncomingMessage(
          request,
          "/api/room/player/remove",
        );
        const apiResponse = await removePlayerFunction.fetch(apiRequest);

        await sendApiResponse(response, apiResponse);
      });
      server.middlewares.use("/api/room/create", async (request, response, next) => {
        if (request.method !== "POST") {
          next();
          return;
        }

        const apiResponse = await createRoomFunction.fetch();

        await sendApiResponse(response, apiResponse);
      });
      server.middlewares.use("/api/room/join", async (request, response, next) => {
        if (request.method !== "POST") {
          next();
          return;
        }

        const apiRequest = await createRequestFromIncomingMessage(request, "/api/room/join");
        const apiResponse = await joinRoomFunction.fetch(apiRequest);

        await sendApiResponse(response, apiResponse);
      });
      server.middlewares.use("/api/room/start", async (request, response, next) => {
        if (request.method !== "POST") {
          next();
          return;
        }

        const apiRequest = await createRequestFromIncomingMessage(request, "/api/room/start");
        const apiResponse = await startRoomFunction.fetch(apiRequest);

        await sendApiResponse(response, apiResponse);
      });
      server.middlewares.use("/api/room/event", async (request, response, next) => {
        if (request.method !== "POST") {
          next();
          return;
        }

        const apiRequest = await createRequestFromIncomingMessage(request, "/api/room/event");
        const apiResponse = await roomEventFunction.fetch(apiRequest);

        await sendApiResponse(response, apiResponse);
      });
      server.middlewares.use("/api/room/score", async (request, response, next) => {
        if (request.method !== "POST") {
          next();
          return;
        }

        const apiRequest = await createRequestFromIncomingMessage(request, "/api/room/score");
        const apiResponse = await scoreFunction.fetch(apiRequest);

        await sendApiResponse(response, apiResponse);
      });
      server.middlewares.use("/api/room/undo", async (request, response, next) => {
        if (request.method !== "POST") {
          next();
          return;
        }

        const apiRequest = await createRequestFromIncomingMessage(request, "/api/room/undo");
        const apiResponse = await undoFunction.fetch(apiRequest);

        await sendApiResponse(response, apiResponse);
      });
      server.middlewares.use("/api/room/events", async (request, response, next) => {
        if (request.method !== "GET" || request.url === undefined) {
          next();
          return;
        }

        const apiRequest = new Request(new URL(request.url, "http://localhost"), {
          method: "GET",
        });
        const apiResponse = await roomEventsFunction.fetch(apiRequest);

        await sendApiResponse(response, apiResponse);
      });
      server.middlewares.use("/api/room", async (request, response, next) => {
        if (request.method !== "GET" || request.url === undefined) {
          next();
          return;
        }

        const apiRequest = new Request(new URL(request.url, "http://localhost"), {
          method: "GET",
        });
        const apiResponse = await roomFunction.fetch(apiRequest);

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
