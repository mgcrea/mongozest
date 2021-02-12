import {DefaultSchema, FilterQuery, OperationMap, OptionalId, WithId} from '@mongozest/core';
import {
  CollectionInsertOneOptions,
  CommonOptions,
  DeleteWriteOpResultObject,
  FindOneAndUpdateOption,
  FindOneOptions,
  UpdateQuery
} from 'mongodb';

export type ResourceHookName =
  | 'buildRouter'
  | 'buildPath'
  | 'filter'
  | 'insert'
  | 'getCollection'
  | 'postCollection'
  | 'patchCollection'
  | 'deleteCollection'
  | 'getDocument'
  | 'patchDocument'
  | 'deleteDocument'
  | 'aggregateCollection';

declare module '../resource' {
  interface Resource<TSchema extends DefaultSchema> {
    // pre
    pre(hookName: 'filter', callback: (operation: OperationMap<TSchema>, filter: FilterQuery<TSchema>) => void): void;
    pre(
      hookName: 'getCollection' | 'getDocument',
      callback: (
        operation: OperationMap<TSchema>,
        filter: FilterQuery<TSchema>,
        options: FindOneOptions<TSchema extends TSchema ? TSchema : TSchema>
      ) => void
    ): void;
    pre(
      hookName: 'insert' | 'postCollection',
      callback: (
        operation: OperationMap<TSchema>,
        document: OptionalId<TSchema>,
        options: CollectionInsertOneOptions
      ) => void
    ): void;
    pre(
      hookName: 'patchCollection',
      callback: (
        operation: OperationMap<TSchema>,
        filter: FilterQuery<TSchema>,
        update: UpdateQuery<TSchema>,
        options: CommonOptions
      ) => void
    ): void;
    pre(
      hookName: 'deleteCollection',
      callback: (operation: OperationMap<TSchema>, filter: FilterQuery<TSchema>, options: CommonOptions) => void
    ): void;
    pre(
      hookName: 'patchDocument',
      callback: (
        operation: OperationMap<TSchema>,
        filter: FilterQuery<TSchema>,
        update: UpdateQuery<TSchema>,
        options: FindOneAndUpdateOption<TSchema>
      ) => void
    ): void;
    pre(
      hookName: 'deleteDocument',
      callback: (
        operation: OperationMap<TSchema>,
        filter: FilterQuery<TSchema>,
        options: CommonOptions & {bypassDocumentValidation?: boolean}
      ) => void
    ): void;
    pre(
      hookName: 'aggregateCollection',
      callback: (
        operation: OperationMap<TSchema>,
        pipeline: AggregationPipeline,
        options: CommonOptions & {bypassDocumentValidation?: boolean}
      ) => void
    ): void;
    // post
    post(
      hookName: 'getCollection',
      callback: (
        operation: OperationMap<TSchema, TSchema[]>,
        filter: FilterQuery<TSchema>,
        options: FindOneOptions<TSchema extends TSchema ? TSchema : TSchema>
      ) => void
    ): void;
    post(
      hookName: 'postCollection',
      callback: (
        operation: OperationMap<TSchema, WithId<TSchema>>,
        document: OptionalId<TSchema>,
        options: CollectionInsertOneOptions
      ) => void
    ): void;
    post(
      hookName: 'patchCollection',
      callback: (
        operation: OperationMap<TSchema, TSchema[]>,
        filter: FilterQuery<TSchema>,
        update: UpdateQuery<TSchema>,
        options: FindOneOptions<TSchema extends TSchema ? TSchema : TSchema>
      ) => void
    ): void;
    post(
      hookName: 'deleteCollection',
      callback: (
        operation: OperationMap<TSchema, DeleteWriteOpResultObject>,
        filter: FilterQuery<TSchema>,
        options: CommonOptions
      ) => void
    ): void;
    post(
      hookName: 'getDocument',
      callback: (
        operation: OperationMap<TSchema, TSchema | null>,
        filter: FilterQuery<TSchema>,
        options: FindOneOptions<TSchema extends TSchema ? TSchema : TSchema>
      ) => void
    ): void;
    post(
      hookName: 'deleteDocument',
      callback: (
        operation: OperationMap<TSchema, DeleteWriteOpResultObject['result']>,
        filter: FilterQuery<TSchema>,
        options: CommonOptions & {bypassDocumentValidation?: boolean}
      ) => void
    ): void;
    post(
      hookName: 'aggregateCollection',
      callback: (
        operation: OperationMap<TSchema, TSchema[]>,
        pipeline: AggregationPipeline,
        options: CommonOptions & {bypassDocumentValidation?: boolean}
      ) => void
    ): void;
  }
}
