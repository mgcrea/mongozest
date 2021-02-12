import { DefaultSchema } from '@mongozest/core';
import { ObjectId } from 'mongodb';
import { Resource } from '../resource';

export type CreatedByPluginSchema = {
  createdBy: ObjectId;
  updatedBy: ObjectId;
};

export const createdByPlugin = <
  TSchema extends DefaultSchema & CreatedByPluginSchema = DefaultSchema & CreatedByPluginSchema
>(
  resource: Resource<TSchema>,
  { idKey = '_id', createdByKey = 'createdBy', updatedByKey = 'updatedBy' } = {}
): void => {
  resource.pre('postCollection', (operation) => {
    const document = operation.get('document');
    const req = operation.get('request');
    if (req.user && req.user[idKey as '_id']) {
      document[createdByKey as 'createdBy'] = req.user[idKey as '_id'];
      document[updatedByKey as 'updatedBy'] = req.user[idKey as '_id'];
    }
  });
  resource.pre('patchCollection', (operation, _filter, update) => {
    const req = operation.get('request');
    if (req.user && req.user[idKey as '_id']) {
      if (!update.$set) {
        update.$set = {};
      }
      Object.assign(update.$set, { [updatedByKey as 'updatedBy']: req.user[idKey as '_id'] });
    }
  });
  resource.pre('patchDocument', (operation, _filter, update) => {
    const req = operation.get('request');
    if (req.user && req.user[idKey as '_id']) {
      if (!update.$set) {
        update.$set = {};
      }
      Object.assign(update.$set, { [updatedByKey as 'updatedBy']: req.user[idKey as '_id'] });
    }
  });
};
