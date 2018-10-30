// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types

import {get, has, set, isString, isUndefined, isFunction} from 'lodash';
// @types
import {Model} from '..';
import {FilterQuery, FindOneOptions} from 'mongodb';

// Handle schema defaults
export default function schemaProjectionPlugin(model: Model, {ignoredKeys = ['_id']} = {}) {
  const propsWithProjection: Map<string, number> = new Map();
  model.post('initialize:property', (prop: {[s: string]: any} | string, path: string) => {
    if (isString(prop) || isUndefined(prop.select)) {
      return;
    }
    propsWithProjection.set(path, prop.select ? 1 : 0);
  });
  // Handle document insertion
  model.pre('find', (query: FilterQuery<TSchema>, options: FindOneOptions) => {
    if (!options.projection) {
      options.projection = {};
    }
    propsWithProjection.forEach((defaultProjection, path) => {
      if (!has(options.projection, path)) {
        set(options.projection, path, defaultProjection);
      }
    });
  });
}
