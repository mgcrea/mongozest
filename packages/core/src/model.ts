import './typings/model';
import Hooks, { HookCallback } from '@mongozest/hooks';
import { cloneDeep, intersection, isFunction, isPlainObject, snakeCase, uniq } from 'lodash';
import {
  Collection,
  CollectionAggregationOptions,
  CollectionCreateOptions,
  CollectionInsertManyOptions,
  CollectionInsertOneOptions,
  CommonOptions,
  Db as MongoDb,
  DeleteWriteOpResultObject,
  FilterQuery,
  FindAndModifyWriteOpResultObject,
  FindOneAndUpdateOption,
  FindOneOptions,
  InsertOneWriteOpResult,
  InsertWriteOpResult,
  MongoCountPreferences,
  MongoDistinctPreferences,
  ObjectId,
  OptionalId,
  ReplaceOneOptions,
  ReplaceWriteOpResult,
  UpdateManyOptions,
  UpdateOneOptions,
  UpdateQuery,
  UpdateWriteOpResult,
  WithId,
} from 'mongodb';
import pluralize from 'pluralize';
import { cloneOperationMap, createOperationMap, OperationMap } from './operation';
import { byIdPlugin, debugPlugin, jsonSchemaPlugin } from './plugins';
import type {
  AggregationPipeline,
  AnySchema,
  DefaultSchema,
  JsonSchemaProperties,
  JsonSchemaProperty,
  ModelHookName,
  MongozestPlugin,
  Schema,
  WriteableUpdateQuery,
} from './typings';

export interface ModelConstructor<TSchema extends AnySchema = DefaultSchema> {
  new (db: MongoDb): Model<TSchema>;
  modelName: string;
}

export class Model<TSchema extends AnySchema = DefaultSchema> {
  static internalPrePlugins: MongozestPlugin[] = [byIdPlugin];
  static internalPostPlugins: MongozestPlugin[] = [jsonSchemaPlugin, debugPlugin];

  static readonly schema: Schema;
  static readonly modelName: string;
  static readonly collectionName: string | null = null;
  static readonly collectionOptions: CollectionCreateOptions = {};
  static readonly plugins: Array<MongozestPlugin> = [];

  public collectionName: string;
  public collectionOptions: CollectionCreateOptions = {};
  public schema: Schema<TSchema>;
  private plugins: MongozestPlugin<TSchema>[];
  private initPromise: Promise<void> | null = null;
  public statics: Map<string | number | symbol, Function> = new Map();

  public collection!: Collection<TSchema>;
  private hooks = new Hooks<ModelHookName>();

  constructor(public db: MongoDb) {
    const { name: className, modelName, collectionName, collectionOptions, schema, plugins } = this
      .constructor as typeof Model;
    this.collectionName = collectionName ? collectionName : snakeCase(pluralize(modelName || className));
    this.collectionOptions = cloneDeep(collectionOptions);
    this.schema = cloneDeep(schema) as Schema<TSchema>;
    this.plugins = (plugins as unknown) as MongozestPlugin<TSchema>[];
  }

