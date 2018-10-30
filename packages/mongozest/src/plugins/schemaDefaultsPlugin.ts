// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types

import {isUndefined, has, set, isString, isFunction} from 'lodash';
// @types
import {Model} from '..';

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
      if (!has(doc, path)) {
        const defaultValue = isFunction(defaultOption) ? defaultOption.call(null) : defaultOption;
        set(doc, path, defaultValue);
      }
    });
  });
}
