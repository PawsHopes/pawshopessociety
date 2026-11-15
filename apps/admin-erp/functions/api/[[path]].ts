import apiWorker from '../../../../workers/api/src/index';

type WorkerBindings = Parameters<typeof apiWorker.fetch>[1];
type WorkerExecutionContext = Parameters<typeof apiWorker.fetch>[2];

interface PagesRequestContext {
  request: Request;
  env: WorkerBindings;
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
}

// Reuse the tested Hono Worker API on the Admin hostname. This keeps browser
// requests same-origin so the existing Cloudflare Access session protects
// admin pages and admin API calls with the same JWT audience.
export const onRequest = (context: PagesRequestContext) => {
  const executionContext = {
    waitUntil: (promise: Promise<unknown>) => context.waitUntil(promise),
    passThroughOnException: () => context.passThroughOnException(),
  } as WorkerExecutionContext;
  return apiWorker.fetch(context.request, context.env, executionContext);
};
