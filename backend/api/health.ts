import type { ApiResponse } from "../../shared/src/index.js";

interface HealthData {
  readonly status: "ok";
}

export function GET(): Response {
  const response: ApiResponse<HealthData> = {
    success: true,
    data: {
      status: "ok",
    },
    message: "",
  };

  return Response.json(response);
}

const healthFunction = {
  fetch(): Response {
    return GET();
  },
};

export default healthFunction;
