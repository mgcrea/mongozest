// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types

import {get, set, isString, isPlainObject, toString, toNumber, toSafeInteger} from 'lodash';
import {Long, ObjectId, Decimal128 as Decimal, Int32 as Int} from 'mongodb';
// @types
import {Model, OperationMap, mapPathValues} from '..';

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
export default function autoCastingPlugin(
  model: Model,
  {ignoredKeys = ['_id'], castableTypes = CASTABLE_TYPES, castDecimalsAsFloats = false} = {}
) {
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
      mapPathValues(filter, path, (value: any) => {
        if (isString(value)) {
          return castValueForType(value, bsonType);
        }
        if (isPlainObject(value)) {
          if (value.$in) {
            value.$in = value.$in.map((_value: any) => castValueForType(_value, bsonType));
          }
        }
        return value;
      });
    });
  });
  model.post('find', (filter: FilterQuery<TSchema>, options: FindOneOptions, operation: OperationMap) => {
    castableProperties.forEach((bsonType, path) => {
      // Convert decimal type to javascript float... for now.
      if (castDecimalsAsFloats && bsonType === 'decimal') {
        const doc = operation.get('result');
        const value = get(doc, path);
        if (value) {
          set(doc, path, value.toString() * 1);
        }
      }
    });
  });
  // @TODO TEST-ME!
  model.pre('update', (filter: FilterQuery<TSchema>, update: UpdateQuery<TSchema> | TSchema) => {
    castableProperties.forEach((bsonType, path) => {
      mapPathValues(filter, path, (value: any) => castValueForType(value, bsonType));
      mapPathValues(update.$set, path, (value: any) => castValueForType(value, bsonType));
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
