// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types

import {isUndefined, get, isString, isFunction} from 'lodash';
// @types
import {Model, defaultPathValues} from '..';

const INLINE_VARIABLE_REGEX = /\$\{(.+)\}/g;

const getDefault = (defaultOption: any, doc: any) => {
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
export default function schemaDefaultsPlugin(model: Model, {ignoredKeys = ['_id']} = {}) {
  const propsWithDefaults: Map<string, any> = new Map();
  model.post('initialize:property', (prop: {[s: string]: any} | string, path: string) => {
    if (isString(prop) || isUndefined(prop.default)) {
      return;
    }
    propsWithDefaults.set(path, prop.default);
  });
  // Handle document insertion
  model.pre('insert', (doc: T) => {
    propsWithDefaults.forEach((defaultOption, path) => {
      defaultPathValues(doc, path, () => getDefault(defaultOption, doc));
    });
  });
}
