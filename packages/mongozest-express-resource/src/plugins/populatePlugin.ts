// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types

import JSON5 from 'json5';
import createError from 'http-errors';
import {get, pick, map, keyBy, mapValues, isString} from 'lodash';
import {uniqWithObjectIds} from './../utils/objectId';
// @types
import {Resource} from '..';
import {FilterQuery, FindOneOptions} from 'mongodb';
import {Request} from 'express';

// Handle schema defaults
export default function populatePlugin(resource: Resource, {strictJSON = false} = {}) {
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
  const QUERY_OPTIONS = Symbol('QUERY_OPTIONS');
  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#find
  resource.pre('getCollection', (filter: FilterQuery<TSchema>, options: FindOneOptions, operation) => {
    const req: Request = operation.get('request');
    const whitelist = ['populate'];
    const queryOptions = mapValues(pick(req.query, whitelist), parseQueryParam);
    operation.set(QUERY_OPTIONS, queryOptions);
  });
  resource.post('getCollection', async (filter: FilterQuery<TSchema>, options: FindOneOptions, operation) => {
    const req: Request = operation.get('request');
    const model = resource.getModelFromRequest(req);
    d();
    const {populate} = operation.get(QUERY_OPTIONS);
    if (!populate) {
      return;
    }
    const result = operation.get('result');
    await Object.keys(populate).reduce(async (soFar, key) => {
      await soFar;
      // @TODO handle arrays
      const uniqueIds = uniqWithObjectIds(map(result, key).filter(Boolean));
      const ref = get(model.schema, key).ref;
      const resolvedChildren = await model.otherModel(ref).find({_id: {$in: uniqueIds}});
      const resolvedChildrenMap = keyBy(resolvedChildren, '_id');
      // Actually populate
      result.map(doc => {
        if (doc[key]) {
          doc[key] = resolvedChildrenMap[doc[key].toString()] || null;
        }
      });
    }, Promise.resolve());
  });
}
