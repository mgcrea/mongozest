// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types

import JSON5 from 'json5';
import createError from 'http-errors';
import {pick, mapValues, isString} from 'lodash';
// @types
import {Resource} from '..';
import {FilterQuery, FindOneOptions} from 'mongodb';
import {Request} from 'express';

// Handle schema defaults
export default function schemaProjectionPlugin(resource: Resource, {strictJSON = false} = {}) {
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
  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#find
  resource.pre('getCollection', (filter: FilterQuery<TSchema>, options: FindOneOptions, operation) => {
    const req: Request = operation.get('request');
    const whitelist = ['filter', 'limit', 'sort', 'projection', 'skip'];
    const queryOptions = mapValues(mapValues(pick(req.query, whitelist), parseQueryParam), castQueryParam);
    // Apply filter
    if (queryOptions.filter) {
      Object.assign(filter, queryOptions.filter);
    }
    // Apply projection
    if (queryOptions.projection) {
      Object.assign(options, {projection: queryOptions.projection});
    }
  });

  resource.pre('getDocument', (filter: FilterQuery<TSchema>, options: FindOneOptions, operation) => {
    const req: Request = operation.get('request');
    const whitelist = ['filter', 'projection'];
    const queryOptions = mapValues(mapValues(pick(req.query, whitelist), parseQueryParam), castQueryParam);
    // Apply filter
    if (queryOptions.filter) {
      Object.assign(filter, queryOptions.filter);
    }
    // Apply projection
    if (queryOptions.projection) {
      Object.assign(options, {projection: queryOptions.projection});
    }
  });
  // resource.pre('postCollection', (document: TSchema, options: CollectionInsertOneOptions, operation) => {
  //   d('postCollection');
  // });
}

/*
// import JSON5 from 'json5';
// import {defaults, pick, isPlainObject, mapValues} from 'lodash';
// import createError from 'http-errors';

// export const parseQueryOptions = (req, whitelist = []) => {
//   // Only pick valid query options
//   let queryOptions = defaults(pick(req.query, whitelist), {});
//   // Parse any JSON-like options
//   queryOptions = mapValues(queryOptions, (value, key) => {
//     if (value && typeof value === 'string' && (value[0] === '{' || value[0] === '[')) {
//       try {
//         return JSON5.parse(value);
//       } catch (err) {
//         throw createError(400, `Failed to parse query field=\`${key}\``);
//       }
//     }
//     return value;
//   });
//   // Extend with req parameters
//   if (req.params && Object.keys(req.params).length) {
//     queryOptions.query = Object.assign(queryOptions.query || {}, req.params);
//   }
//   return queryOptions;
// };

// export const parseQuerySelect = req => {
//   const query = parseQueryOptions(req, ['select']);
//   if (isPlainObject(query.select)) {
//     return query.select;
//   }
//   const querySelectAsArray = !Array.isArray(query.select) ? query.select.toString().split(' ') : query.select;
//   return querySelectAsArray.reduce((soFar, value) => {
//     if (value.startsWith('+')) {
//       soFar[value.substr(1)] = 1;
//     } else if (value.startsWith('-')) {
//       soFar[value.substr(1)] = 0;
//     } else {
//       soFar[value] = 1;
//     }
//     return soFar;
//   }, {});
// };

// export const applyQueryOptions = (query, queryOptions = {}) => {
//   if (queryOptions.distinct) {
//     query.distinct(queryOptions.distinct);
//   }
//   if (queryOptions.limit > 0) {
//     query.limit(queryOptions.limit * 1);
//   }
//   if (queryOptions.select) {
//     if (Array.isArray(queryOptions.select)) {
//       query.select(queryOptions.select.join(' '));
//     } else {
//       query.select(queryOptions.select);
//     }
//   }
//   if (queryOptions.populate) {
//     query.populate(queryOptions.populate);
//   }
//   if (queryOptions.sort) {
//     query.sort(queryOptions.sort);
//   }
//   return query;
// };

*/
