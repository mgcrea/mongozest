// @docs https://www.mongodb.com/blog/post/handling-files-using-mongodb-stitch-and-aws-s3
// @docs https://github.com/hapijs/joi/blob/v13.7.0/API.md
// @docs https://github.com/dylang/shortid
// @docs http://mongodb.github.io/node-mongodb-native/3.1/reference/ecmascriptnext/crud/

import {cloneDeep, snakeCase, uniq} from 'lodash';
import pluralize from 'pluralize';

import jsonSchemaPlugin from './plugins/jsonSchemaPlugin';
import findByIdPlugin from './plugins/findByIdPlugin';
import schemaCastingPlugin from './plugins/schemaCastingPlugin';
import debugPlugin from './plugins/debugPlugin';
import Hooks from './utils/hooks';

// require('debug-utils').default();

import {
  Db as MongoDb,
  Collection,
  CollectionCreateOptions,
  CollectionInsertOneOptions,
  CollectionInsertManyOptions,
  CommonOptions,
  DeleteWriteOpResultObject,
  InsertOneWriteOpResult,
  InsertWriteOpResult,
  FilterQuery,
  FindOneOptions,
  FindAndModifyWriteOpResultObject,
  FindOneAndReplaceOption,
  UpdateQuery,
  UpdateWriteOpResult,
  ReplaceOneOptions
} from 'mongodb';

interface TSchema {}

export default class Model {
  static internalPrePlugins = [findByIdPlugin];
  static internalPostPlugins = [schemaCastingPlugin, jsonSchemaPlugin, debugPlugin];

  static readonly schema: object;
  static readonly collectionName: string | null = null;
  static readonly collectionOptions: CollectionCreateOptions = {};
  static readonly plugins = [];

  public collectionName: string;
  public collectionOptions: CollectionCreateOptions = {};
  public schema: object;
  private plugins: Array<any>;
  private statics: Map<string, () => void> = new Map();

  public collection: Collection;
  private hooks: Hooks = new Hooks();

