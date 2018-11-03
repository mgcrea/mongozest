import {find, isString, isUndefined} from 'lodash';
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
      const {name} = indexOptions;
      const key = {[path]: 1};
      // Do we have a named index?
      if (indexOptions.name) {
        const indexExists = await model.collection.indexExists(name);
        if (indexExists) {
          // Do we have an exact match?
          const matchingIndex = find(await model.collection.indexes(), {key, name, ...indexOptions});
          if (matchingIndex) {
            // Nothing more to do!
            return soFar;
          }
        }
      }
      log(`db.${collectionName}.createIndex(${inspect(key)}, ${inspect(indexOptions)})`);
      const indexName = await model.collection.createIndex(key, indexOptions);
      soFar.set(path, indexName);
      return soFar;
    }, Promise.resolve(new Map()));
  });
}
