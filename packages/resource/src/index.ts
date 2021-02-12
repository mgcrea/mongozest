export * from './plugins';
export * from './operation';

import Resource, { AggregationPipeline } from './resource';
export { asyncHandler } from './utils/request';
export { mongoErrorMiddleware } from './utils/errors';

export { Resource, AggregationPipeline };

export default Resource.create;
