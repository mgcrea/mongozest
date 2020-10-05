// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types

import {DefaultSchema, Model} from '@mongozest/core';
import {difference, get, has, isFunction, isString, isUndefined} from 'lodash';
import {MongoError} from 'mongodb';

type ValidationErrors = Array<{error: string; path: string; message?: string}>;

const formatValidationErrors = (errors: ValidationErrors) => {
  return errors
    .map(({error, path, message}) => {
      switch (error) {
        case 'required':
          return `  - "${path}" is required`;
        case 'extraneous':
          return `  - "${path}" is extraneous`;
        case 'pattern':
          return `  - "${path}" does not match pattern`;
        case 'validate':
          return `  - "${path}" does not pass validate function${message ? ` (${message})` : ''}`;
        default:
          return '';
      }
    })
    .join('\n');
};

export type SchemaValidationPluginOptions = {
  validateJsonSchema?: boolean;
};

// Handle schema defaults
export const schemaValidationPlugin = <TSchema extends DefaultSchema>(
  model: Model<TSchema>,
  {validateJsonSchema = true}: SchemaValidationPluginOptions = {}
): void => {
  const propsWithValidation: Map<string, any> = new Map();
  const propsWithPattern: Map<string, any> = new Map();
  model.post('initialize:property', (prop: {[s: string]: any} | string, path: string) => {
    if (isString(prop)) {
      return;
    }
    if (!isUndefined(prop.validate)) {
      const [validator, message] = Array.isArray(prop.validate) ? prop.validate : [prop.validate, ''];
      if (!isFunction(validator)) {
        throw new Error('Expected "validate" to be a function');
      }
      propsWithValidation.set(path, [validator, message]);
    }
    if (validateJsonSchema && !isUndefined(prop.pattern)) {
      propsWithPattern.set(path, new RegExp(prop.pattern));
    }
  });
  // Handle document insertion
  model.pre('validate', (operation, doc) => {
    const validationErrors: ValidationErrors = [];

    const isUpdate = ['updateOne', 'updateMany', 'findOneAndUpdate'].includes(operation.get('method'));

    // update or not? // @TODO
    if (validateJsonSchema) {
      // Check required props
      const {validator} = model.collectionOptions;
      // @ts-expect-error $jsonSchema missing in CollectionCreateOptions
      if (validator && validator.$jsonSchema) {
        const {
          required: requiredProps,
          additionalProperties: allowsAdditionalProps,
          properties: props
          // @ts-expect-error $jsonSchema missing in CollectionCreateOptions
        } = validator.$jsonSchema;
        if (!isUpdate) {
          requiredProps.forEach((path: string) => {
            if (!has(doc, path)) {
              validationErrors.push({error: 'required', path});
            }
          });
        }
        if (!allowsAdditionalProps && !isUpdate) {
          // @TODO support isUpdate with $set positional in arrays
          const additionalProps = difference(Object.keys(doc), Object.keys(props));
          if (additionalProps.length) {
            additionalProps.forEach((path) => {
              validationErrors.push({error: 'extraneous', path});
            });
          }
        }
        // @TODO handle nested schemas
      }

      // Check props with pattern
      propsWithPattern.forEach((patternOption, path) => {
        const value = get(doc, path);
        if (value && !patternOption.test(value)) {
          validationErrors.push({error: 'pattern', path});
        }
      });
    }

    // Check props with custom validation
    propsWithValidation.forEach((validateOption, path) => {
      const value = get(doc, path);
      const [validator, message] = validateOption;
      if (value && !validator(value)) {
        validationErrors.push({error: 'validate', path, message});
      }
    });

    if (validationErrors.length) {
      const message = formatValidationErrors(validationErrors);
      // Fake MongoError for now...
      const error = new MongoError(
        `Document failed validation on collection "${model.collectionName}" :\n${message}\n`
      );
      error.code = 121;
      throw error;
    }
  });
};
