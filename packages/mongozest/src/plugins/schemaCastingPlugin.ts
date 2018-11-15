// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types

import {get, has, set, isString} from 'lodash';
import {Long, ObjectId, Decimal128 as Decimal, Int32 as Int} from 'mongodb';
import {toString, toNumber, toInteger, toSafeInteger} from 'lodash';
// @types
import {Model, mapPathValues} from '..';

const CASTABLE_TYPES = ['objectId', 'long', 'decimal', 'int', 'date'];

const castValueForType = (value: any, type: string) => {
  switch (type) {
    case 'objectId':
      return ObjectId.createFromHexString(toString(value));
    case 'long':
      return Long.fromNumber(toNumber(value));
    case 'decimal':
      return Decimal.fromString(toString(value));
    case 'int':
      return new Int(toSafeInteger(value));
    case 'date':
      return new Date(value);
    default:
      return value;
  }
};

// Helper recursively parsing schema to find path where values should be casted
export default function autoCastingPlugin(model: Model, {ignoredKeys = ['_id'], castableTypes = CASTABLE_TYPES} = {}) {
  const castableProperties = new Map();
  model.post('initialize:property', (property: {[s: string]: any}, path: string) => {
    const bsonType = isString(property) ? property : property.bsonType;
    if (bsonType && castableTypes.includes(bsonType)) {
      castableProperties.set(path, bsonType);
    }
  });
  // Handle find
  // @TODO TEST-ME!
  model.pre('find', (filter: FilterQuery<TSchema>) => {
    castableProperties.forEach((bsonType, path) => {
      mapPathValues(filter, path, (value: any) => castValueForType(value, bsonType));
    });
  });
  // @TODO TEST-ME!
  model.pre('update', (filter: FilterQuery<TSchema>) => {
    castableProperties.forEach((bsonType, path) => {
      mapPathValues(filter, path, (value: any) => castValueForType(value, bsonType));
    });
  });
  // Handle insert
  model.pre('insert', (doc: T) => {
    castableProperties.forEach((bsonType, path) => {
      mapPathValues(doc, path, (value: any) => castValueForType(value, bsonType));
    });
  });
  // @TODO Handle document update
}
