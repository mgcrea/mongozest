// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types

import {isUndefined, has, get, isString, isFunction} from 'lodash';
// @types
import {Model, defaultPathValues} from '..';

const getDefault = (defaultOption: any) => {
  return isFunction(defaultOption) ? defaultOption.call(null) : defaultOption;
};

type ValidationErrors = Array<{error: string; path: string; message?: string}>;

const formatValidationErrors = (errors: ValidationErrors) => {
  return errors
    .map(({error, path, message}) => {
      switch (error) {
        case 'required':
          return `  - "${path}" is required`;
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
export default function schemaValidationPlugin(model: Model, {ignoredKeys = ['_id']} = {}) {
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
    if (!isUndefined(prop.pattern)) {
      propsWithPattern.set(path, new RegExp(prop.pattern));
    }
  });
  // Handle document insertion
  model.pre('validate', (doc: T) => {
    const validationErrors: ValidationErrors = [];

    // Check required props
    const {validator} = model.collectionOptions;
    if (validator && validator.$jsonSchema) {
      const {required: requiredProps} = validator.$jsonSchema;
      requiredProps.forEach((path: string) => {
        if (!has(doc, path)) {
          validationErrors.push({error: 'required', path});
        }
      });
    }

    // Check props with pattern
    propsWithPattern.forEach((patternOption, path) => {
      const value = get(doc, path);
      if (value && !patternOption.test(value)) {
        d({patternOption, value, length: value.length});
        validationErrors.push({error: 'pattern', path});
      }
    });

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
      throw new Error(`MongoZestError: Document failed validation\n${message}\n`);
    }
  });
}
