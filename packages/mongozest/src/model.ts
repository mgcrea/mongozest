// @docs https://www.mongodb.com/blog/post/handling-files-using-mongodb-stitch-and-aws-s3
// @docs https://github.com/hapijs/joi/blob/v13.7.0/API.md
// @docs https://github.com/dylang/shortid
// @docs http://mongodb.github.io/node-mongodb-native/3.1/reference/ecmascriptnext/crud/
// @docs https://github.com/aljazerzen/mongodb-typescript

import {cloneDeep, snakeCase, uniq} from 'lodash';
import pluralize from 'pluralize';
import {Schema} from './schema';
import Hooks, {HookCallback} from '@mongozest/hooks';

import jsonSchemaPlugin from './plugins/jsonSchemaPlugin';
import byIdPlugin from './plugins/byIdPlugin';
// // import schemaCastingPlugin from './plugins/schemaCastingPlugin';
import debugPlugin from './plugins/debugPlugin';

// require('debug-utils').default();

import {
  Db as MongoDb,
  Collection,
  CollectionCreateOptions,
  CollectionInsertOneOptions,
  CollectionInsertManyOptions,
  CollectionAggregationOptions,
  CommonOptions,
  DeleteWriteOpResultObject,
  InsertOneWriteOpResult,
  InsertWriteOpResult,
  FilterQuery,
  FindOneOptions,
  FindAndModifyWriteOpResultObject,
  FindOneAndReplaceOption,
  UpdateQuery,
  UpdateManyOptions,
  UpdateWriteOpResult,
  ReplaceWriteOpResult,
  ReplaceOneOptions
} from 'mongodb';

export type OperationMap = Map<string, any>;
type Plugin<TSchema> = (model: Model<TSchema>, options?: {[s: string]: any}) => Promise<any> | any;

export default class Model<TSchema = any> {
  static internalPrePlugins = [byIdPlugin];
  static internalPostPlugins = [jsonSchemaPlugin, debugPlugin];

  static readonly schema: object;
  static readonly collectionName: string | null = null;
  static readonly collectionOptions: CollectionCreateOptions = {};
  static readonly plugins: Array<any> = [];

  public collectionName: string;
  public collectionOptions: CollectionCreateOptions = {};
  public schema: Schema<TSchema>;
  private plugins: Array<Plugin<TSchema>>;
  private statics: Map<string, () => void> = new Map();

  public collection!: Collection<TSchema>;
  private hooks: Hooks = new Hooks();

  constructor(public db: MongoDb) {
    const {name: className, modelName, collectionName, collectionOptions, schema, plugins} = this.constructor as any;
    this.collectionName = collectionName ? collectionName : snakeCase(pluralize(modelName || className));
    this.collectionOptions = cloneDeep(collectionOptions);
    this.schema = cloneDeep(schema);
    this.plugins = plugins;
  }

  // Initialization

  async initialize() {
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
  }

  // Helper recursively parsing schema
  private async execPostPropertyHooks(properties: {[s: string]: any}, prevPath: string = ''): Promise<void> {
    return Object.keys(properties).reduce(async (promiseSoFar, key) => {
      const soFar = await promiseSoFar;
      const currentPath = prevPath ? `${prevPath}.${key}` : key;
      const {bsonType, properties: childProperties, items: childItems} = properties[key];
      // Nested object case
      const isNestedObject = bsonType === 'object' && childProperties;
      if (isNestedObject) {
        await this.execPostPropertyHooks(childProperties, currentPath);
      }
      // Nested arrayItems case
      const hasNestedArrayItems = bsonType === 'array' && childItems;
      if (hasNestedArrayItems) {
        const hasNestedArraySchemas = Array.isArray(childItems);
        if (hasNestedArraySchemas) {
          childItems.forEach(async (childItem: {[s: string]: any}, index: number) => {
            await this.hooks.execPost('initialize:property', [childItem, `${currentPath}[${index}]`, {isLeaf: true}]);
          });
        }
        const isNestedObjectInArray = childItems.bsonType === 'object' && childItems.properties;
        if (isNestedObjectInArray) {
          await this.execPostPropertyHooks(childItems.properties, `${currentPath}[]`);
        } else {
          // Special array leaf case
          await this.hooks.execPost('initialize:property', [childItems, `${currentPath}[]`, {isLeaf: true}]);
          return soFar;
        }
      }
      // Generic leaf case
      const isLeaf = !isNestedObject && !hasNestedArrayItems;
      await this.hooks.execPost('initialize:property', [properties[key], currentPath, {isLeaf}]);
      return soFar;
    }, Promise.resolve());
  }

