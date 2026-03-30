interface RequestableApp {
  request: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>;
}

export async function invokeTool<TResponse>(app: RequestableApp, payload: unknown): Promise<{ status: number; body: TResponse }> {
  const response = await Promise.resolve(
    app.request('/mcp/invoke', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'test-request-id'
      },
      body: JSON.stringify(payload)
    })
  );

  return {
    status: response.status,
    body: await response.json() as TResponse
  };
}

