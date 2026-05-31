import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation"
  | "conflict"
  | "internal";

const STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation: 400,
  conflict: 409,
  internal: 500,
};

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function unauthorized(message = "Sign in required"): ApiError {
  return new ApiError("unauthorized", message);
}
export function notFound(message = "Not found"): ApiError {
  return new ApiError("not_found", message);
}
export function conflict(message: string, details?: unknown): ApiError {
  return new ApiError("conflict", message, details);
}
export function validation(message: string, details?: unknown): ApiError {
  return new ApiError("validation", message, details);
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: STATUS[err.code] },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "validation", message: "Invalid input", details: err.flatten() } },
      { status: 400 },
    );
  }
  const message = err instanceof Error ? err.message : "Internal error";
  return NextResponse.json(
    { error: { code: "internal", message } },
    { status: 500 },
  );
}
