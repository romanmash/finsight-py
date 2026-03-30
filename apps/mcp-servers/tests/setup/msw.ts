import { afterAll, afterEach, beforeAll } from 'vitest';
import { setupServer } from 'msw/node';

export const mswServer = setupServer();

beforeAll(() => {
  mswServer.listen({ onUnhandledRequest: 'bypass' });
});

afterEach(() => {
  mswServer.resetHandlers();
});

afterAll(() => {
  mswServer.close();
});

