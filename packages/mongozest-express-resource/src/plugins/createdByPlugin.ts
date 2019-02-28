// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types

// import createError from 'http-errors';
// @types
import {Resource, OperationMap} from '..';
import {Request} from 'express';
import {CollectionInsertOneOptions, CommonOptions, FilterQuery, FindOneOptions, UpdateQuery} from 'mongodb';

// Handle schema defaults
export default function schemaProjectionPlugin<TSchema>(
  resource: Resource<TSchema>,
  {idKey = '_id', createdByKey = 'createdBy', updatedByKey = 'updatedBy'} = {}
) {
  resource.pre('postCollection', (document: TSchema, options: CollectionInsertOneOptions, operation: OperationMap) => {
    const req: Request = operation.get('request');
    if (req.user && req.user[idKey]) {
      document[createdByKey] = req.user[idKey];
    }
  });
  resource.pre(
    'patchCollection',
    (filter: FilterQuery<TSchema>, update: UpdateQuery<TSchema>, options: CommonOptions, operation: OperationMap) => {
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
