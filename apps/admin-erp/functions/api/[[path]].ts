import apiWorker from '../../../../workers/api/src/index';

type WorkerBindings = Parameters<typeof apiWorker.fetch>[1];
type WorkerExecutionContext = Parameters<typeof apiWorker.fetch>[2];

interface PagesRequestContext {
  request: Request;
  env: WorkerBindings;
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
}

// Keep the tested Worker API implementation as the single source of truth.
// Pages Functions serves it on the Admin hostname so Access authentication and
// API requests share the same origin and audience.
export const onRequest = ({ request, env, waitUntil, passThroughOnException }: PagesRequestContext) => {
  const executionContext = { waitUntil, passThroughOnException } as WorkerExecutionContext;
  return apiWorker.fetch(request, env, executionContext);
};
