// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types

// import createError from 'http-errors';
// @types
import {Resource} from '..';
import {CollectionInsertOneOptions} from 'mongodb';
import {Request} from 'express';

// Handle schema defaults
export default function schemaProjectionPlugin(resource: Resource, {idKey = '_id', createdByKey = 'createdBy'} = {}) {
  resource.pre('postCollection', (document: TSchema, options: CollectionInsertOneOptions, operation) => {
    const req: Request = operation.get('request');
    if (req.user && req.user[idKey]) {
      document[createdByKey] = req.user[idKey];
    }
  });
}
