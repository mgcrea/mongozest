/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
// @docs https://docs.mongodb.com/manual/reference/operator/query/jsonSchema/

import {cloneDeep, get, isPlainObject, isString, isUndefined, omit, pick, set, unset} from 'lodash';
import {CollectionCreateOptions, Decimal128, Double, FilterQuery, Int32, MongoError, ObjectId} from 'mongodb';
import type {Model} from '../model';
import type {
  AnySchema,
  BsonType,
  DefaultSchema,
  JsonSchema,
  JsonSchemaProperties,
  JsonSchemaProperty,
  MongoJsonSchemaProperty,
  UnknownSchema
} from '../typings';
import {chalkJson, chalkString} from './../utils';

const JSON_SCHEMA_VALID_KEYS = [
  'bsonType', // Accepts same string aliases used for the $type operator
  'enum', // Enumerates all possible values of the field
  'type', // Enumerates the possible JSON types of the field
  'allOf', // Field must match all specified schemas
  'anyOf', // Field must match at least one of the specified schemas
  'oneOf', // Field must match exactly one of the specified schemas
  'not', // Field must not match the schema
  'multipleOf', // Field must be a multiple of this value
  'maximum', // Indicates the maximum value of the field
  'exclusiveMaximum', // If true and field is a number, maximum is an exclusive maximum. Otherwise, it is an inclusive maximum
  'minimum', // Indicates the minimum value of the field
  'exclusiveMinimum', // If true, minimum is an exclusive minimum Otherwise, it is an inclusive minimum
  'maxLength', // Indicates the maximum length of the field
  'minLength', // Indicates the minimum length of the field
  'pattern', // Field must match the regular expression
  'maxProperties', // Indicates the field’s maximum number of properties
  'minProperties', // Indicates the field’s minimum number of properties
  'required', // Object’s property set must contain all the specified elements in the array
  'additionalProperties', // If true, additional fields are allowed If false, they are not
  'properties', // A valid JSON Schema where each value is also a valid JSON Schema object
  'patternProperties', // In addition to properties requirements, each property name of this object must be a valid regular expression
  'dependencies', // Describes field or schema dependencies
  'additionalItems', // If an object, must be a valid JSON Schema
  'items', // Must be either a valid JSON Schema, or an array of valid JSON Schemas
  'maxItems', // Indicates the maximum length of array
  'minItems', // Indicates the minimum length of array
  'uniqueItems', // If true, each item in the array must be unique. Otherwise, no uniqueness constraint is enforced
  'title', // A descriptive title string with no effect
  'description' // A string that describes the schema and has no effect
];

