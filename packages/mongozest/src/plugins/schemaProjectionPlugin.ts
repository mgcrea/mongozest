// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types

import {get, has, set, isString, isUndefined, isFunction} from 'lodash';
// @types
import {Model} from '..';
import {FilterQuery, FindOneOptions} from 'mongodb';

const isInclusiveProjection = (projection: {[s: string]: any}) =>
  Object.keys(projection).some(key => projection[key] === 1);

// Handle schema defaults
export default function schemaProjectionPlugin(model: Model, {ignoredKeys = ['_id']} = {}) {
  const propsWithProjection: Map<string, number> = new Map();
  model.post('initialize:property', (prop: {[s: string]: any} | string, path: string) => {
    if (isString(prop) || isUndefined(prop.select)) {
      return;
    }
    propsWithProjection.set(path, prop.select ? 1 : 0);
  });
  // preFind options overrides
  model.pre('find', (query: FilterQuery<TSchema>, options: FindOneOptions) => {
    // Nothing to do if we don't have props with projection
    if (!propsWithProjection.size) {
      return;
    }
    // Nothing to do if is is already an inclusive projection
    if (options.projection && isInclusiveProjection(options.projection)) {
      return;
    }
    // Define a default projection if we have none
    if (!options.projection) {
      options.projection = {};
    }
    // Define a default projection if we have none
    propsWithProjection.forEach((defaultProjection, path) => {
      if (!has(options.projection, path)) {
        set(options.projection, path, defaultProjection);
      }
    });
  });
}
