import {BsonType} from '../schema';
import {Model, ObjectId} from '..';

export interface CreatedByPluginProps<TProp> {
  ownedBy: TProp;
  createdBy: TProp;
  updatedBy: TProp;
}

export interface CreatedByPluginOptions {
  bsonType?: BsonType;
  ref?: string;
}

export default function createdByPlugin<TSchema extends CreatedByPluginProps<ObjectId>>(
  model: Model<TSchema>,
  {bsonType = 'objectId', ref = 'User'}: CreatedByPluginOptions = {}
) {
  model.addSchemaProperties({
    ownedBy: {bsonType, ref},
    createdBy: {bsonType, ref},
    updatedBy: {bsonType, ref}
  });
}
