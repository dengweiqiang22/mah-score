import type { ApiFailureResponse, ApiResponse } from "@mah-score/shared";

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
