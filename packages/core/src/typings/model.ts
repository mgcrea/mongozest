import { FindAndModifyWriteOpResultObject } from 'mongodb';
import { OperationMap } from '../operation';
import { UnwrapPromise } from './base';
import { AnySchema, DefaultSchema, JsonSchemaProperty } from './schema';

export type ModelHookName =
  | 'aggregate'
  | 'countDocuments'
  | 'delete'
  | 'deleteMany'
  | 'deleteOne'
  | 'distinct'
  | 'error'
  | 'find'
  | 'findMany'
  | 'findOne'
  | 'findOneAndUpdate'
  | 'findOneAndUpdateError'
  | 'initialize:property'
  | 'initialize'
  | 'insert'
  | 'insertError'
  | 'insertMany'
  | 'insertOne'
  | 'insertOneError'
  | 'replaceOne'
  | 'setup'
  | 'update'
  | 'updateError'
  | 'updateMany'
  | 'updateOne'
  | 'updateOneError'
  | 'validate';

declare module '../model' {
  interface Model<TSchema extends AnySchema = DefaultSchema> {
    // pre
    pre(
      hookName: 'aggregate',
      callback: (operation: OperationMap<TSchema>, ...args: Parameters<Model<TSchema>['aggregate']>) => void
    ): void;
    pre(
      hookName: 'find' | 'findOne',
      callback: (operation: OperationMap<TSchema>, ...args: Parameters<Model<TSchema>['findOne']>) => void
    ): void;
    pre(
      hookName: 'findMany',
      callback: (operation: OperationMap<TSchema>, ...args: Parameters<Model<TSchema>['findOne']>) => void
    ): void;
    pre(
      hookName: 'findOneAndUpdate',
      callback: (operation: OperationMap<TSchema>, ...args: Parameters<Model<TSchema>['findOneAndUpdate']>) => void
    ): void;
    pre(
      hookName: 'update' | 'updateOne',
      callback: (operation: OperationMap<TSchema>, ...args: Parameters<Model<TSchema>['updateOne']>) => void
    ): void;
    pre(
      hookName: 'updateMany',
      callback: (operation: OperationMap<TSchema>, ...args: Parameters<Model<TSchema>['updateMany']>) => void
    ): void;
    pre(
      hookName: 'insert' | 'insertOne',
      callback: (operation: OperationMap<TSchema>, ...args: Parameters<Model<TSchema>['insertOne']>) => void
    ): void;
    pre(
      hookName: 'replaceOne',
      callback: (operation: OperationMap<TSchema>, ...args: Parameters<Model<TSchema>['replaceOne']>) => void
    ): void;
    pre(
      hookName: 'insertMany',
      callback: (operation: OperationMap<TSchema>, ...args: Parameters<Model<TSchema>['insertMany']>) => void
    ): void;
    pre(
      hookName: 'delete' | 'deleteOne',
      callback: (operation: OperationMap<TSchema>, ...args: Parameters<Model<TSchema>['deleteOne']>) => void
    ): void;
    pre(
      hookName: 'deleteMany',
      callback: (operation: OperationMap<TSchema>, ...args: Parameters<Model<TSchema>['deleteMany']>) => void
    ): void;
    pre(
      hookName: 'validate',
      callback: (operation: OperationMap<TSchema>, ...args: Parameters<Model<TSchema>['insertOne']>) => void
    ): void;
    // post
    post(
      hookName: 'aggregate',
      callback: (operation: OperationMap<TSchema, TSchema[]>, ...args: Parameters<Model<TSchema>['aggregate']>) => void
    ): void;
    post(
      hookName: 'find' | 'findOne',
      callback: (
        operation: OperationMap<TSchema, TSchema | null>,
        ...args: Parameters<Model<TSchema>['findOne']>
      ) => void
    ): void;
    post(
      hookName: 'findMany',
      callback: (operation: OperationMap<TSchema, TSchema[]>, ...args: Parameters<Model<TSchema>['findOne']>) => void
    ): void;
    post(
      hookName: 'insert' | 'insertOne',
      callback: (
        operation: OperationMap<TSchema, UnwrapPromise<ReturnType<Model<TSchema>['insertOne']>>>,
        ...args: Parameters<Model<TSchema>['insertOne']>
      ) => void
    ): void;
    post(
      hookName: 'insertError' | 'insertOneError',
      callback: (operation: OperationMap<TSchema>, ...args: Parameters<Model<TSchema>['insertOne']>) => void
    ): void;
    post(
      hookName: 'update' | 'updateOne',
      callback: (
        operation: OperationMap<TSchema, UnwrapPromise<ReturnType<Model<TSchema>['updateOne']>>>,
        ...args: Parameters<Model<TSchema>['updateOne']>
      ) => void
    ): void;
    post(
      hookName: 'updateError' | 'updateOneError',
      callback: (operation: OperationMap<TSchema>, ...args: Parameters<Model<TSchema>['updateOne']>) => void
    ): void;
    post(
      hookName: 'delete' | 'deleteOne',
      callback: (
        operation: OperationMap<TSchema, UnwrapPromise<ReturnType<Model<TSchema>['deleteOne']>>>,
        ...args: Parameters<Model<TSchema>['deleteOne']>
      ) => void
    ): void;
    post(
      hookName: 'deleteMany',
      callback: (
        operation: OperationMap<TSchema, UnwrapPromise<ReturnType<Model<TSchema>['deleteMany']>>>,
        ...args: Parameters<Model<TSchema>['deleteMany']>
      ) => void
    ): void;
    post(
      hookName: 'findOneAndUpdate',
      callback: (
        operation: OperationMap<TSchema, FindAndModifyWriteOpResultObject<TSchema>>,
        ...args: Parameters<Model<TSchema>['findOneAndUpdate']>
      ) => void
    ): void;
    post(hookName: 'initialize', callback: () => void): void;
    post(hookName: 'initialize:property', callback: (property: JsonSchemaProperty, path: string) => void): void;
  }
}
