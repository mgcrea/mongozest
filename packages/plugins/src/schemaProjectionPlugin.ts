import { DefaultSchema, Model } from '@mongozest/core';
import { has, isString, isUndefined, set } from 'lodash';

const isInclusiveProjection = (projection: Record<string, string | number | any>) =>
  Object.keys(projection).some((key) => projection[key] === 1);

export const schemaProjectionPlugin = <TSchema extends DefaultSchema>(model: Model<TSchema>): void => {
  const propsWithProjection: Map<string, number> = new Map();
  model.post('initialize:property', (prop, path) => {
    if (isString(prop) || isUndefined(prop.select)) {
      return;
    }
    propsWithProjection.set(path, prop.select ? 1 : 0);
  });
  // preFind options overrides
  model.pre('find', (_operation, _query, options = {}) => {
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
        set<any>(options.projection, path, defaultProjection);
      }
    });
  });
};
