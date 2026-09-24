import { updateSessionExpiry, endSession, type SessionScope } from './session';
export class ApiError extends Error {
 constructor(message: string, public status: number) { super(message); this.name = 'ApiError'; }
}
export async function api<T>(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  let response: Response;
  try { response = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-QuickSub-Client": "web" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  } catch {
    throw new Error(import.meta.env.DEV ? "The local API server is not reachable. Start the project with npm run dev, then retry." : "We could not connect to the service. Please check your connection and try again.");
  }
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(import.meta.env.DEV ? "The local API server is unavailable. Run npm run dev to start both the website and API, then retry." : "The service is temporarily unavailable. Please try again shortly.");
  }
  const data = await response.json();
  const scope = (response.headers.get('X-QuickSub-Session-Scope') || (path.startsWith('/admin/') ? 'admin' : 'customer')) as SessionScope;
  const expiresAt = response.headers.get('X-QuickSub-Session-Expires');
  if (response.ok && expiresAt) updateSessionExpiry(scope, expiresAt);
  const authForm = /\/(login|signup|forgot-password|reset-password)$/.test(path);
  if (response.status === 401 && !authForm) endSession(scope);
  if (response.ok && /\/(account|admin)\/logout$/.test(path)) endSession(scope);
  if (!response.ok)
    throw new ApiError(data.error || "Request failed. Please try again.", response.status);
  return data;
}
