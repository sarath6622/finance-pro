export interface ApiErrorPayload {
  error: { code: string; message: string; details?: unknown };
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export async function api<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let body: ApiErrorPayload | undefined;
    try {
      body = (await res.json()) as ApiErrorPayload;
    } catch {
      // ignore parse error
    }
    const err = body?.error;
    throw new ApiClientError(
      res.status,
      err?.code ?? "unknown",
      err?.message ?? res.statusText,
      err?.details,
    );
  }
  return (await res.json()) as T;
}
