// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types

import {get, set, isPlainObject, map, keyBy, isUndefined, isString} from 'lodash';
import {uniqWithObjectIds} from './../utils/objectId';
// @types
import {Model, OperationMap, mapPathValues} from '..';

import {FilterQuery} from 'mongodb';

interface FindOneOptions {
  population?: {[s: string]: number | boolean};
}

// Helper recursively parsing schema to find path where values should be casted
export default function autoCastingPlugin<TSchema>(model: Model<TSchema>) {
  const propsWithRefs = new Map();
  model.post('initialize:property', (prop: {[s: string]: any}, path: string) => {
    if (isString(prop) || isUndefined(prop.ref)) {
      return;
    }
    propsWithRefs.set(path, prop.ref);
  });
  // Handle find
  // model.pre('find', (filter: FilterQuery<TSchema>, options: FindOneOptions, operation: OperationMap) => {
  //   d({options});
  // });
  model.post('findMany', async (filter: FilterQuery<TSchema>, options: FindOneOptions, operation: OperationMap) => {
    if (!options.population) {
      return;
    }
    const population = options.population;
    const result = operation.get('result');
    await Object.keys(population).reduce(async (soFar, key) => {
      await soFar;
      if (!propsWithRefs.has(key)) {
        return;
      }
      // @TODO handle arrays
      const ref = propsWithRefs.get(key);
      const uniqueIds = uniqWithObjectIds(map(result, key).filter(Boolean));
      const projection = isPlainObject(population[key]) ? population[key] : {};
      const resolvedChildren = await model.otherModel(ref).find({_id: {$in: uniqueIds}}, {projection});
      const resolvedChildrenMap = keyBy(resolvedChildren, '_id');
      // Actually populate
      result.map(doc => {
        if (doc[key]) {
          doc[key] = resolvedChildrenMap[doc[key].toString()] || null;
        }
      });
    }, Promise.resolve());
  });
  model.post('findOne', async (filter: FilterQuery<TSchema>, options: FindOneOptions, operation: OperationMap) => {
    if (!options.population) {
      return;
    }
    const population = options.population;
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
      // @TODO handle arrays
      const ref = propsWithRefs.get(key);
      const refValue = get(result, key);
      const isArrayValue = Array.isArray(refValue);
      const projection = isPlainObject(population[key]) ? population[key] : {};
      const resolvedChildren = await model
        .otherModel(ref)
        [isArrayValue ? 'find' : 'findOne']({_id: isArrayValue ? {$in: refValue} : refValue}, {projection});
      // Actually populate
      set(result, key, resolvedChildren);
    }, Promise.resolve());
  });
}
