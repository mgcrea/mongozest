// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types

import {isUndefined, get, isString, isFunction} from 'lodash';
import {Model, defaultPathValues, UnknownSchema} from '@mongozest/core';
import {OptionalId} from 'mongodb';

declare module '@mongozest/core' {
  interface JsonSchemaProperty<TProp = any> {
    default?: TProp | (() => TProp) | string;
  }
}

const INLINE_VARIABLE_REGEX = /\$\{(.+)\}/g;

const getDefault = <TSchema extends UnknownSchema>(defaultOption: any, doc: OptionalId<TSchema>) => {
  if (isFunction(defaultOption)) {
    return defaultOption.call(null);
  }
  if (isString(defaultOption)) {
    const usedInlineVariables = defaultOption.match(INLINE_VARIABLE_REGEX);
    if (usedInlineVariables) {
      return usedInlineVariables.reduce((soFar, value) => {
        const path = value.slice(2, -1);
        const resolvedValue = get(doc, path);
        if (isUndefined(resolvedValue)) {
          throw new Error(`Default resolution at path="${path}" for default="${value}" failed`);
        }
        return soFar.replace(value, resolvedValue);
      }, defaultOption);
    }
  }
  return defaultOption;
};

// Handle schema defaults
export const schemaDefaultsPlugin = <TSchema extends UnknownSchema>(model: Model<TSchema>): void => {
  const propsWithDefaults: Map<string, any> = new Map();
  model.post('initialize:property', (prop: {[s: string]: any} | string, path: string) => {
    if (isString(prop) || isUndefined(prop.default)) {
      return;
    }
    propsWithDefaults.set(path, prop.default);
  });
  // Handle document insertion
  model.pre('insert', (_operation, document) => {
    propsWithDefaults.forEach((defaultOption, path) => {
      defaultPathValues(document, path, () => getDefault<TSchema>(defaultOption, document));
    });
  });
};
