import {isString, isUndefined} from 'lodash';
import {log, inspect} from './../utils/logger';
// @types
import {Model} from '..';

// Handle schema defaults
export default function schemaDefaultsPlugin(model: Model, {suffix = '_'} = {}) {
  const {collectionName} = model;
  const propsWithIndexes: Map<string, any> = new Map();
  model.post('initialize:property', (prop: {[s: string]: any} | string, path: string) => {
    if (isString(prop) || isUndefined(prop.index)) {
      return;
    }
    propsWithIndexes.set(path, prop.index);
  });
  // Handle document insertion
  model.post('initialize', async (doc: T) => {
    // const existingIndexes = await model.collection.indexes();
    const indexesFromProps = Array.from(propsWithIndexes.entries());
    const createdIndexesNames = await indexesFromProps.reduce(async (promiseSoFar, entry) => {
      const soFar = await promiseSoFar;
      const [path, options] = entry;
      const indexOptions = {name: `${path}${suffix}`, ...options};
      // // We have a named index? @TODO
      // if (indexOptions.name) {
      //   const indexExists = await model.collection.indexExists(indexOptions.name);
      // }
      log(`db.${collectionName}.createIndex(${inspect({[path]: 1})}, ${inspect(indexOptions)})`);
      const indexName = await model.collection.createIndex({[path]: 1}, indexOptions);
      soFar.set(path, indexName);
      return soFar;
    }, Promise.resolve(new Map()));
  });
}