  // Collection management

  public async hasCollection(): Promise<boolean> {
    const {collectionName, db} = this;
    const collections = await db.listCollections({name: collectionName}, {nameOnly: true}).toArray();
    return collections.length > 0;
  }
  private async setupCollection(): Promise<Collection<TSchema>> {
    const {db, collectionName, collectionOptions} = this;
    const doesExist = await this.hasCollection();
    await this.hooks.execPre('setup', [collectionOptions, {doesExist}]);
    await (doesExist ? this.updateCollection(collectionOptions) : this.createCollection(collectionOptions));
    return db.collection(collectionName);
  }
  private async createCollection(collectionOptions: CollectionCreateOptions): Promise<Collection<TSchema>> {
    const {db, collectionName} = this;
    return await db.createCollection(collectionName, collectionOptions);
  }
  private async updateCollection(collectionOptions: CollectionCreateOptions): Promise<any> {
    const {db, collectionName} = this;
    return await db.command({
      collMod: collectionName,
      ...collectionOptions
    });
  }
  public async getCollectionInfo() {
    const {collectionName, db} = this;
    const collections = await db.listCollections({name: collectionName}).toArray();
    if (collections.length < 1) {
      throw new Error(`Collection "${collectionName}" not found`);
    }
    return collections[0];
  }
  get jsonSchema(): object {
    const {collectionOptions} = this;
    if (!collectionOptions.validator) {
      return {};
    }
    const validator = collectionOptions.validator as {[s: string]: any};
    if (!validator || !validator.$jsonSchema) {
      return {};
    }
    return validator.$jsonSchema;
  }

  // Plugins management

  private async loadPlugins(this: Model<TSchema>) {
    const {plugins} = this;
    const allPlugins = uniq([...Model.internalPrePlugins, ...plugins, ...Model.internalPostPlugins]);
    allPlugins.forEach(pluginConfig => {
      if (Array.isArray(pluginConfig)) {
        pluginConfig[0](this, pluginConfig[1]);
      } else {
        pluginConfig(this, undefined);
      }
    });
  }

