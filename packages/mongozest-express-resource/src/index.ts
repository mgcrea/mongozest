// import {ObjectId} from 'mongodb';
// export * from './plugins';

// import Model from './model';
// import Plugin from './plugin';
import Resource from './resource';
export * from './plugins';
export {asyncHandler} from './utils/async';
export {mongoErrorMiddleware} from './utils/errors';

export {Resource};

export default Resource.create;
