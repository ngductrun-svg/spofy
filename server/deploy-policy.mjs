export const isPreview = context => ['deploy-preview', 'branch-deploy'].includes(context);
export const previewBlocked = env => isPreview(env.CONTEXT) && env.PREVIEW_DATA_ISOLATED !== 'true';
export function buildContext(env) {
  const context = env.CONTEXT || 'local';
  return { context, previewDataIsolated: env.PREVIEW_DATA_ISOLATED === 'true' };
}
