export * from './plugins';
export * from './utils/objectId';

import Model, {OperationMap} from './model';
// import Plugin from './plugin';
import Interface from './interface';

export {Interface, Model, OperationMap};
export {ObjectId, MongoError} from 'mongodb';

export {mapPathValues, defaultPathValues} from './utils/traversing';

export default Interface.create;