  constructor(public db: MongoDb) {
    const {name: className, collectionName, collectionOptions, schema, plugins} = this.constructor as any;
    this.collectionName = collectionName ? collectionName : snakeCase(pluralize(className));
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

  // Helper recursively parsing schema to find path where values should be casted
  private async execPostPropertyHooks(properties: {[s: string]: any}, prevPath: string = ''): void {
    return Object.keys(properties).reduce(async (promiseSoFar, key) => {
      const soFar = await promiseSoFar;
      const currentPath = prevPath ? `${prevPath}.${key}` : key;
      const {bsonType, properties: childProperties} = properties[key];
      // Nested object case
      const isLeaf = !(bsonType === 'object' && childProperties);
      // Leaf case
      await this.hooks.execPost('initialize:property', [properties[key], currentPath, {isLeaf}]);
      if (!isLeaf) {
        await this.execPostPropertyHooks(childProperties, currentPath);
      }
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
    const {db, collectionName} = this;
    const doesExist = await this.hasCollection();
    await (doesExist ? this.updateCollection() : this.createCollection());
    return db.collection(collectionName);
  }
  private async createCollection(): Promise<Collection<TSchema>> {
    const {db, collectionName, collectionOptions} = this;
    return await db.createCollection(collectionName, collectionOptions);
  }
  private async updateCollection(): Promise<any> {
    const {db, collectionName, collectionOptions} = this;
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
    if (!collectionOptions.validator || !collectionOptions.validator.$jsonSchema) {
      return {};
    }
    return collectionOptions.validator.$jsonSchema;
  }

  // Plugins management

  private async loadPlugins() {
    const {plugins} = this;
    const allPlugins = uniq([...Model.internalPrePlugins, ...plugins, ...Model.internalPostPlugins]);
    allPlugins.forEach(pluginConfig => {
      if (Array.isArray(pluginConfig)) {
        pluginConfig[0](this, pluginConfig[1]);
      } else {
        pluginConfig(this);
      }
    });
  }

  addStatics(staticsMap: {[s: string]: any}): void {
    Object.keys(staticsMap).forEach(key => this.statics.set(key, staticsMap[key]));
  }
  addSchemaProperties(additionalProperties) {
    const {schema} = this;
    Object.assign(schema, additionalProperties);
  }
  pre(hookName, callback) {
    this.hooks.pre(hookName, callback);
  }
  post(hookName, callback) {
    this.hooks.post(hookName, callback);
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#insertOne
  async insertOne(document: TSchema, options: CollectionInsertOneOptions = {}): Promise<InsertOneWriteOpResult> {
    await this.hooks.execManyPre(['insert', 'insertOne'], [document, options]);
    const response = await this.collection.insertOne(document, options);
    /* [ 'result', 'connection', 'message', 'ops', 'insertedCount', 'insertedId' ] */
    const {result, ops, insertedCount, insertedId} = response;
    await this.hooks.execManyPost(['insert', 'insertOne'], [document, {result, ops, insertedCount, insertedId}]);
    return response;
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#insertMany
  async insertMany(documents: TSchema[], options: CollectionInsertManyOptions = {}): Promise<InsertWriteOpResult> {
    // PreHooks handling
    const eachPreArgs = documents.reduce((soFar, document) => soFar.concat([[document]]), []);
    await this.hooks.execEachPre('insert', eachPreArgs);
    await this.hooks.execPre('insertMany', [documents]);
    // Actual mongodb operation
    const response = await this.collection.insertMany(documents, options);
    const {result, ops, insertedCount, insertedIds} = response;
    // PostHooks handling
    const eachPostArgs = documents.reduce(
      (soFar, document, index) =>
        soFar.concat([[document, {result, ops: [ops[index]], insertedCount: 1, insertedId: insertedIds[index]}]]),
      []
    );
    await this.hooks.execEachPost('insert', eachPostArgs);
    await this.hooks.execPost('insertMany', [documents, {result, ops, insertedCount, insertedIds}]);
    return response;
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#updateOne
  async updateOne(
    filter: FilterQuery<TSchema>,
    update: UpdateQuery<TSchema> | TSchema,
    options: ReplaceOneOptions = {}
  ): Promise<UpdateWriteOpResult> {
    // PreHooks handling
    await this.hooks.execManyPre(['update', 'updateOne'], [filter, update]);
    // Actual mongodb operation
    const response = await this.collection.updateOne(filter, update, options);
    const {result, modifiedCount, matchedCount, upsertedId, upsertedCount} = response;
    // PostHooks handling
    await this.hooks.execManyPost(
      ['update', 'updateOne'],
      [filter, update, {result, modifiedCount, matchedCount, upsertedId, upsertedCount}]
    );
    return response;
  }

  // only gets previous version of object
  async findOneAndUpdate(
    filter: FilterQuery<TSchema>,
    update: Object,
    options: FindOneAndReplaceOption = {}
  ): Promise<FindAndModifyWriteOpResultObject<TSchema>> {
    // PreHooks handling
    const opMap = new Map();
    await this.hooks.execManyPre([/* 'find', 'findOne' */ 'findOneAndUpdate'], [filter, update, options, opMap]);
    // Actual mongodb operation
    const resultObject = await this.collection.findOneAndUpdate(filter, update, options);
    /* { lastErrorObject: { n: 1, updatedExisting: true }, value: { _id: 5bca326a2717959b7cadf0d0, verificationCode: 1234 }, ok: 1 } */
    // PostHooks handling
    await this.hooks.execManyPost(
      [/* 'find', 'findOne' */ 'findOneAndUpdate'],
      [resultObject, filter, update, options, opMap]
    );
    return resultObject;
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#findOne
  async findOne(query: FilterQuery<TSchema>, options: FindOneOptions = {}): Promise<TSchema | null> {
    // PreHooks handling
    const opMap = new Map();
    await this.hooks.execManyPre(['find', 'findOne'], [query, options, opMap]);
    // Actual mongodb operation
    const maybeDocument = await this.collection.findOne(query, options);
    // PostHooks handling
    await this.hooks.execManyPost(['find', 'findOne'], [maybeDocument, query, options, opMap]);
    return maybeDocument;
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#find
  async find(query: FilterQuery<TSchema>, options: FindOneOptions = {}): Promise<Array<TSchema | null>> {
    // PreHooks handling
    const opMap = new Map();
    await this.hooks.execManyPre(['find', 'findMany'], [query, options, opMap]);
    // Actual mongodb operation
    const documents = await this.collection.find(query, options).toArray();
    // PostHooks handling
    const eachPostArgs = documents.reduce((soFar, document) => soFar.concat([[document, query, options, opMap]]), []);
    await this.hooks.execEachPost('find', eachPostArgs);
    await this.hooks.execPost('findMany', [documents, query, options, opMap]);
    return documents;
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#deleteOne
  async deleteOne(
    filter: FilterQuery<TSchema>,
    options: CommonOptions & {bypassDocumentValidation?: boolean} = {}
  ): Promise<DeleteWriteOpResultObject> {
    // PreHooks handling
    const opMap = new Map();
    await this.hooks.execManyPre(['delete', 'deleteOne'], [filter, options, opMap]);
    // Actual mongodb operation
    const resultObject = await this.collection.deleteOne(filter, options);
    // PostHooks handling
    await this.hooks.execManyPost(['delete', 'deleteOne'], [resultObject, filter, options, opMap]);
    return resultObject;
  }

  // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#deleteMany
  async deleteMany(filter: FilterQuery<TSchema>, options: CommonOptions = {}): Promise<DeleteWriteOpResultObject> {
    // PreHooks handling
    const opMap = new Map();
    await this.hooks.execManyPre(['delete', 'deleteMany'], [filter, options, opMap]);
    // Actual mongodb operation
    const resultObject = await this.collection.deleteMany(filter, options);
    // [ 'result', 'connection', 'message', 'deletedCount' ]
    // const {result, deletedCount} = resultObject;
    // PostHooks handling
    await this.hooks.execManyPost(['delete', 'deleteMany'], [resultObject, filter, options, opMap]);
    return resultObject;
  }
}
//

/*

  // const collection = database.collection('users');
  // const changeStream = collection.watch([{$match: {operationType: 'insert'}}]);
  // while (await changeStream.hasNext()) {
  //   const changeEvent = await changeStream.next();
  //   d(changeEvent.operationType, changeEvent.fullDocument);
  //   // process doc here
  // }
  */

/*
connect.Binary = core.BSON.Binary;
connect.Code = core.BSON.Code;
connect.Map = core.BSON.Map;
connect.DBRef = core.BSON.DBRef;
connect.Double = core.BSON.Double;
connect.Int32 = core.BSON.Int32;
connect.Long = core.BSON.Long;
connect.MinKey = core.BSON.MinKey;
connect.MaxKey = core.BSON.MaxKey;
connect.ObjectID = core.BSON.ObjectID;
connect.ObjectId = core.BSON.ObjectID;
connect.Symbol = core.BSON.Symbol;
connect.Timestamp = core.BSON.Timestamp;
connect.BSONRegExp = core.BSON.BSONRegExp;
connect.Decimal128 = core.BSON.Decimal128;
*/

/*
db.createCollection("students", {
   validator: {
      $jsonSchema: {
         bsonType: "object",
         required: [ "name", "year", "major", "gpa" ],
         properties: {
            name: {
               bsonType: "string",
               description: "must be a string and is required"
            },
            gender: {
               bsonType: "string",
               description: "must be a string and is not required"
            },
            year: {
               bsonType: "int",
               minimum: 2017,
               maximum: 3017,
               exclusiveMaximum: false,
               description: "must be an integer in [ 2017, 3017 ] and is required"
            },
            major: {
               enum: [ "Math", "English", "Computer Science", "History", null ],
               description: "can only be one of the enum values and is required"
            },
            gpa: {
               bsonType: [ "double" ],
               description: "must be a double and is required"
            }
         }
      }
   }
})
*/