  // Initialization

  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = (async () => {
      // Load plugins
      await this.loadPlugins();
      // PreHooks handling
      await this.hooks.execPre('initialize', []);
      // Setup collection
      this.collection = await this.setupCollection();
      // PostHooks handling
      if (this.hooks.hasPost('initialize:property')) {
        await this.execPostPropertyHooks(this.schema);
      }
      await this.hooks.execPost('initialize', []);
    })();
    return this.initPromise;
  }

  // Helper recursively parsing schema
  private async execPostPropertyHooks<USchema = TSchema>(
    properties: JsonSchemaProperties<USchema>,
    prevPath: string = ''
  ): Promise<void> {
    return Object.keys(properties).reduce(async (promiseSoFar, key) => {
      const soFar = await promiseSoFar;
      const currentPath = prevPath ? `${prevPath}.${key}` : key;
      const { bsonType, properties: childProperties, items: childItems } = properties[key as keyof USchema];
      // Nested object case
      const isNestedObject = bsonType === 'object';
      if (childProperties && isNestedObject) {
        await this.execPostPropertyHooks<unknown>(childProperties, currentPath);
      }
      // Nested arrayItems case
      const hasNestedArrayItems = bsonType === 'array' && childItems;
      if (hasNestedArrayItems) {
        // const hasNestedArraySchemas = childItems && Array.isArray(childItems);
        if (childItems && Array.isArray(childItems)) {
          childItems.forEach(async (childItem, index: number) => {
            await this.hooks.execPost('initialize:property', [childItem, `${currentPath}[${index}]`, { isLeaf: true }]);
          });
          // isNestedObjectInArray
        } else if (
          isPlainObject(childItems) &&
          (childItems as JsonSchemaProperty).bsonType === 'object' &&
          (childItems as JsonSchemaProperty).properties
        ) {
          await this.execPostPropertyHooks((childItems as JsonSchemaProperty).properties!, `${currentPath}[]`);
        } else {
          // Special array leaf case
          await this.hooks.execPost('initialize:property', [childItems, `${currentPath}[]`, { isLeaf: true }]);
          return soFar;
        }
      }
      // Generic leaf case
      const isLeaf = !isNestedObject && !hasNestedArrayItems;
      await this.hooks.execPost('initialize:property', [properties[key as keyof USchema], currentPath, { isLeaf }]);
      return soFar;
    }, Promise.resolve());
  }

  // Collection management

  public async hasCollection(): Promise<boolean> {
    const { collectionName, db } = this;
    const collections = await db.listCollections({ name: collectionName }, { nameOnly: true }).toArray();
    return collections.length > 0;
  }
  private async setupCollection(): Promise<Collection<TSchema>> {
    const { db, collectionName, collectionOptions } = this;
    const doesExist = await this.hasCollection();
    await this.hooks.execPre('setup', [collectionOptions, { doesExist }]);
    await (doesExist ? this.updateCollection(collectionOptions) : this.createCollection(collectionOptions));
    return db.collection(collectionName);
  }
  private async createCollection(collectionOptions: CollectionCreateOptions): Promise<Collection<TSchema>> {
    const { db, collectionName } = this;
    return await db.createCollection(collectionName, collectionOptions);
  }
  private async updateCollection(collectionOptions: CollectionCreateOptions): Promise<unknown> {
    const { db, collectionName } = this;
    return await db.command({
      collMod: collectionName,
      ...collectionOptions,
    });
  }
  public async getCollectionInfo<T extends Record<string, unknown>>(): Promise<T> {
    const { collectionName, db } = this;
    const collections = await db.listCollections({ name: collectionName }).toArray();
    if (collections.length < 1) {
      throw new Error(`Collection "${collectionName}" not found`);
    }
    return collections[0] as T;
  }
  get jsonSchema(): Record<string, unknown> {
    const { collectionOptions } = this;
    if (!collectionOptions.validator) {
      return {};
    }
    const validator = collectionOptions.validator as { [s: string]: any };
    if (!validator || !validator.$jsonSchema) {
      return {};
    }
    return validator.$jsonSchema;
  }

  // Plugins management

  private async loadPlugins(this: Model<TSchema>) {
    const { modelName } = this.constructor as typeof Model;
    const { plugins } = this;
    // @ts-expect-error fixme
    const allPlugins: Plugin<TSchema>[] = uniq([...Model.internalPrePlugins, ...plugins, ...Model.internalPostPlugins]);
    allPlugins.forEach((pluginConfig, index) => {
      const pluginFn = Array.isArray(pluginConfig) ? pluginConfig[0] : pluginConfig;
      if (!pluginFn || !isFunction(pluginFn)) {
        throw new Error(`Found unexpected non-function model plugin at index=${index} for model="${modelName}"`);
      }
      try {
        if (Array.isArray(pluginConfig)) {
          pluginFn(this, pluginConfig[1]);
        } else if (pluginConfig) {
          pluginConfig(this, undefined);
        }
      } catch (err) {
        console.error(
          `Failed to load model plugin named="${pluginFn.name}" at index=${index} for model="${modelName}":\n${err.message}`
        );
        throw err;
      }
    });
  }

  addStatics(staticsMap: Record<string, Function>): void {
    Object.keys(staticsMap).forEach((key) => this.statics.set(key, staticsMap[key]));
  }
  addSchemaProperties(additionalProperties: Record<string, unknown>): void {
    const { modelName } = this.constructor as typeof Model;
    const { schema } = this;
    const conflictingKeys = intersection(Object.keys(schema), Object.keys(additionalProperties));
    if (conflictingKeys.length) {
      throw new Error(`Conflicting keys=[${conflictingKeys.join(', ')}] on ${modelName} schema`);
    }
    Object.assign(schema, additionalProperties);
  }
  pre(hookName: ModelHookName, callback: HookCallback): void {
    this.hooks.pre(hookName, callback);
  }
  post(hookName: ModelHookName, callback: HookCallback): void {
    this.hooks.post(hookName, callback);
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#aggregate
  async aggregate<T = TSchema>(
    pipeline: AggregationPipeline = [],
    options: CollectionAggregationOptions = {}
  ): Promise<T[]> {
    // Prepare operation params
    const operation = createOperationMap<TSchema>('aggregate');
    // Execute preHooks
    await this.hooks.execPre('aggregate', [operation, pipeline, options]);
    // Actual mongodb operation
    const result = await this.collection.aggregate<T>(pipeline, options).toArray();
    /* ['result', 'connection', 'message', 'ops', 'insertedCount', 'insertedId'] */
    /* {result: ['n', 'opTime', 'electionId', 'ok', 'operationTime', '$clusterTime']} */
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execPost('aggregate', [operation, pipeline, options]);
    return operation.get('result');
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#countDocuments
  async countDocuments(query: FilterQuery<TSchema>, options: MongoCountPreferences = {}): Promise<number> {
    // Prepare operation params
    const operation = createOperationMap<TSchema>('countDocuments');
    // Execute preHooks
    await this.hooks.execPre('find', [operation, query, options]);
    await this.hooks.execPre('countDocuments', [operation, query, options]);
    // Actual mongodb operation
    const result: number = await this.collection.countDocuments(query, options);
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execPost('countDocuments', [operation, query, options]);
    return operation.get('result') as number;
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#aggregate
  async distinct(
    key: string,
    query: FilterQuery<TSchema>,
    options: MongoDistinctPreferences = {}
  ): Promise<Array<ObjectId>> {
    // Prepare operation params
    const operation = createOperationMap<TSchema>('distinct');
    // Execute preHooks
    await this.hooks.execPre('find', [operation, query, options]);
    await this.hooks.execPre('distinct', [operation, key, query, options]);
    // Actual mongodb operation
    const result: Array<ObjectId> = await this.collection.distinct(key, query, options);
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execPost('distinct', [operation, key, query, options]);
    return operation.get('result');
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#insertOne
  async insertOne(
    document: OptionalId<TSchema>,
    options: CollectionInsertOneOptions = {}
  ): Promise<InsertOneWriteOpResult<WithId<TSchema>>> {
    // Prepare operation params
    const operation = createOperationMap<TSchema>('insertOne');
    // Execute preHooks
    await this.hooks.execManyPre(['insert', 'insertOne', 'validate'], [operation, document, options]);
    // Actual mongodb operation
    try {
      const result = await this.collection.insertOne(
        operation.has('document') ? operation.get('document') : document,
        options
      );
      /* ['result', 'connection', 'message', 'ops', 'insertedCount', 'insertedId'] */
      /* {result: ['n', 'opTime', 'electionId', 'ok', 'operationTime', '$clusterTime']} */
      operation.set('result', result);
    } catch (error) {
      operation.set('error', error);
      await this.hooks.execManyPost(['error', 'insertError', 'insertOneError'], [operation, document, options]);
      if (operation.has('error')) {
        throw operation.get('error');
      }
    }
    // Execute postHooks
    await this.hooks.execManyPost(['insert', 'insertOne'], [operation, document, options]);
    return operation.get('result');
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#insertOne
  // @source https://github.com/mongodb/node-mongodb-native/blob/master/lib/operations/collection_ops.js#L861
  async replaceOne(
    filter: FilterQuery<TSchema>,
    document: TSchema,
    options: ReplaceOneOptions = {}
  ): Promise<ReplaceWriteOpResult> {
    // Prepare operation params
    const operation = createOperationMap<TSchema>('replaceOne');
    // Execute preHooks
    await this.hooks.execPre('insert', [operation, document, options]);
    await this.hooks.execPre('replaceOne', [operation, filter, document, options]);
    await this.hooks.execPre('validate', [operation, document, options]);
    // Actual mongodb operation
    const result = await this.collection.replaceOne(
      filter,
      operation.has('document') ? (operation.get('document') as TSchema) : document,
      options
    );
    /* ['result', 'connection', 'message', 'modifiedCount', 'upsertedId', 'upsertedCount', 'matchedCount', 'ops'] */
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execPost('insert', [operation, document, options]);
    await this.hooks.execPost('replaceOne', [operation, filter, document, options]);
    return operation.get('result');
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#insertMany
  async insertMany(
    documents: Array<OptionalId<TSchema>>,
    options: CollectionInsertManyOptions = {}
  ): Promise<InsertWriteOpResult<WithId<TSchema>>> {
    // Prepare operation params
    const operation = createOperationMap<TSchema>('insertMany');
    // Execute preHooks
    const eachPreArgs = documents.reduce(
      (soFar: Array<any>, document: OptionalId<TSchema>) => soFar.concat([[operation, document, options]]),
      []
    );
    await this.hooks.execEachPre('insert', eachPreArgs);
    await this.hooks.execPre('insertMany', [operation, documents, options]);
    await this.hooks.execEachPre('validate', eachPreArgs);
    // Actual mongodb operation
    const result = await this.collection.insertMany(
      operation.has('documents') ? operation.get('documents') : documents,
      options
    );
    operation.set('result', result);
    // Execute postHooks
    const { ops, insertedIds } = result;
    const eachPostArgs = documents.reduce<Array<[OperationMap<TSchema>, OptionalId<TSchema>, typeof options]>>(
      (soFar, document, index) => {
        const documentResult = { ...result, ops: [ops[index]], insertedCount: 1, insertedId: insertedIds[index] };
        return soFar.concat([[cloneOperationMap(operation, ['result', documentResult]), document, options]]);
      },
      []
    );
    await this.hooks.execEachPost('insert', eachPostArgs);
    await this.hooks.execPost('insertMany', [operation, documents, options]);
    return operation.get('result');
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#updateOne
  // @NOTE removed support for TSchema update
  async updateOne(
    filter: FilterQuery<TSchema>,
    update: WriteableUpdateQuery<TSchema>,
    options: UpdateOneOptions = {}
  ): Promise<UpdateWriteOpResult> {
    // Prepare operation params
    const operation = createOperationMap<TSchema>('updateOne');
    // Execute preHooks
    await this.hooks.execManyPre(['update', 'updateOne'], [operation, filter, update, options]);
    if (update.$set) {
      await this.hooks.execPre('validate', [operation, update.$set, options]);
    }
    // Actual mongodb operation
    try {
      const result = await this.collection.updateOne(
        filter,
        (operation.has('update') ? operation.get('update') : update) as UpdateQuery<TSchema>,
        options
      );
      operation.set('result', result);
    } catch (error) {
      operation.set('error', error);
      await this.hooks.execManyPost(['error', 'updateError', 'updateOneError'], [operation, filter, update, options]);
      if (operation.has('error')) {
        throw operation.get('error');
      }
    }
    // Execute postHooks
    await this.hooks.execManyPost(['update', 'updateOne'], [operation, filter, update, options]);
    return operation.get('result');
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#updateMany
  async updateMany(
    filter: FilterQuery<TSchema>,
    update: WriteableUpdateQuery<TSchema>,
    options: UpdateManyOptions = {}
  ): Promise<UpdateWriteOpResult> {
    // Prepare operation params
    const operation = createOperationMap<TSchema>('updateMany');
    // Execute preHooks
    await this.hooks.execManyPre(['update', 'updateMany'], [operation, filter, update, options]);
    if (update.$set) {
      await this.hooks.execPre('validate', [operation, update.$set, options]);
    }
    // Actual mongodb operation
    const result = await this.collection.updateMany(
      filter,
      (operation.has('update') ? operation.get('update') : update) as UpdateQuery<TSchema>,
      options
    );
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execManyPost(['update', 'updateMany'], [operation, filter, update, options]);
    return operation.get('result');
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#findOneAndUpdate
  // @note use {returnOriginal: false} to get updated object
  async findOneAndUpdate(
    filter: FilterQuery<TSchema>,
    update: WriteableUpdateQuery<TSchema>,
    options: FindOneAndUpdateOption<TSchema> = {}
  ): Promise<FindAndModifyWriteOpResultObject<TSchema>> {
    // Prepare operation params
    const operation = createOperationMap<TSchema>('findOneAndUpdate');
    const findOperation = createOperationMap<TSchema>('findOneAndUpdate');
    // Execute preHooks
    await this.hooks.execManyPre(['find', 'findOne'], [operation, filter, options]);
    await this.hooks.execManyPre(['update', 'updateOne', 'findOneAndUpdate'], [operation, filter, update, options]);
    if (update.$set) {
      await this.hooks.execPre('validate', [operation, update.$set, options]);
    }
    // Actual mongodb operation
    try {
      const result = await this.collection.findOneAndUpdate(filter, update as UpdateQuery<TSchema>, options);
      operation.set('result', result);
      findOperation.set('result', result.value);
    } catch (error) {
      operation.set('error', error);
      await this.hooks.execManyPost(
        ['error', 'updateError', 'updateOneError', 'findOneAndUpdateError'],
        [operation, filter, update, options]
      );
      if (operation.has('error')) {
        throw operation.get('error');
      }
    }
    // Execute postHooks
    await this.hooks.execManyPost(['find', 'findOne'], [findOperation, filter, options]);
    await this.hooks.execManyPost(['update', 'updateOne', 'findOneAndUpdate'], [operation, filter, update, options]);
    return operation.get('result');
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#findOne
  // findOne<T = TSchema>(filter: FilterQuery<TSchema>, options?: FindOneOptions<T extends TSchema ? TSchema : T>): Promise<T | null>;
  async findOne<T = WithId<TSchema>>(
    query: FilterQuery<TSchema>,
    options: FindOneOptions<T extends TSchema ? TSchema : T> = {}
  ): Promise<T | null> {
    // Prepare operation params
    const operation = createOperationMap<TSchema>('findOne');
    // Execute preHooks
    await this.hooks.execManyPre(['find', 'findOne'], [operation, query, options]);
    // Actual mongodb operation
    const result = await this.collection.findOne<T>(query, options);
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execManyPost(['find', 'findOne'], [operation, query, options]);
    return operation.get('result');
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#find
  find = this.findMany;
  async findMany<T = WithId<TSchema>>(
    query: FilterQuery<TSchema>,
    options: FindOneOptions<T extends TSchema ? TSchema : T> = {}
  ): Promise<Array<T>> {
    // PreHooks handling
    const operation = createOperationMap<TSchema>('findMany');
    await this.hooks.execManyPre(['find', 'findMany'], [operation, query, options]);
    // Actual mongodb operation
    const result = await this.collection.find<T>(query, options).toArray();
    operation.set('result', result);
    // Execute postHooks
    // const pre = process.hrtime();
    const eachPostArgs = result.reduce<Array<[OperationMap<TSchema>, typeof query, typeof options]>>(
      (soFar, document) => {
        return soFar.concat([[cloneOperationMap(operation, ['result', document]), query, options]]);
      },
      []
    );
    // const diff = process.hrtime(pre);
    // const elapsed = (diff[0] * NS_PER_SEC + diff[1]) / 1e6;
    await this.hooks.execEachPost('find', eachPostArgs);
    await this.hooks.execPost('findMany', [operation, query, options]);
    return operation.get('result');
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#deleteOne
  async deleteOne(
    filter: FilterQuery<TSchema>,
    options: CommonOptions & { bypassDocumentValidation?: boolean } = {}
  ): Promise<DeleteWriteOpResultObject> {
    // PreHooks handling
    const operation = createOperationMap<TSchema>('deleteOne');
    await this.hooks.execManyPre(['delete', 'deleteOne'], [operation, filter, options]);
    // Actual mongodb operation
    const result = await this.collection.deleteOne(filter, options);
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execManyPost(['delete', 'deleteOne'], [operation, result, filter, options]);
    return operation.get('result');
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#deleteMany
  async deleteMany(filter: FilterQuery<TSchema>, options: CommonOptions = {}): Promise<DeleteWriteOpResultObject> {
    // PreHooks handling
    const operation = createOperationMap<TSchema>('deleteMany');
    await this.hooks.execManyPre(['delete', 'deleteMany'], [operation, filter, options]);
    // Actual mongodb operation
    const result = await this.collection.deleteMany(filter, options);
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execManyPost(['delete', 'deleteMany'], [operation, result, filter, options]);
    return operation.get('result');
  }
}
