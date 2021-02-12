// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types

import {AnySchema, BsonType, mapPathValues, Model} from '@mongozest/core';
import {isString, toString} from 'lodash';
import {OptionalId} from 'mongodb';

const TRIMMABLE_TYPES: BsonType[] = ['string'];

// @docs https://docs.mongodb.com/manual/reference/bson-types/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const trimValueForType = (value: any, type: string): any => {
  switch (type) {
    case 'string':
      return toString(value).trim();
    default:
      return value;
  }
};

export type TrimPluginOptions = {
  trimmableTypes?: BsonType[];
};

// Helper recursively parsing schema to find path where values should be casted
export const trimPlugin = <TSchema extends AnySchema>(
  model: Model<TSchema>,
  {trimmableTypes = TRIMMABLE_TYPES}: TrimPluginOptions = {}
): void => {
  const trimmableProperties = new Map();
  model.post('initialize:property', (property, path) => {
    const bsonType = isString(property) ? (property as BsonType) : property.bsonType;
    if (bsonType && trimmableTypes.includes(bsonType)) {
      trimmableProperties.set(path, bsonType);
    }
  });
  // @TODO TEST-ME!
  model.pre('update', (_operation, _filter, update) => {
    trimmableProperties.forEach((bsonType, path) => {
      if (update.$set) {
        mapPathValues(update.$set, path, (value) => trimValueForType(value, bsonType));
      }
      if (update.$push) {
        mapPathValues(update.$push as OptionalId<TSchema>, path, (value) => trimValueForType(value, bsonType));
      }
    });
  });
  // Handle insert
  model.pre('insert', (_operation, document) => {
    trimmableProperties.forEach((bsonType, path) => {
      mapPathValues(document, path, (value) => trimValueForType(value, bsonType));
    });
  });
};