export const jsonSchemaPlugin = <USchema extends DefaultSchema = DefaultSchema>(model: Model<USchema>): void => {
  // @TODO refactor to decouple initialSchema override
  const buildJsonSchema = <TSchema extends UnknownSchema = UnknownSchema>(
    schema: JsonSchemaProperties<TSchema>,
    options: Partial<JsonSchemaProperty<TSchema>> = {}
  ): MongoJsonSchemaProperty<TSchema> => {
    const initialObjectSchema = {
      bsonType: 'object',
      additionalProperties: false,
      properties: {},
      ...options
    } as MongoJsonSchemaProperty<TSchema>;
    return Object.keys(schema).reduce<MongoJsonSchemaProperty<TSchema>>((soFar, key) => {
      // Add support for string shortcut
      const value = isString(schema[key]) ? {bsonType: (schema[key] as unknown) as BsonType} : schema[key];
      const properties = soFar.properties!;
      const {bsonType, required, properties: childProperties, items: _childItems, ...otherProps} = value;
      // Add support for required
      if (required === true) {
        // Initialize array on the fly due to `$jsonSchema keyword 'required' cannot be an empty array`
        if (!Array.isArray(soFar.required)) {
          soFar.required = [];
        }
        soFar.required.push(key);
      }
      // Cleanup keys
      const validJsonKeys = pick(otherProps, JSON_SCHEMA_VALID_KEYS);
      // Nested object case
      const isNestedObjectSchema = bsonType === 'object' && childProperties;
      if (isNestedObjectSchema && childProperties) {
        properties[key] = buildJsonSchema(childProperties!, validJsonKeys);
        return soFar;
      }
      // Nested arrayItems case
      const isNestedArrayItems = bsonType === 'array' && _childItems;
      // @TODO no check for plain objects, etc?
      if (isNestedArrayItems) {
        const childItems = _childItems as JsonSchemaProperty;
        const isNestedObjectInArray = childItems.bsonType === 'object' && childItems.properties;
        const validItemsJsonKeys = pick(omit(childItems, 'properties'), JSON_SCHEMA_VALID_KEYS) as JsonSchemaProperty;
        if (isNestedObjectInArray) {
          properties[key] = {
            bsonType,
            items: buildJsonSchema(childItems.properties!, validItemsJsonKeys),
            ...validJsonKeys
          };
          return soFar;
        } else {
          // Special array leaf case
          properties[key] = {
            bsonType,
            items: validItemsJsonKeys as MongoJsonSchemaProperty,
            ...validJsonKeys
          };
          return soFar;
        }
      }
      // Generic leaf case
      properties[key as keyof TSchema] = {bsonType, ...validJsonKeys};
      return soFar;
    }, initialObjectSchema);
  };

  model.pre('initialize', () => {
    // Check for pre-existing validators
    if (!model.collectionOptions.validator) {
      model.collectionOptions.validator = {};
    }
    const {validator} = model.collectionOptions as CollectionCreateOptions;
    // Add _id unique key if missing
    if (!model.schema._id) {
      model.schema._id = {bsonType: 'objectId'};
    }
    // Set model validator schema
    try {
      // @ts-expect-error missing prop
      validator!.$jsonSchema = buildJsonSchema<USchema>(model.schema);
    } catch (err) {
      console.log(
        `Failed to build $jsonSchema for collection ${model.collectionName} with shema:\n${JSON.stringify(
          model.schema
        )}`
      );
      throw err;
    }
    // d(validator.$jsonSchema);
  });

  model.post('insertOneError', async (operation, originalDocument) => {
    const error = operation.get('error');
    if (!error || error.code !== 121) {
      return;
    }
    const {validator} = model.collectionOptions as CollectionCreateOptions;
    const document = operation.get('document') || originalDocument;
    // @ts-expect-error mongodb typing
    const errors = validateSchema(document, validator!.$jsonSchema as JsonSchema);
    if (errors.length > 1) {
      throw createValidationMultipleError(errors);
    } else if (errors.length === 1) {
      throw errors[0];
    }
  });

  model.post('updateOneError', async (operation, filter, originalUpdate) => {
    const error = operation.get('error');
    if (!error || error.code !== 121) {
      return;
    }
    const {validator} = model.collectionOptions as CollectionCreateOptions;
    const update = operation.get('update') || originalUpdate;
    const prevDoc = await model.findOne(filter);
    if (!prevDoc) {
      return;
    }
    const nextDoc = applyUpdate(prevDoc, update);
    // @ts-expect-error mongodb typing
    const errors = validateSchema(nextDoc, validator!.$jsonSchema as JsonSchema);
    if (errors.length > 1) {
      throw createValidationMultipleError(errors);
    } else if (errors.length === 1) {
      throw errors[0];
    }
  });
};

const applyUpdate = (object: AnySchema, update: FilterQuery<AnySchema>) => {
  const res = cloneDeep(object);
  if (update.$set) {
    Object.keys(update.$set).forEach((field) => set(res, field, update.$set[field]));
  }
  if (update.$unset) {
    Object.keys(update.$unset).forEach((field) => {
      if (update.$unset[field]) {
        unset(res, field);
      }
    });
  }
  if (update.$rename) {
    Object.keys(update.$rename).forEach((field) => {
      set(res, update.$rename[field], get(object, field));
      unset(res, field);
    });
  }
  if (update.$push) {
    Object.keys(update.$push).forEach((field) => {
      set(res, field, get(object, field, []).concat(update.$push[field]));
    });
  }
  return res;
};

const isValidBsonType = (type: BsonType, value: unknown): boolean => {
  switch (type) {
    case 'bool':
      return typeof value === 'boolean';
    case 'string':
      return typeof value === 'string';
    case 'date':
      return value instanceof Date;
    case 'int':
      return value instanceof Int32 || Number.isFinite(value);
    case 'decimal':
      return value instanceof Decimal128 || Number.isFinite(value);
    case 'objectId':
      return value instanceof ObjectId;
    case 'double':
      return value instanceof Double || Number.isFinite(value);
    case 'object':
      return isPlainObject(value);
    case 'array':
      return Array.isArray(value);
    default:
      throw new Error(`Unsupported BsonType="${type}"`);
  }
};

