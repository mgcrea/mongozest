import {BsonType, Model, DefaultSchema} from '@mongozest/core';
import {ObjectId} from 'mongodb';

export type CreatedByPluginSchema<TProp = ObjectId> = {
  ownedBy: TProp;
  createdBy: TProp;
  updatedBy: TProp;
};

export type CreatedByPluginOptions = {
  bsonType?: BsonType;
  ref?: string;
};

export const createdByPlugin = <TSchema extends DefaultSchema & CreatedByPluginSchema>(
  model: Model<TSchema>,
  {bsonType = 'objectId', ref = 'User'}: CreatedByPluginOptions = {}
): void => {
  model.addSchemaProperties({
    ownedBy: {bsonType, ref},
    createdBy: {bsonType, ref},
    updatedBy: {bsonType, ref}
  });
};

// declare module '@mongozest/core' {
//   interface DefaultSchema {
//     ownedBy: ObjectId;
//     createdBy: ObjectId;
//     updatedBy: ObjectId;
//   }
// }
