// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types

import { DefaultSchema, Model } from '@mongozest/core';
import { get, isFunction, isString, isUndefined } from 'lodash';
import { MongoError } from 'mongodb';

type ValidationErrors = Array<{ error: string; path: string; message?: string }>;

const formatValidationErrors = (errors: ValidationErrors) => {
  return errors
    .map(({ error, path, message }) => {
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

// Handle schema defaults
export const schemaValidationPlugin = <TSchema extends DefaultSchema>(model: Model<TSchema>): void => {
  const propsWithValidation: Map<string, any> = new Map();
  // const propsWithPattern: Map<string, any> = new Map();
  model.post('initialize:property', (prop, path) => {
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
  });
  // Handle document insertion
  model.pre('validate', (operation, doc) => {
    const validationErrors: ValidationErrors = [];

    // Check props with custom validation
    propsWithValidation.forEach((validateOption, path) => {
      const value = get(doc, path);
      const [validator, message] = validateOption;
      if (value && !validator(value)) {
        validationErrors.push({ error: 'validate', path, message });
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
