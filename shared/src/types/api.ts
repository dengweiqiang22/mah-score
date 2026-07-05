export interface ApiSuccessResponse<TData> {
  readonly success: true;
  readonly data: TData;
  readonly message: string;
}

export interface ApiFailureResponse {
  readonly success: false;
  readonly message: string;
  readonly code: string;
}

export type ApiResponse<TData> = ApiSuccessResponse<TData> | ApiFailureResponse;
