export * from './plugins';
export * from './utils/objectId';

import Model, {OperationMap} from './model';
import {Schema, SchemaProperties, JsonSchema} from './schema';
// import Plugin from './plugin';
import Interface from './interface';

export {Interface, Model, Schema, SchemaProperties, JsonSchema, OperationMap};
export {ObjectId, MongoError} from 'mongodb';

export {mapPathValues, defaultPathValues} from './utils/traversing';

export default Interface.create;
