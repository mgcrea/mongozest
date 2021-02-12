import 'mongodb';
import {DefaultSchema, Model, uniqWithObjectIds} from '@mongozest/core';
import {get, isEmpty, isPlainObject, isString, isUndefined, keyBy, map, set} from 'lodash';
import {ObjectId, SchemaMember} from 'mongodb';

export type Population<T> = SchemaMember<T, number | boolean | any>;

// @NOTE hybrid projection is allowed with _id field
const isExcludingProjection = (projection: {[s: string]: any}) =>
  Object.keys(projection).some((key) => key !== '_id' && !projection[key]);

// Helper recursively parsing schema to find path where values should be casted
export const populationPlugin = <TSchema extends DefaultSchema>(model: Model<TSchema>): void => {
  const propsWithRefs = new Map();
  model.post('initialize:property', (prop: {[s: string]: any}, path: string) => {
    if (isString(prop) || isUndefined(prop.ref)) {
      return;
    }
    propsWithRefs.set(path, prop.ref);
  });
  // Automatically add missing keys
  model.pre('find', (_operation, _filter, options = {}) => {
    const {projection, population} = options;
    if (!population) {
      return;
    }
    if (!projection || isEmpty(projection) || isExcludingProjection(projection)) {
      return;
    }
    Object.keys(population).forEach((key) => {
      if (get(projection, key) !== 1) {
        set(projection, key, 1);
      }
    });
  });

  model.post('findMany', async (operation, _filter, options = {}) => {
    const {population} = options;
    if (!population) {
      return;
    }
    const result: TSchema[] = operation.get('result');
    await Object.keys(population).reduce(async (soFar, key) => {
      await soFar;
      if (!propsWithRefs.has(key)) {
        return;
      }
      const ref = propsWithRefs.get(key);
      const uniqueIds = uniqWithObjectIds(map(result, key).filter(Boolean) as ObjectId[]);
      // @ts-expect-error wtf?
      const childProjectionExcludesIds = isPlainObject(population[key]) && population[key]._id === 0;
      // @ts-expect-error wtf?
      const childProjection = isPlainObject(population[key]) ? {...population[key], _id: 1} : {};
      const resolvedChildren = await model
        .otherModel(ref)!
        .find({_id: {$in: uniqueIds}}, {projection: childProjection});
      const resolvedChildrenMap = keyBy(resolvedChildren, '_id');
      // Tweak references to exclude _ids
      if (childProjectionExcludesIds) {
        resolvedChildren.forEach((resolvedChild) => {
          delete (resolvedChild as Partial<DefaultSchema>)._id;
        });
      }
      // Actually populate
      result.map((doc) => {
        if (doc[key]) {
          Object.assign(doc, {[key]: resolvedChildrenMap[(doc[key] as ObjectId).toString()] || null});
        }
      });
    }, Promise.resolve());
  });
  model.post('findOne', async (operation, _filter, options = {}) => {
    const {population} = options;
    if (!population) {
      return;
    }
    const result = operation.get('result');
    if (!result) {
      return;
    }
    await Object.keys(population).reduce(async (soFar, key) => {
      await soFar;
      if (!propsWithRefs.has(key)) {
        return;
      }
      const ref = propsWithRefs.get(key);
      const refValue = get(result, key) as ObjectId | ObjectId[];
      const isArrayValue = Array.isArray(refValue);
      // @ts-expect-error wtf?
      const childProjectionExcludesIds = isPlainObject(population[key]) && population[key]._id === 0;
      // @ts-expect-error wtf?
      const childProjection = isPlainObject(population[key]) ? {...population[key], _id: 1} : {};

      if (isArrayValue) {
        const resolvedChildren = await model
          .otherModel(ref)!
          .find({_id: {$in: refValue as ObjectId[]}}, {projection: childProjection});
        // Tweak references to exclude _ids
        if (childProjectionExcludesIds && Array.isArray(resolvedChildren)) {
          resolvedChildren.forEach((resolvedChild) => {
            delete (resolvedChild as Partial<DefaultSchema>)._id;
          });
        }
        // Actually populate
        set(result, key, resolvedChildren);
        return;
      }

      const resolvedChild = await model
        .otherModel(ref)!
        .findOne({_id: refValue as ObjectId}, {projection: childProjection});
      if (childProjectionExcludesIds && resolvedChild) {
        delete (resolvedChild as Partial<DefaultSchema>)._id;
      }
      // Actually populate
      set(result, key, resolvedChild);
    }, Promise.resolve());
  });
};

declare module 'mongodb' {
  interface FindOneOptions<T> {
    population?: Population<T>;
  }
}
