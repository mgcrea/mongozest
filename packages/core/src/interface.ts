// @source  https://github.com/Automattic/mongoose/blob/master/lib/connection.js#L518
// @docs https://gist.github.com/brennanMKE/ee8ea002d305d4539ef6

import assert from 'assert';
import {Db as MongoDb, MongoClient, MongoClientOptions, ObjectId} from 'mongodb';
import {parse} from 'url';
import Model from './model';
// import {BaseSchema} from './schema';

type ModelProxy = Model & {
  otherModel: (modelName: string) => Model;
  allModels: () => Map<string, Model>;
};

const DEFAULT_MONGODB_URI = 'mongodb://mongo:27017';

const interfaces: Map<string, MongoInterface> = new Map();

export default class MongoInterface {
  static defaultClientUri = DEFAULT_MONGODB_URI;
  static defaultClientOptions: MongoClientOptions = {
    loggerLevel: 'error',
    useUnifiedTopology: true,
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
  private models: Map<string, ModelProxy> = new Map();
  db: MongoDb | null = null;
  id: ObjectId;

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
  public async loadModels(modelClasses: Record<string, typeof Model>): Promise<Record<string, Model>> {
    return await Object.keys(modelClasses).reduce<Promise<Record<string, Model>>>(async (promiseSoFar, key) => {
      const soFar = await promiseSoFar;
      soFar[key] = await this.loadModel(modelClasses[key]);
      return soFar;
    }, Promise.resolve({}));
  }
  public async loadModel(modelClass: typeof Model): Promise<ModelProxy> {
    const {client} = this;
    const {name: className, modelName: classModelName} = modelClass;
    const modelName = classModelName || className;
    if (this.models.has(modelName)) {
      return Promise.resolve(this.models.get(modelName)!);
    }
    const startSession = client.startSession.bind(client);
    // const model = Model.create();
    assert(this.db, 'Missing db instance, please connect first');
    const model = new modelClass(this.db as MongoDb);
    const modelProxy = new Proxy(model, {
      get: function(target, name, _receiver) {
        // Skip proxy's constructor
        if (name === 'constructor') {
          return model.constructor;
        }
        // Expose client.startSession
        if (name === 'startSession') {
          return startSession;
        }
        // Wire added statics methods
        if (target.statics.has(name)) {
          return target.statics.get(name);
        }
        // Original call
        return name in target ? target[name as keyof typeof target] : undefined;
      }
    }) as ModelProxy;
    // Publish model getter for easier traversing
    modelProxy.otherModel = this.model.bind(this);
    modelProxy.allModels = () => this.models;
    this.models.set(modelName, modelProxy);
    // @TODO add timeout for database stalling
    await modelProxy.initialize();
    return modelProxy;
  }
  public model(modelName: string): Model {
    if (!this.models.has(modelName)) {
      throw new Error(`model ${modelName} not loaded`);
    }
    return this.models.get(modelName) as Model;
  }
}
