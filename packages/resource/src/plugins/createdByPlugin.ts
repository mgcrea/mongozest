// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types

// import createError from 'http-errors';
// @types
import {Resource, OperationMap} from '..';
import {Request} from 'express';
import {CollectionInsertOneOptions, CommonOptions, FilterQuery, FindOneOptions, UpdateQuery} from 'mongodb';
import {BaseSchema} from '@mongozest/core';

// Handle schema defaults
export default function schemaProjectionPlugin<TSchema extends BaseSchema>(
  resource: Resource<TSchema>,
  {idKey = '_id', createdByKey = 'createdBy', updatedByKey = 'updatedBy'} = {}
): void {
  resource.pre('postCollection', (document: TSchema, _options: CollectionInsertOneOptions, operation: OperationMap) => {
    const req: Request = operation.get('request');
    if (req.user && req.user[idKey]) {
      document[createdByKey] = req.user[idKey];
      document[updatedByKey] = req.user[idKey];
    }
  });
  resource.pre(
    'patchCollection',
    (_filter: FilterQuery<TSchema>, update: UpdateQuery<TSchema>, _options: CommonOptions, operation: OperationMap) => {
      const req: Request = operation.get('request');
      if (req.user && req.user[idKey]) {
        if (!update.$set) {
          update.$set = {};
        }
        update.$set[updatedByKey] = req.user[idKey];
      }
    }
  );
  resource.pre(
    'patchDocument',
    (filter: FilterQuery<TSchema>, update: UpdateQuery<TSchema>, options: FindOneOptions, operation: OperationMap) => {
      const req: Request = operation.get('request');
      if (req.user && req.user[idKey]) {
        if (!update.$set) {
          update.$set = {};
        }
        update.$set[updatedByKey] = req.user[idKey];
      }
    }
  );
}
