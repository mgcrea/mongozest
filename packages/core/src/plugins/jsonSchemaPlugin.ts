// @docs https://docs.mongodb.com/manual/reference/operator/query/jsonSchema/

import {isString, pick, omit} from 'lodash';

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

export default function jsonSchemaPlugin(model, options) {
  // @TODO refactor to decouple initialSchema override
  const buildJsonSchemaFromObject = (schema, options = {}) => {
    const initialObjectSchema = {
      bsonType: 'object',
      additionalProperties: false,
      properties: {},
      ...options
    };
    return Object.keys(schema).reduce((soFar, key) => {
      // Add support for string shortcut
      const value = isString(schema[key]) ? {bsonType: schema[key]} : schema[key];
      const {bsonType, required, properties: childProperties, items: childItems, ...otherProps} = value;
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
      if (isNestedObjectSchema) {
        soFar.properties[key] = buildJsonSchemaFromObject(childProperties, validJsonKeys);
        return soFar;
      }
      // Nested arrayItems case
      const isNestedArrayItems = bsonType === 'array' && childItems;
      if (isNestedArrayItems) {
        const isNestedObjectInArray = childItems.bsonType === 'object' && childItems.properties;
        const validItemsJsonKeys = pick(omit(childItems, 'properties'), JSON_SCHEMA_VALID_KEYS);
        if (isNestedObjectInArray) {
          soFar.properties[key] = {
            bsonType,
            items: buildJsonSchemaFromObject(childItems.properties, validItemsJsonKeys),
            ...validJsonKeys
          };
          return soFar;
        } else {
          // Special array leaf case
          soFar.properties[key] = {
            bsonType,
            items: validItemsJsonKeys,
            ...validJsonKeys
          };
          return soFar;
        }
      }
      // Generic leaf case
      soFar.properties[key] = {bsonType, ...validJsonKeys};
      return soFar;
    }, initialObjectSchema);
  };

  model.pre('initialize', () => {
    // Check for pre-existing validators
    if (!model.collectionOptions.validator) {
      model.collectionOptions.validator = {};
    }
    const {validator} = model.collectionOptions;
    // Add _id unique key if missing
    if (!model.schema._id) {
      model.schema._id = {bsonType: 'objectId'};
    }
    // Set model validator schema
    try {
      validator.$jsonSchema = buildJsonSchemaFromObject(model.schema);
    } catch (err) {
      d(model.schema);
    }
    // d(validator.$jsonSchema);
  });
}