import {DefaultSchema} from '@mongozest/core';
import createError from 'http-errors';
import JSON5 from 'json5';
import {isEmpty, isString, mapValues, pick} from 'lodash';
import {Resource} from '../resource';

export const queryPlugin = <TSchema extends DefaultSchema = DefaultSchema>(
  resource: Resource<TSchema>,
  {strictJSON = false} = {}
): void => {
  const parseQueryParam = (value: any, key: string) => {
    if (!isString(value) || !/^[\[\{]/.test(value)) {
      return value;
    }
    try {
      return (strictJSON ? JSON : JSON5).parse(value);
    } catch (err) {
      throw createError(400, `Failed to parse query field=\`${key}\``);
    }
  };
  const castQueryParam = (value: any, key: string) => {
    switch (key) {
      case 'limit':
      case 'skip':
      case 'min':
      case 'max':
        return value * 1;
      default:
        return value;
    }
  };

  resource.pre('filter', (operation) => {
    const req = operation.get('request');
    const filter = operation.get('filter');
    const queryFilter = parseQueryParam(req.query.filter, 'filter');
    if (queryFilter) {
      const nextFilter = !isEmpty(filter) ? {$and: [filter, queryFilter]} : queryFilter;
      operation.set('filter', nextFilter);
    }
  });

  resource.pre('getCollection', (operation, _filter, options) => {
    const req = operation.get('request');
    const whitelist = ['projection', 'limit', 'min', 'max', 'sort', 'skip'];
    const queryOptions = mapValues(mapValues(pick(req.query, whitelist), parseQueryParam), castQueryParam);
    Object.assign(options, queryOptions);
  });

  resource.pre('patchCollection', (operation, _filter, _update, options) => {
    const req = operation.get('request');
    const whitelist = ['projection'];
    const queryOptions = mapValues(mapValues(pick(req.query, whitelist), parseQueryParam), castQueryParam);
    Object.assign(options, queryOptions);
  });

  resource.pre('getDocument', (operation, _filter, options) => {
    const req = operation.get('request');
    const whitelist = ['projection'];
    const queryOptions = mapValues(mapValues(pick(req.query, whitelist), parseQueryParam), castQueryParam);
    Object.assign(options, queryOptions);
  });

  resource.pre('patchDocument', (operation, _filter, _update, options) => {
    const req = operation.get('request');
    const whitelist = ['projection'];
    const queryOptions = mapValues(mapValues(pick(req.query, whitelist), parseQueryParam), castQueryParam);
    Object.assign(options, queryOptions);
  });
};
