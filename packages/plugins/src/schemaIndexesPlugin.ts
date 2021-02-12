import { AnySchema, DefaultSchema, inspect, log, Model } from '@mongozest/core';
import { find, isString, isUndefined } from 'lodash';
import { IndexOptions, SchemaMember } from 'mongodb';

export type SchemaIndexesConfig<TSchema> = [SchemaMember<TSchema, number | boolean>, IndexOptions][];

declare module '@mongozest/core' {
  interface ModelConstructor<TSchema extends AnySchema = DefaultSchema> {
    indexes?: SchemaIndexesConfig<TSchema>;
  }
  interface JsonSchemaProperty<TProp = any> {
    index?: IndexOptions;
  }
}

export type SchemaIndexesPluginOptions = {
  suffix?: string;
};

export const schemaIndexesPlugin = <TSchema extends DefaultSchema>(
  model: Model<TSchema>,
  { suffix = '_' }: SchemaIndexesPluginOptions = {}
): void => {
  const { collectionName } = model;
  const propsWithIndexes: Map<string, IndexOptions> = new Map();
  model.post('initialize:property', (prop, path) => {
    if (isString(prop) || isUndefined(prop.index)) {
      return;
    }
    propsWithIndexes.set(path, prop.index);
  });
  // Handle document insertion
  model.post('initialize', async () => {
    // Create indexes from static model config
    const { indexes: indexesFromConfig } = model.constructor as { indexes?: SchemaIndexesConfig<TSchema> };
    if (indexesFromConfig) {
      const createdIndexesFromConfig = await indexesFromConfig.reduce(async (promiseSoFar, entry, index) => {
        const soFar = await promiseSoFar;
        const [key, options] = entry;
        const indexOptions: IndexOptions = { name: Object.keys(key).join('_'), ...options };
        const { name } = indexOptions;
        // Do we have a named index?
        if (name) {
          const indexExists = await model.collection.indexExists(name);
          if (indexExists) {
            // Do we have an exact match?
            const matchingIndex = find(await model.collection.indexes(), { key, ...indexOptions });
            if (matchingIndex) {
              // Nothing more to do!
              return soFar;
            }
          }
        }
        log(`db.${collectionName}.createIndex(${inspect(key)}, ${inspect(indexOptions)})`);
        const indexName = await model.collection.createIndex(key, indexOptions);
        soFar.set(index, indexName);
        return soFar;
      }, Promise.resolve(new Map()));
      if (createdIndexesFromConfig.size) {
        log(
          `db.${collectionName} successfully initialized ${createdIndexesFromConfig.size}-indexe(s) from model config`
        );
      }
    }

    // Create indexes from schema props
    // const existingIndexes = await model.collection.indexes();
    const indexesFromProps = Array.from(propsWithIndexes.entries());
    const createdIndexesFromProps = await indexesFromProps.reduce(async (promiseSoFar, entry) => {
      const soFar = await promiseSoFar;
      const [path, options] = entry;
      const name = `${path}${suffix}`;
      const indexOptions: IndexOptions = { name, ...options };
      const key = { [path]: 1 };
      // Do we have a named index?
      if (indexOptions.name) {
        const indexExists = await model.collection.indexExists(name);
        if (indexExists) {
          // Do we have an exact match?
          const matchingIndex = find(await model.collection.indexes(), { key, name, ...indexOptions });
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
    if (createdIndexesFromProps.size) {
      log(`db.${collectionName} successfully initialized ${createdIndexesFromProps.size}-indexe(s) from schema props`);
    }
  });
};
