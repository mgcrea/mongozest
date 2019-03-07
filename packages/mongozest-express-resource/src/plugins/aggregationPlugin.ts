// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types

import JSON5 from 'json5';
import createError from 'http-errors';
import {get, pick, map, keyBy, mapValues, isString, isEmpty} from 'lodash';
// import {uniqWithObjectIds} from './../utils/objectId';
import {asyncHandler} from 'src/utils/request';
// @types
import {Resource, OperationMap, AggregationPipeline} from '..';
import {CollectionAggregationOptions} from 'mongodb';
import {Request, Response, Router} from 'express';

export default function aggregationPlugin<TSchema>(
  resource: Resource<TSchema>,
  {strictJSON = false, optionName = 'pipeline'} = {}
) {
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
      case 'pipeline':
        return Array.isArray(value) ? value : [value];
      default:
        return value;
    }
  };

  async function buildRequestPipeline(this: Resource<TSchema>, req: Request): Promise<AggregationPipeline> {
    // const model = this.getModelFromRequest(req);
    // const {ids, params} = this;
    const whitelist = ['pipeline'];
    const queryOptions = mapValues(mapValues(pick(req.query, whitelist), parseQueryParam), castQueryParam);
    return queryOptions.pipeline || [];
  }

  // resource.pre(
  //   'aggregateCollection',
  //   (pipeline: Array<Object>, options: CollectionAggregationOptions, operation: OperationMap) => {
  //     const req: Request = operation.get('request');
  //     const whitelist = ['pipeline'];
  //     const queryOptions = mapValues(mapValues(pick(req.query, whitelist), parseQueryParam), castQueryParam);
  //     // Apply pipeline
  //     if (queryOptions.pipeline) {
  //       operation.set('pipeline', queryOptions.pipeline);
  //     }
  //   }
  // );

  async function aggregateCollection(this: Resource<TSchema>, req: Request, res: Response) {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const pipeline: Array<Object> = await buildRequestPipeline.bind(this)(req);
    const options: CollectionAggregationOptions = {};
    // @ts-ignore
    const operation: OperationMap = new Map([
      ['method', 'aggregateCollection'],
      ['scope', 'collection'],
      ['request', req],
      ['pipeline', pipeline]
    ]);
    // Execute preHooks
    await this.hooks.execManyPre(['pipeline', 'aggregateCollection'], [pipeline, options, operation]);
    // Actual mongo call
    const result = await model.aggregate(operation.get('pipeline'), options);
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execPost('getCollection', [operation.get('filter'), options, operation]);
    res.json(operation.get('result'));
  }

  resource.pre('buildPath', (router: Router, path: string) => {
    router.get(`${path}/aggregate`, asyncHandler(aggregateCollection.bind(resource)));
  });
}

// [{$group: {_id: {mission: "$mission"}, count: {$sum: 1}}}]
// [{$group: {_id: {mission: "$mission"}, count: {$sum: 1}}}, {$project: {_id: 0, mission: "$_id.mission", count: 1}}]
