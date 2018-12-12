// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types

import {get, pick, map, keyBy, isUndefined, isString} from 'lodash';
import {uniqWithObjectIds} from './../utils/objectId';
// @types
import {Model, OperationMap, mapPathValues} from '..';

// Helper recursively parsing schema to find path where values should be casted
export default function autoCastingPlugin(model: Model, options = {}) {
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
    const {populate} = options;
    if (!populate) {
      return;
    }
    const result = operation.get('result');
    await Object.keys(populate).reduce(async (soFar, key) => {
      await soFar;
      if (!propsWithRefs.has(key)) {
        return;
      }
      // @TODO handle arrays
      const ref = propsWithRefs.get(key);
      const uniqueIds = uniqWithObjectIds(map(result, key).filter(Boolean));
      const resolvedChildren = await model.otherModel(ref).find({_id: {$in: uniqueIds}});
      const resolvedChildrenMap = keyBy(resolvedChildren, '_id');
      // Actually populate
      result.map(doc => {
        if (doc[key]) {
          doc[key] = resolvedChildrenMap[doc[key].toString()] || null;
        }
      });
    }, Promise.resolve());
  });
}
