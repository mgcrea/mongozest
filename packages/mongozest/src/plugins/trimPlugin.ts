// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types

import {isString, toString} from 'lodash';
import {Model, mapPathValues} from '..';
import {FilterQuery, UpdateQuery} from 'mongodb';

const TRIMMABLE_TYPES = ['string'];

// @docs https://docs.mongodb.com/manual/reference/bson-types/
const trimValueForType = (value: any, type: string) => {
  switch (type) {
    case 'string':
      return toString(value).trim();
    default:
      return value;
  }
};

// Helper recursively parsing schema to find path where values should be casted
export default function trimPlugin<TSchema>(
  model: Model,
  {ignoredKeys = ['_id'], trimmableTypes = TRIMMABLE_TYPES, castDecimalsAsFloats = false} = {}
) {
  const trimmableProperties = new Map();
  model.post('initialize:property', (property: {[s: string]: any}, path: string) => {
    const bsonType = isString(property) ? property : property.bsonType;
    if (bsonType && trimmableTypes.includes(bsonType)) {
      trimmableProperties.set(path, bsonType);
    }
  });
  // @TODO TEST-ME!
  model.pre('update', (_filter: FilterQuery<TSchema>, update: UpdateQuery<TSchema> | TSchema) => {
    trimmableProperties.forEach((bsonType, path) => {
      if (update.$set) {
        mapPathValues(update.$set, path, (value: any) => trimValueForType(value, bsonType));
      }
      if (update.$push) {
        mapPathValues(update.$push, path, (value: any) => trimValueForType(value, bsonType));
      }
    });
  });
  // Handle insert
  model.pre('insert', (doc: T) => {
    trimmableProperties.forEach((bsonType, path) => {
      mapPathValues(doc, path, (value: any) => trimValueForType(value, bsonType));
    });
  });
}
