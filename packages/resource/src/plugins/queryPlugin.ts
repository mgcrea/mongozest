import {DefaultSchema} from '@mongozest/core';
import createError from 'http-errors';
import JSON5 from 'json5';
import {isEmpty, isString, mapValues, pick} from 'lodash';
import {ObjectId} from 'mongodb';
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
        return value * 1;
      default:
        return value;
    }
  };

  resource.pre('getCollection', (operation, filter, options) => {
    const req = operation.get('request');
    const whitelist = ['filter', 'limit', 'sort', 'projection', 'skip'];
    const queryOptions = mapValues(mapValues(pick(req.query, whitelist), parseQueryParam), castQueryParam);
    // Apply filter
    if (queryOptions.filter) {
      // Convert _id from string to ObjectId
      if (queryOptions.filter._id) {
        queryOptions.filter._id = new ObjectId(queryOptions.filter._id);
      }
      operation.set(
        'filter',
        isEmpty(filter) ? Object.assign(filter, queryOptions.filter) : {$and: [filter, queryOptions.filter]}
      );
    }
    // Apply projection
    if (queryOptions.projection) {
      Object.assign(options, {projection: queryOptions.projection});
    }
  });

  resource.pre('patchCollection', (operation, filter, _update, options) => {
    const req = operation.get('request');
    const whitelist = ['filter', 'projection'];
    const queryOptions = mapValues(mapValues(pick(req.query, whitelist), parseQueryParam), castQueryParam);
    // Apply filter
    if (queryOptions.filter) {
      operation.set(
        'filter',
        isEmpty(filter) ? Object.assign(filter, queryOptions.filter) : {$and: [filter, queryOptions.filter]}
      );
    }
    // Apply projection
    if (queryOptions.projection) {
      Object.assign(options, {projection: queryOptions.projection});
    }
  });

  resource.pre('getDocument', (operation, filter, options) => {
    const req = operation.get('request');
    const whitelist = ['filter', 'projection'];
    const queryOptions = mapValues(mapValues(pick(req.query, whitelist), parseQueryParam), castQueryParam);
    // Apply filter
    if (queryOptions.filter) {
      operation.set(
        'filter',
        isEmpty(filter) ? Object.assign(filter, queryOptions.filter) : {$and: [filter, queryOptions.filter]}
      );
    }
    // Apply projection
    if (queryOptions.projection) {
      Object.assign(options, {projection: queryOptions.projection});
    }
  });

  resource.pre('patchDocument', (operation, filter, _update, options) => {
    const req = operation.get('request');
    const whitelist = ['filter', 'projection'];
    const queryOptions = mapValues(mapValues(pick(req.query, whitelist), parseQueryParam), castQueryParam);
    // Apply filter
    if (queryOptions.filter) {
      operation.set(
        'filter',
        isEmpty(filter) ? Object.assign(filter, queryOptions.filter) : {$and: [filter, queryOptions.filter]}
      );
    }
    // Apply projection
    if (queryOptions.projection) {
      Object.assign(options, {projection: queryOptions.projection});
    }
  });
};
