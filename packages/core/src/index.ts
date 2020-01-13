export * from './utils/objectId';
export * from './utils/logger';

import Model, {OperationMap} from './model';
import {Schema, SchemaProperties, JsonSchema} from './schema';
import jsonSchemaPlugin from './plugins/jsonSchemaPlugin';
import Interface from './interface';

export {Interface, Model, Schema, SchemaProperties, JsonSchema, OperationMap};
export {ObjectId, MongoError} from 'mongodb';

export {mapPathValues, defaultPathValues} from './utils/traversing';
export {jsonSchemaPlugin};

export default Interface.create;
