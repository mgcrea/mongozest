import {ObjectId, BsonType, Model, UnknownSchema} from '@mongozest/core';

export type CreatedByPluginSchema<TProp = ObjectId> = {
  ownedBy: TProp;
  createdBy: TProp;
  updatedBy: TProp;
};

export type CreatedByPluginOptions = {
  bsonType?: BsonType;
  ref?: string;
};

export const createdByPlugin = <TSchema extends UnknownSchema & CreatedByPluginSchema>(
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
