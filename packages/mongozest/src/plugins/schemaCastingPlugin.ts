// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types

import {get, set, isString, isPlainObject, toString, toNumber, toSafeInteger, omitBy} from 'lodash';
import {
  Long,
  ObjectId,
  Decimal128 as Decimal,
  Int32 as Int,
  Double,
  FilterQuery,
  FindOneOptions,
  UpdateQuery,
  FindOneAndReplaceOption
} from 'mongodb';
// @types
import {Model, OperationMap, mapPathValues} from '..';

const CASTABLE_TYPES = ['bool', 'date', 'decimal', 'double', 'int', 'long', 'objectId', 'string'];

// @docs https://docs.mongodb.com/manual/reference/bson-types/
const castValueForType = (value: any, type: string) => {
  switch (type) {
    case 'bool':
      return !!value;
    case 'date':
      return new Date(value);
    case 'decimal':
      return Decimal.fromString(toString(value));
    case 'double':
      return new Double(toNumber(value));
    case 'int':
      return new Int(toSafeInteger(value));
    case 'long':
      return Long.fromNumber(toNumber(value));
    case 'objectId':
      if (!value) {
        return;
      }
      return ObjectId.createFromHexString(toString(value));
    case 'string':
      return toString(value);
    default:
      return value;
  }
};

const parseValueForType = (value: any, type: string) => {
  switch (type) {
    // Convert decimal type to javascript float as the current NodeJS driver does not handle it
    case 'decimal': {
      return value instanceof Decimal ? parseFloat(value.toString()) : value;
    }
    default:
      return value;
  }
};

// @NOTE lib? https://github.com/kofrasa/mingo
// @NOTE lib? https://github.com/crcn/sift.js
const SINGLE_VALUE_QUERY_OPERATORS = ['$eq', '$gt', '$gte', '$lt', '$lte', '$ne'];
const ARRAY_VALUE_QUERY_OPERATORS = ['$in', '$nin'];

const castFilterValueForType = (value: any, type: string) => {
  if (isString(value)) {
    return castValueForType(value, type);
  }
  if (isPlainObject(value)) {
    SINGLE_VALUE_QUERY_OPERATORS.forEach(operator => {
      if (value[operator]) {
        value[operator] = castValueForType(value[operator], type);
      }
    });
    ARRAY_VALUE_QUERY_OPERATORS.forEach(operator => {
      if (value[operator]) {
        value[operator] = value[operator].map((_value: any) => castValueForType(_value, type));
      }
    });
  }
  return value;
};

// Helper recursively parsing schema to find path where values should be casted
export default function autoCastingPlugin<TSchema>(
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
    // Check if we have results
    if (!filter) {
      return;
    }
    castableProperties.forEach((bsonType, path) => {
      mapPathValues(filter, path, (value: any) => castFilterValueForType(value, bsonType));
    });
  });
  model.post('find', (filter: FilterQuery<TSchema>, options: FindOneOptions, operation: OperationMap) => {
    const doc = operation.get('result');
    // Check if we have results
    if (!doc) {
      return;
    }
    castableProperties.forEach((bsonType, path) => {
      mapPathValues(doc, path, (value: any) => parseValueForType(value, bsonType));
    });
  });
  model.post(
    'findOneAndUpdate',
    (
      filter: FilterQuery<TSchema>,
      update: UpdateQuery<TSchema>,
      options: FindOneAndReplaceOption,
      operation: OperationMap
    ) => {
      const doc = operation.get('result').value;
      // Check if we have results
      if (!doc) {
        return;
      }
      castableProperties.forEach((bsonType, path) => {
        mapPathValues(doc, path, (value: any) => parseValueForType(value, bsonType));
      });
    }
  );
  // @TODO TEST-ME!
  model.pre('update', (filter: FilterQuery<TSchema>, update: UpdateQuery<TSchema>) => {
    castableProperties.forEach((bsonType, path) => {
      // d(`update ${path}: ${bsonType}`);
      mapPathValues(filter, path, (value: any) => castFilterValueForType(value, bsonType));
      if (update.$set) {
        mapPathValues(update.$set, path, (value: any) => castValueForType(value, bsonType));
      }
      if (update.$push) {
        mapPathValues(update.$push, path, (value: any) => castValueForType(value, bsonType));
      }
    });
  });
  // Handle insert
  model.pre('insert', (doc: T) => {
    castableProperties.forEach((bsonType, path) => {
      mapPathValues(doc, path, (value: any) => {
        // try {
        return castValueForType(value, bsonType);
        // } catch (err) {
        //   d(model.collectionName, {bsonType, value, path});
        //   throw err;
        // }
      });
    });
  });
  // @TODO Handle document update
}