  addStatics(staticsMap: {[s: string]: any}): void {
    Object.keys(staticsMap).forEach(key => this.statics.set(key, staticsMap[key]));
  }
  addSchemaProperties(additionalProperties: {[s: string]: any}) {
    const {schema} = this;
    Object.assign(schema, additionalProperties);
  }
  pre(hookName: string, callback: HookCallback) {
    this.hooks.pre(hookName, callback);
  }
  post(hookName: string, callback: HookCallback) {
    this.hooks.post(hookName, callback);
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#aggregate
  async aggregate(
    pipeline: Array<Object> = [],
    options: CollectionAggregationOptions = {}
  ): Promise<Array<TSchema | null>> {
    // Prepare operation params
    const operation: OperationMap = new Map([['method', 'aggregate']]);
    // Execute preHooks
    await this.hooks.execPre('aggregate', [pipeline, options, operation]);
    // Actual mongodb operation
    const result = await this.collection.aggregate(pipeline, options).toArray();
    /* ['result', 'connection', 'message', 'ops', 'insertedCount', 'insertedId'] */
    /* {result: ['n', 'opTime', 'electionId', 'ok', 'operationTime', '$clusterTime']} */
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execPost('aggregate', [pipeline, options, operation]);
    return operation.get('result') as Array<TSchema | null>;
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#insertOne
  async insertOne(document: TSchema, options: CollectionInsertOneOptions = {}): Promise<InsertOneWriteOpResult> {
    // Prepare operation params
    const operation: OperationMap = new Map([['method', 'insertOne']]);
    // Execute preHooks
    await this.hooks.execManyPre(['insert', 'insertOne', 'validate'], [document, options, operation]);
    // Actual mongodb operation
    let result;
    try {
      result = await this.collection.insertOne(document, options);
      /* ['result', 'connection', 'message', 'ops', 'insertedCount', 'insertedId'] */
      /* {result: ['n', 'opTime', 'electionId', 'ok', 'operationTime', '$clusterTime']} */
    } catch (error) {
      operation.set('error', error);
      await this.hooks.execManyPost(['error', 'insertError', 'insertOneError'], [document, options, operation]);
      if (operation.has('error')) {
        throw operation.get('error');
      }
    }
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execManyPost(['insert', 'insertOne'], [document, options, operation]);
    return operation.get('result') as InsertOneWriteOpResult;
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#insertOne
  // @source https://github.com/mongodb/node-mongodb-native/blob/master/lib/operations/collection_ops.js#L861
  async replaceOne(
    filter: FilterQuery<TSchema>,
    document: TSchema,
    options: ReplaceOneOptions = {}
  ): Promise<ReplaceWriteOpResult> {
    // Prepare operation params
    const operation: OperationMap = new Map([['method', 'replaceOne']]);
    // Execute preHooks
    await this.hooks.execPre('insert', [document, options, operation]);
    await this.hooks.execPre('replaceOne', [filter, document, options, operation]);
    await this.hooks.execPre('validate', [document, options, operation]);
    // Actual mongodb operation
    const result = await this.collection.replaceOne(filter, document, options);
    /* ['result', 'connection', 'message', 'modifiedCount', 'upsertedId', 'upsertedCount', 'matchedCount', 'ops'] */
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execPost('insert', [document, options, operation]);
    await this.hooks.execPost('replaceOne', [filter, document, options, operation]);
    return operation.get('result') as ReplaceWriteOpResult;
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#insertMany
  async insertMany(documents: TSchema[], options: CollectionInsertManyOptions = {}): Promise<InsertWriteOpResult> {
    // Prepare operation params
    const operation: OperationMap = new Map([['method', 'insertMany']]);
    // Execute preHooks
    const eachPreArgs = documents.reduce(
      (soFar: Array<any>, document: TSchema) => soFar.concat([[document, options, operation]]),
      []
    );
    await this.hooks.execEachPre('insert', eachPreArgs);
    await this.hooks.execPre('insertMany', [documents, options, operation]);
    await this.hooks.execEachPre('validate', eachPreArgs);
    // Actual mongodb operation
    const result = await this.collection.insertMany(documents, options);
    operation.set('result', result);
    // Execute postHooks
    const {ops, insertedIds} = result;
    const eachPostArgs = documents.reduce((soFar: Array<any>, document: TSchema, index) => {
      const documentResult = {...result, ops: [ops[index]], insertedCount: 1, insertedId: insertedIds[index]};
      return soFar.concat([[document, options, new Map([...operation, ['result', documentResult]])]]);
    }, []);
    await this.hooks.execEachPost('insert', eachPostArgs);
    await this.hooks.execPost('insertMany', [documents, options, operation]);
    return operation.get('result') as InsertWriteOpResult;
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#updateOne
  async updateOne(
    filter: FilterQuery<TSchema>,
    update: UpdateQuery<TSchema> | TSchema,
    options: ReplaceOneOptions = {}
  ): Promise<UpdateWriteOpResult> {
    // Prepare operation params
    const operation: OperationMap = new Map([['method', 'updateOne']]);
    // Execute preHooks
    await this.hooks.execManyPre(['update', 'updateOne'], [filter, update, options, operation]);
    if ((update as UpdateQuery<TSchema>).$set) {
      await this.hooks.execPre('validate', [(update as UpdateQuery<TSchema>).$set, options, operation]);
    }
    // Actual mongodb operation
    let result;
    try {
      result = await this.collection.updateOne(filter, update, options);
    } catch (error) {
      operation.set('error', error);
      await this.hooks.execManyPost(['error', 'updateError', 'updateOneError'], [filter, update, options, operation]);
      if (operation.has('error')) {
        throw operation.get('error');
      }
    }
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execManyPost(['update', 'updateOne'], [filter, update, options, operation]);
    return operation.get('result') as UpdateWriteOpResult;
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#updateMany
  async updateMany(
    filter: FilterQuery<TSchema>,
    update: UpdateQuery<TSchema>, // | TSchema
    options: UpdateManyOptions = {}
  ): Promise<UpdateWriteOpResult> {
    // Prepare operation params
    const operation: OperationMap = new Map([['method', 'updateMany']]);
    // Execute preHooks
    await this.hooks.execManyPre(['update', 'updateMany'], [filter, update, options, operation]);
    if (update.$set) {
      await this.hooks.execPre('validate', [update.$set, options, operation]);
    }
    // Actual mongodb operation
    const result = await this.collection.updateMany(filter, update, options);
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execManyPost(['update', 'updateMany'], [filter, update, options, operation]);
    return operation.get('result') as UpdateWriteOpResult;
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#findOneAndUpdate
  // @note use {returnOriginal: false} to get updated object
  async findOneAndUpdate(
    filter: FilterQuery<TSchema>,
    update: UpdateQuery<TSchema>, // | TSchema
    options: FindOneAndReplaceOption = {}
  ): Promise<FindAndModifyWriteOpResultObject<TSchema>> {
    // Prepare operation params
    const operation: OperationMap = new Map([['method', 'findOneAndUpdate']]);
    // Execute preHooks
    await this.hooks.execManyPre(['find', 'findOne'], [filter, options, operation]);
    await this.hooks.execManyPre(['update', 'updateOne', 'findOneAndUpdate'], [filter, update, options, operation]);
    if (update.$set) {
      await this.hooks.execPre('validate', [update.$set, options, operation]);
    }
    // Actual mongodb operation
    let result;
    try {
      result = await this.collection.findOneAndUpdate(filter, update, options);
    } catch (error) {
      operation.set('error', error);
      await this.hooks.execManyPost(
        ['error', 'updateError', 'updateOneError', 'findOneAndUpdateError'],
        [filter, update, options, operation]
      );
      if (operation.has('error')) {
        throw operation.get('error');
      }
    }
    operation.set('result', result);
    // Execute postHooks
    // await this.hooks.execManyPost(['find', 'findOne'], [filter, options, operation]); // @NOTE should fix: operation.get('result').value
    await this.hooks.execManyPost(['update', 'updateOne', 'findOneAndUpdate'], [filter, update, options, operation]);
    return operation.get('result') as FindAndModifyWriteOpResultObject<TSchema>;
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#findOne
  async findOne(query: FilterQuery<TSchema>, options: FindOneOptions = {}): Promise<TSchema | null> {
    // Prepare operation params
    const operation: OperationMap = new Map([['method', 'findOne']]);
    // Execute preHooks
    await this.hooks.execManyPre(['find', 'findOne'], [query, options, operation]);
    // Actual mongodb operation
    const result = await this.collection.findOne(query, options);
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execManyPost(['find', 'findOne'], [query, options, operation]);
    return operation.get('result') as TSchema;
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#find
  async find(query: FilterQuery<TSchema>, options: FindOneOptions = {}): Promise<Array<TSchema>> {
    // PreHooks handling
    const operation: OperationMap = new Map([['method', 'find']]);
    await this.hooks.execManyPre(['find', 'findMany'], [query, options, operation]);
    // Actual mongodb operation
    const result = await this.collection.find(query, options).toArray();
    operation.set('result', result);
    // Execute postHooks
    const eachPostArgs = result.reduce((soFar: Array<any>, document: TSchema) => {
      return soFar.concat([[query, options, new Map([...operation, ['result', document]])]]);
    }, []);
    await this.hooks.execEachPost('find', eachPostArgs);
    await this.hooks.execPost('findMany', [query, options, operation]);
    return operation.get('result') as Array<TSchema>;
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#deleteOne
  async deleteOne(
    filter: FilterQuery<TSchema>,
    options: CommonOptions & {bypassDocumentValidation?: boolean} = {}
  ): Promise<DeleteWriteOpResultObject> {
    // PreHooks handling
    const operation: OperationMap = new Map([['method', 'deleteOne']]);
    await this.hooks.execManyPre(['delete', 'deleteOne'], [filter, options, operation]);
    // Actual mongodb operation
    const result = await this.collection.deleteOne(filter, options);
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execManyPost(['delete', 'deleteOne'], [result, filter, options, operation]);
    return operation.get('result') as DeleteWriteOpResultObject;
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#deleteMany
  async deleteMany(filter: FilterQuery<TSchema>, options: CommonOptions = {}): Promise<DeleteWriteOpResultObject> {
    // PreHooks handling
    const operation: OperationMap = new Map([['method', 'deleteMany']]);
    await this.hooks.execManyPre(['delete', 'deleteMany'], [filter, options, operation]);
    // Actual mongodb operation
    const result = await this.collection.deleteMany(filter, options);
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execManyPost(['delete', 'deleteMany'], [result, filter, options, operation]);
    return operation.get('result') as DeleteWriteOpResultObject;
  }
}
