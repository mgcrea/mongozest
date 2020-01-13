// @source  https://github.com/Automattic/mongoose/blob/master/lib/connection.js#L518
// @docs https://gist.github.com/brennanMKE/ee8ea002d305d4539ef6

import assert from 'assert';
import {MongoClient, ObjectId} from 'mongodb';
import {parse} from 'url';
import Model from './model';

// @types
import {Db as MongoDb, MongoClientOptions} from 'mongodb';

const DEFAULT_MONGODB_URI = 'mongodb://mongo:27017';

// global interfaces
const interfaces: Map<string, MongoInterface> = new Map();

export default class MongoInterface<TSchema = any> {
  static defaultClientUri = DEFAULT_MONGODB_URI;
  static defaultClientOptions: MongoClientOptions = {
    loggerLevel: 'error',
    useNewUrlParser: true
  };
  static create(uri: string = MongoInterface.defaultClientUri, options?: MongoClientOptions): MongoInterface {
    // reuse interface if already created for uri
    // @TODO add option
    if (interfaces.has(uri)) {
      return interfaces.get(uri) as MongoInterface;
    }
    const mongoInterface = new MongoInterface(uri, options);
    interfaces.set(uri, mongoInterface);
    return mongoInterface;
  }
  client: MongoClient;
  private dbName: string;
  private models: Map<string, Model<TSchema>> = new Map();
  id: ObjectId;
  db: MongoDb;

  private constructor(uri: string, options?: MongoClientOptions) {
    const {protocol = 'mongodb:', hostname = '127.0.0.1', port = '27017', pathname} = parse(uri);
    this.id = new ObjectId();
    this.dbName = pathname ? String(pathname).slice(1) : 'test';
    this.client = new MongoClient(`${protocol}//${hostname}:${port}`, {
      ...MongoInterface.defaultClientOptions,
      ...options
    });
  }
  public async connect(dbName = this.dbName): Promise<MongoDb> {
    await this.client.connect();
    this.db = this.client.db(dbName);
    return this.db;
  }
  public async disconnect(): Promise<void> {
    await this.client.close();
  }
  // public async loadModels(Models: Array<Model>): Promise<any> {
  //   return Promise.all(Models.map(Model => this.loadModel(Model)));
  // }
  public async loadModels(
    Models: Array<ModelConstructor> | {[s: string]: ModelConstructor}
  ): Promise<{[s: string]: Model}> {
    const ModelsAsArray = (Array.isArray(Models) ? Models : Object.keys(Models).map(key => Models[key])).filter(
      Boolean
    );
    return await ModelsAsArray.reduce(async (promiseSoFar, Model) => {
      const soFar = await promiseSoFar;
      return soFar.concat(await this.loadModel(Model));
    }, Promise.resolve([]));
  }
  public async loadModel(Model: ModelConstructor): Promise<Model> {
    const {client} = this;
    const {name: className, modelName: classModelName} = Model;
    const modelName = classModelName || className;
    if (this.models.has(modelName)) {
      return Promise.resolve(this.models.get(modelName) as Model);
    }
    const startSession = client.startSession.bind(client);
    // const model = Model.create();
    assert(this.db, 'Missing db instance, please connect first');
    const model = new Model(this.db);
    const modelProxy: Model<TSchema> = new Proxy(model, {
      get: function(target, name, receiver) {
        // Skip proxy's constructor
        if (name === 'constructor') {
          return model.constructor;
        }
        // Expose startSession
        if (name === 'startSession') {
          return startSession;
        }
        // Wire added statics methods
        if (target.statics.has(name)) {
          return target.statics.get(name);
        }
        // Original call
        return target[name];
      }
    });
    // Publish model getter for easier traversing
    modelProxy.otherModel = this.model.bind(this);
    modelProxy.allModels = () => this.models;
    this.models.set(modelName, modelProxy);
    // @TODO add timeout for database stalling
    await modelProxy.initialize();
    return modelProxy;
  }
  public model<TSchema>(modelName: string): Model<TSchema> {
    if (!this.models.has(modelName)) {
      throw new Error(`model ${modelName} not loaded`);
    }
    const model = this.models.get(modelName);
    return model as Model<TSchema>;
  }
}