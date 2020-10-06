import {BsonType, DefaultSchema, mapPathValues, Model} from '@mongozest/core';
import {isPlainObject, isString, toNumber, toSafeInteger, toString} from 'lodash';
import {Decimal128 as Decimal, Double, Int32 as Int, Long, ObjectId, OptionalId} from 'mongodb';

const CASTABLE_TYPES: BsonType[] = ['bool', 'date', 'decimal', 'double', 'int', 'long', 'objectId', 'string'];

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
    SINGLE_VALUE_QUERY_OPERATORS.forEach((operator) => {
      if (value[operator]) {
        value[operator] = castValueForType(value[operator], type);
      }
    });
    ARRAY_VALUE_QUERY_OPERATORS.forEach((operator) => {
      if (value[operator]) {
        value[operator] = value[operator].map((_value: any) => castValueForType(_value, type));
      }
    });
  }
  return value;
};

export type SchemaCastingPluginOptions = {
  castableTypes?: BsonType[];
  castDecimalsAsFloats?: boolean;
};

export const schemaCastingPlugin = <TSchema extends DefaultSchema>(
  model: Model<TSchema>,
  {castableTypes = CASTABLE_TYPES, castDecimalsAsFloats = false}: SchemaCastingPluginOptions = {}
): void => {
  const castableProperties = new Map();
  model.post('initialize:property', (property, path: string) => {
    const bsonType = isString(property) ? (property as BsonType) : property.bsonType;
    if (bsonType && castableTypes.includes(bsonType)) {
      castableProperties.set(path, bsonType);
    }
  });
  // Handle find
  // @TODO TEST-ME!
  model.pre('find', (_operation, filter) => {
    // Check if we have results
    if (!filter) {
      return;
    }
    castableProperties.forEach((bsonType, path) => {
      mapPathValues(filter as OptionalId<TSchema>, path, (value) => castFilterValueForType(value, bsonType));
    });
  });
  model.post('find', (operation) => {
    const doc = operation.get('result');
    // Check if we have results
    if (!doc) {
      return;
    }
    castableProperties.forEach((bsonType, path) => {
      mapPathValues(doc, path, (value: any) => parseValueForType(value, bsonType));
    });
  });
  model.post('findOneAndUpdate', (operation) => {
    const doc = operation.get('result').value;
    // Check if we have results
    if (!doc) {
      return;
    }
    castableProperties.forEach((bsonType, path) => {
      mapPathValues(doc, path, (value: any) => parseValueForType(value, bsonType));
    });
  });
  // @TODO TEST-ME!
  model.pre('update', (_operation, filter, update) => {
    castableProperties.forEach((bsonType, path) => {
      // d(`update ${path}: ${bsonType}`);
      mapPathValues(filter as OptionalId<TSchema>, path, (value: any) => castFilterValueForType(value, bsonType));
      if (update.$set) {
        mapPathValues(update.$set, path, (value: any) => castValueForType(value, bsonType));
      }
      if (update.$push) {
        mapPathValues(update.$push, path, (value: any) => castValueForType(value, bsonType));
      }
    });
  });
  // Handle insert
  model.pre('insert', (_operation, doc) => {
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
};
