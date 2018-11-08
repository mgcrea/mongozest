// declare const Model: any;
export {ObjectId, MongoError} from 'mongodb';
// export {Model};

declare function mongozest(uri: string = MongoInterface.defaultClientUri, options?: MongoClientOptions): MongoInterface;

declare namespace mongozest {
  class Interface {
    connect(dbName: string): Promise<MongoDb>
    loadModel(Model: ModelConstructor): Promise<Model>
    loadModels(Models: {[s: string]: ModelConstructor}): Promise<{[s: string]: Model}>
  }
  interface ModelConstructor {
    new (): Model;
  }
  class Model<TSchema = Default> {
    addStatics(staticsMap: any): void;
    otherModel(modelName: string): Model;
    findOne<T = TSchema>(filter: FilterQuery<TSchema>, options?: FindOneOptions): Promise<T | null>;
    findOneAndUpdate(filter: FilterQuery<TSchema>, update: Object, options?: FindOneAndReplaceOption): Promise<FindAndModifyWriteOpResultObject<TSchema>>;
    insertMany(docs: TSchema[], options?: CollectionInsertManyOptions): Promise<InsertWriteOpResult>;
    insertOne(docs: TSchema, options?: CollectionInsertOneOptions): Promise<InsertOneWriteOpResult>;
    replaceOne(filter: FilterQuery<TSchema>, document: TSchema, options?: ReplaceOneOptions): Promise<ReplaceWriteOpResult>;
    updateMany(filter: FilterQuery<TSchema>, update: UpdateQuery<TSchema> | TSchema, options?: CommonOptions & { upsert?: boolean }): Promise<UpdateWriteOpResult>;
    updateOne(filter: FilterQuery<TSchema>, update: UpdateQuery<TSchema> | TSchema, options?: ReplaceOneOptions): Promise<UpdateWriteOpResult>;
  }
  function collectionDefaultsPlugin(model: Model, options: any);
  function schemaIndexesPlugin(model: Model, options: any);
  function schemaDefaultsPlugin(model: Model, options: any);
  function lastModifiedPlugin(model: Model, options: any);
  function shortIdPlugin(model: Model, options: any);
}

export = mongozest;