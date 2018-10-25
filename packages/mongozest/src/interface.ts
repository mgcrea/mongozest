// @source  https://github.com/Automattic/mongoose/blob/master/lib/connection.js#L518
// @docs https://gist.github.com/brennanMKE/ee8ea002d305d4539ef6

import {MongoClient} from 'mongodb';
import Model from './model';

// @types
import {Db as MongoDb, MongoClientOptions} from 'mongodb';

const DEFAULT_MONGODB_URI = 'mongodb://mongo:27017';

export default class MongoInterface {
  static defaultClientUri = DEFAULT_MONGODB_URI;
  static defaultClientOptions: MongoClientOptions = {
    loggerLevel: 'error',
    useNewUrlParser: true
  };
  static create(uri: string = MongoInterface.defaultClientUri, options?: MongoClientOptions) {
    return new MongoInterface(uri, options);
  }
  client: MongoClient;
  // models: {[modelName: string]: Model} = {};
  private models: Map<string, Model> = new Map();
  db: MongoDb;

  private constructor(uri: string, options?: MongoClientOptions) {
    this.client = new MongoClient(uri, {...MongoInterface.defaultClientOptions, ...options});
  }
  public async connect(dbName = 'test'): Promise<MongoDb> {
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
  public async loadModels(Models: {[s: string]: ModelConstructor}): Promise<{[s: string]: Model}> {
    return await Object.keys(Models).reduce(async (promiseSoFar, key) => {
      const soFar = await promiseSoFar;
      soFar[key] = await this.loadModel(Models[key]);
      return soFar;
    }, Promise.resolve({}));
  }
  public async loadModel(Model: ModelConstructor): Promise<Model> {
    const {name: className, modelName: classModelName} = Model;
    const modelName = classModelName || className;
    if (this.models.has(modelName)) {
      return Promise.resolve(this.models.get(modelName) as Model);
    }
    // const model = Model.create();
    const model = new Model(this.db);
    const modelProxy = new Proxy(model, {
      get: function(target, name, receiver) {
        // Skip proxy's constructor
        if (name === 'constructor') {
          return model.constructor;
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
    await modelProxy.initialize();
    return modelProxy;
  }
  public model(modelName: string) {
    if (!this.models.has(modelName)) {
      throw new Error(`model ${modelName} not loaded`);
    }
    return this.models.get(modelName);
  }
}
