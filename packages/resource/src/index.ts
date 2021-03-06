export * from './plugins';
export * from './operation';

import Resource from './resource';
export type { AggregationPipeline } from './resource';
export { asyncHandler } from './utils/request';
export { mongoErrorMiddleware } from './utils/errors';

export { Resource };

export default Resource.create;
