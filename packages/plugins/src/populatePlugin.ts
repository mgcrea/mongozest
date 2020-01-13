// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types

import {get, set, isPlainObject, map, keyBy, isUndefined, isEmpty, isString} from 'lodash';
import {uniqWithObjectIds} from '@mongozest/core';
// @types
import {Model, OperationMap, mapPathValues} from '..';

import {FilterQuery} from 'mongodb';

interface FindOneOptions {
  population?: {[s: string]: number | boolean};
}

// @NOTE hybrid projection is allowed with _id field
const isExcludingProjection = (projection: {[s: string]: any}) =>
  Object.keys(projection).some(key => key !== '_id' && !projection[key]);

// Helper recursively parsing schema to find path where values should be casted
export default function autoCastingPlugin<TSchema>(model: Model<TSchema>) {
  const propsWithRefs = new Map();
  model.post('initialize:property', (prop: {[s: string]: any}, path: string) => {
    if (isString(prop) || isUndefined(prop.ref)) {
      return;
    }
    propsWithRefs.set(path, prop.ref);
  });
  // Automatically add missing keys
  model.pre('find', (filter: FilterQuery<TSchema>, options: FindOneOptions, operation: OperationMap) => {
    const {projection, population} = options;
    if (!population) {
      return;
    }
    if (!projection || isEmpty(projection) || isExcludingProjection(projection)) {
      return;
    }
    Object.keys(population).forEach(key => {
      if (get(projection, key) !== 1) {
        set(projection, key, 1);
      }
    });
  });

  model.post('findMany', async (filter: FilterQuery<TSchema>, options: FindOneOptions, operation: OperationMap) => {
    const {population} = options;
    if (!population) {
      return;
    }
    const result = operation.get('result');
    await Object.keys(population).reduce(async (soFar, key) => {
      await soFar;
      if (!propsWithRefs.has(key)) {
        return;
      }
      const ref = propsWithRefs.get(key);
      const uniqueIds = uniqWithObjectIds(map(result, key).filter(Boolean));
      const childProjectionExcludesIds = isPlainObject(population[key]) && population[key]._id === 0;
      const childProjection = isPlainObject(population[key]) ? {...population[key], _id: 1} : {};
      const resolvedChildren = await model.otherModel(ref).find({_id: {$in: uniqueIds}}, {projection: childProjection});
      const resolvedChildrenMap = keyBy(resolvedChildren, '_id');
      // Tweak references to exclude _ids
      if (childProjectionExcludesIds) {
        resolvedChildren.forEach(resolvedChild => {
          delete resolvedChild._id;
        });
      }
      // Actually populate
      result.map(doc => {
        if (doc[key]) {
          doc[key] = resolvedChildrenMap[doc[key].toString()] || null;
        }
      });
    }, Promise.resolve());
  });
  model.post('findOne', async (filter: FilterQuery<TSchema>, options: FindOneOptions, operation: OperationMap) => {
    const {population} = options;
    if (!population) {
      return;
    }
    const method = operation.get('method');
    const result = method === 'findOneAndUpdate' ? operation.get('result').value : operation.get('result');
    if (!result) {
      return;
    }
    await Object.keys(population).reduce(async (soFar, key) => {
      await soFar;
      if (!propsWithRefs.has(key)) {
        return;
      }
      const ref = propsWithRefs.get(key);
      const refValue = get(result, key);
      const isArrayValue = Array.isArray(refValue);
      const childProjectionExcludesIds = isPlainObject(population[key]) && population[key]._id === 0;
      const childProjection = isPlainObject(population[key]) ? {...population[key], _id: 1} : {};
      const resolvedChildren = await model
        .otherModel(ref)
        [isArrayValue ? 'find' : 'findOne'](
          {_id: isArrayValue ? {$in: refValue} : refValue},
          {projection: childProjection}
        );
      // Tweak references to exclude _ids
      if (childProjectionExcludesIds) {
        if (isArrayValue && Array.isArray(resolvedChildren)) {
          resolvedChildren.forEach(resolvedChild => {
            delete resolvedChild._id;
          });
        } else if (resolvedChildren) {
          delete resolvedChildren._id;
        }
      }
      // Actually populate
      set(result, key, resolvedChildren);
    }, Promise.resolve());
  });
}