// function assertIsDefined(maybeDefined: unknown): asserts maybeDefined {
//   if (typeof maybeDefined === 'undefined') {
//     throw new AssertionError({message: 'value is undefined'});
//   }
// }

const isDefined = (maybeDefined: unknown): boolean => typeof maybeDefined !== 'undefined';

const createValidationError = (message: string) => {
  const error = new MongoError(message);
  error.code = 121;
  return error;
};

const createValidationMultipleError = (errors: Error[]) => {
  const messages = errors.reduce((soFar, error) => {
    return soFar ? `${soFar}\n- ${error.message}` : `- ${error.message}`;
  }, '');
  return createValidationError(`JsonSchema validation failed with ${errors.length} errors:\n${messages}`);
};

const createRuleValidationError = (rule: {[s: string]: any}, value: unknown, path: string) => {
  const ruleName = Object.keys(rule)[0];
  return createValidationError(
    `Failed validation of jsonSchema rule=${chalkString(ruleName)} at path=${chalkString(
      path
    )} with stringified value=${chalkJson(value)}, expected rule=${chalkJson(rule[ruleName])}`
  );
};

const validateSchema = (value: any, schema: JsonSchema, path: string = '', errors: Error[] = []): Error[] => {
  // d({value, schema});
  const {
    bsonType,
    required,
    properties,
    enum: _enum,
    minItems,
    pattern,
    maxItems,
    minLength,
    maxLength,
    items,
    additionalProperties
    // ...otherProps
  } = schema;

  if (isDefined(bsonType)) {
    if (!isValidBsonType(bsonType, value)) {
      throw createRuleValidationError({bsonType}, value, path);
    }
  }
  if (Array.isArray(_enum)) {
    if (!_enum.includes(value)) {
      errors.push(createRuleValidationError({enum: _enum}, value, path));
    }
  }
  if (isDefined(minItems)) {
    if (!Array.isArray(value) || value.length < minItems!) {
      errors.push(createRuleValidationError({minItems}, value, path));
    }
  }
  if (isDefined(maxItems)) {
    if (!Array.isArray(value) || value.length > maxItems!) {
      errors.push(createRuleValidationError({maxItems}, value, path));
    }
  }
  if (isDefined(minLength)) {
    if (!isString(value) || value.length < minLength!) {
      errors.push(createRuleValidationError({minLength}, value, path));
    }
  }
  if (isDefined(maxLength)) {
    if (!isString(value) || value.length > maxLength!) {
      errors.push(createRuleValidationError({maxLength}, value, path));
    }
  }
  if (isDefined(pattern)) {
    if (isDefined(value) && (!isString(value) || !value.match(pattern!))) {
      errors.push(createRuleValidationError({pattern}, value, path));
    }
  }
  if (Array.isArray(required)) {
    required.forEach((propName) => {
      if (isUndefined(value[propName])) {
        errors.push(createRuleValidationError({required: true}, undefined, path ? `${path}.${propName}` : propName));
      }
    });
  }
  if (properties && isPlainObject(properties)) {
    const schemaPropNames = Object.keys(properties);
    schemaPropNames.forEach((propName) => {
      if (!isUndefined(value[propName])) {
        validateSchema(value[propName], properties[propName], path ? `${path}.${propName}` : propName, errors);
      }
      // return soFar.concat(validateSchema(value[key], schema[key], key));
    });
    if (additionalProperties === false) {
      Object.keys(value).forEach((propName) => {
        if (!schemaPropNames.includes(propName)) {
          errors.push(
            createRuleValidationError(
              {additionalProperties: false},
              {[propName]: value[propName]},
              path ? `${path}.${propName}` : propName
            )
          );
        }
      });
    }
  }
  if (items && isPlainObject(items)) {
    if (Array.isArray(value)) {
      value.forEach((itemValue, index) => {
        validateSchema(
          itemValue,
          items as JsonSchemaProperty<unknown>,
          path ? `${path}[${index}]` : `[${index}]`,
          errors
        );
      });
    }
  }
  if (items && Array.isArray(items)) {
    throw new Error(`@TODO Unsupported array items rule`);
  }
  // if (Object.keys(otherProps).length > 0) {
  //   d('out', {otherProps, path});
  // }
  return errors;
};
