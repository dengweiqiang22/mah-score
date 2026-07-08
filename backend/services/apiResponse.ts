import type { ApiFailureResponse, ApiResponse } from "../../shared/src/index.js";

export function jsonSuccess<TData>(data: TData, init?: ResponseInit): Response {
  const response: ApiResponse<TData> = {
    success: true,
    data,
    message: "",
  };

  return Response.json(response, init);
}

export function jsonFailure(message: string, code: string, init?: ResponseInit): Response {
  const response: ApiFailureResponse = {
    success: false,
    message,
    code,
  };

  return Response.json(response, init);
}
