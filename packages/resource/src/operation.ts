import {AggregationPipeline, OptionalId} from '@mongozest/core';
import {Request} from 'express';
import {FilterQuery} from 'mongodb';

export type OperationMethod =
  | 'getCollection'
  | 'postCollection'
  | 'patchCollection'
  | 'deleteCollection'
  | 'getDocument'
  | 'patchDocument'
  | 'deleteDocument'
  | 'aggregateCollection';
export type OperationScope = 'collection' | 'document';

export interface OperationMap<TSchema, TResult = any> extends Map<string | symbol, any> {
  get(key: 'method'): OperationMethod;
  get(key: 'scope'): OperationScope;
  get(key: 'result'): TResult;
  get(key: 'request'): Request;
  get(key: 'filter'): FilterQuery<TSchema>;
  get(key: 'pipeline'): AggregationPipeline;
  // get(key: 'error'): Error | undefined;
  get(key: string | symbol): any | undefined;
}
export type OperationOptions<TSchema> = {
  method: OperationMethod;
  scope: OperationScope;
  request: Request;
  filter?: FilterQuery<TSchema>;
  pipeline?: AggregationPipeline;
  document?: OptionalId<TSchema>;
};
export const createOperationMap = <TSchema>(options: OperationOptions<TSchema>): OperationMap<TSchema> => {
  const map = new Map(Object.entries(options));
  return map as OperationMap<TSchema>;
};
