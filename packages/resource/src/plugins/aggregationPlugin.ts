import {AggregationPipeline, DefaultSchema} from '@mongozest/core';
import {Request, Response, Router} from 'express';
import createError from 'http-errors';
import JSON5 from 'json5';
import {isEmpty, isString} from 'lodash';
import {CollectionAggregationOptions, FilterQuery} from 'mongodb';
import {createOperationMap} from '../operation';
import {Resource} from '../resource';
import {asyncHandler} from '../utils/request';

export const aggregationPlugin = <TSchema extends DefaultSchema = DefaultSchema>(
  resource: Resource<TSchema>,
  {strictJSON = false, pipelineParamName = 'pipeline', pathName = 'aggregate'} = {}
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
      case pipelineParamName:
        return Array.isArray(value) ? value : [value];
      default:
        return value;
    }
  };

  async function aggregateCollection(this: Resource<TSchema>, req: Request, res: Response) {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const pipeline: AggregationPipeline = castQueryParam(
      parseQueryParam(req.query[pipelineParamName], pipelineParamName),
      pipelineParamName
    );
    const filter: FilterQuery<TSchema> = await this.buildRequestFilter(req);
    const options: CollectionAggregationOptions = {};
    const operation = createOperationMap<TSchema>({
      method: 'aggregateCollection',
      scope: 'collection',
      request: req,
      pipeline,
      filter
    });
    // Execute preHooks
    await this.hooks.execPre('filter', [operation, filter]);
    if (!isEmpty(operation.get('filter'))) {
      operation.set(
        'pipeline',
        ([{$match: operation.get('filter')}] as AggregationPipeline).concat(operation.get('pipeline'))
      );
    }
    await this.hooks.execPre('aggregateCollection', [operation, pipeline, options]);
    // Actual mongo call
    const result = await model.aggregate(operation.get('pipeline'), options);
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execPost('aggregateCollection', [operation, operation.get('pipeline'), options]);
    res.json(operation.get('result'));
  }

  resource.pre('buildPath', (router: Router, path: string) => {
    router.get(`${path}/${pathName}`, asyncHandler(aggregateCollection.bind(resource)));
  });
};
