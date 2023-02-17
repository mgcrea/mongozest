// @source  https://github.com/Automattic/mongoose/blob/master/lib/connection.js#L518
// @docs https://gist.github.com/brennanMKE/ee8ea002d305d4539ef6

import assert from 'assert';
import { ClientSession, Db as MongoDb, MongoClient, MongoClientOptions, ObjectId, SessionOptions } from 'mongodb';
import { parse } from 'url';
import { Model, ModelConstructor } from './model';
import type { AnySchema, DefaultSchema } from './typings';

const DEFAULT_MONGODB_URI = 'mongodb://mongo:27017';

const interfaces: Map<string, MongoInterface> = new Map();

// @TODO type global model store
export class MongoInterface {
  static defaultClientUri = DEFAULT_MONGODB_URI;
  static defaultClientOptions: MongoClientOptions = {
    loggerLevel: 'error',
    useUnifiedTopology: true,
    useNewUrlParser: true,
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
  private models: Map<string, Model<AnySchema>> = new Map();
  db: MongoDb | null = null;
  id: ObjectId;

  private constructor(uri: string, options?: MongoClientOptions) {
    const { pathname } = parse(uri);
    this.id = new ObjectId();
    this.dbName = pathname ? String(pathname).slice(1) : 'test';
    this.client = new MongoClient(uri, {
      ...MongoInterface.defaultClientOptions,
      ...options,
    });
  }
  public async connect(dbName = this.dbName): Promise<MongoDb> {
    await this.client.connect();
    this.db = this.client.db(dbName);
    return this.db;
  }
  public async disconnect(): Promise<void> {
    if (!this.client.isConnected()) {
      return;
    }
    await this.client.close();
  }
  public async loadModels(modelClasses: Record<string, ModelConstructor>): Promise<Record<string, Model>> {
    const loadedModels = await Object.keys(modelClasses).reduce<Promise<Record<string, Model>>>(
      async (promiseSoFar, modelName) => {
        const soFar = await promiseSoFar;
        soFar[modelName] = await this.loadModel(modelClasses[modelName], true);
        return soFar;
      },
      Promise.resolve({})
    );

    const initializedModels = await Object.keys(loadedModels).reduce<Promise<Record<string, Model>>>(
      async (promiseSoFar, modelName) => {
        const soFar = await promiseSoFar;
        await loadedModels[modelName].initialize();
        soFar[modelName] = loadedModels[modelName];
        return soFar;
      },
      Promise.resolve({})
    );

    return initializedModels;
  }

  public async loadModel<TSchema extends AnySchema>(
    ModelClass: ModelConstructor<TSchema>,
    skipInitialization?: boolean
  ): Promise<Model<TSchema>> {
    const { client } = this;
    const { name: className, modelName: classModelName } = ModelClass;
    const modelName = classModelName || className;
    if (this.models.has(modelName)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return Promise.resolve((this.models.get(modelName)! as unknown) as Model<TSchema>);
    }
    const startSession = client.startSession.bind(client);
    // const model = Model.create();
    assert(this.db, 'Missing db instance, please connect first');
    const model = new ModelClass(this.db as MongoDb);
    const modelProxy = new Proxy<Model<TSchema>>(model, {
      get: function (target, name) {
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
      },
    });
    // Publish model getter for easier traversing
    modelProxy.otherModel = this.model.bind(this);
    modelProxy.allModels = () => this.models;
    this.models.set(modelName, (modelProxy as unknown) as Model);
    // @TODO add timeout for database stalling
    if (!skipInitialization) {
      await modelProxy.initialize();
    }
    return modelProxy;
  }
  public model<OSchema extends AnySchema = DefaultSchema>(modelName: string): Model<OSchema> {
    if (!this.models.has(modelName)) {
      throw new Error(`model ${modelName} not loaded`);
    }
    return (this.models.get(modelName) as unknown) as Model<OSchema>;
  }
}

declare module './model' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Model<TSchema extends AnySchema = DefaultSchema> {
    startSession: (options?: SessionOptions) => ClientSession;
    otherModel: <OSchema extends DefaultSchema = DefaultSchema>(modelName: string) => Model<OSchema>;
    allModels: () => Map<string, Model>;
  }
}
