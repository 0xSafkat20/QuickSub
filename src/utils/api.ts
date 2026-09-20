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
  if (!response.ok)
    throw new Error(data.error || "Request failed. Please try again.");
  return data;
}
