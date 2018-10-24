
/// <reference types="mongodb" />

// import MulterFile = Express.Multer.File;


export {
  Db,
  Collection,
  CollectionInsertOneOptions,
  CollectionInsertManyOptions,
  InsertOneWriteOpResult,
  InsertWriteOpResult,
  FilterQuery,
  FindOneOptions,
  ObjectId,
  UpdateQuery,
  UpdateWriteOpResult,
  ReplaceOneOptions
} from 'mongodb';

// namespace MongoDBLeaf {
  // Documentation : http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html
  // interface Model<TSchema = Default> {
  //   findOne<T = TSchema>(filter: FilterQuery<TSchema>, options?: FindOneOptions): Promise<T | null>;
  //   insertMany(docs: TSchema[], options?: CollectionInsertManyOptions): Promise<InsertWriteOpResult>;
  //   insertOne(docs: TSchema, options?: CollectionInsertOneOptions): Promise<InsertOneWriteOpResult>;
  //   updateMany(filter: FilterQuery<TSchema>, update: UpdateQuery<TSchema> | TSchema, options?: CommonOptions & { upsert?: boolean }): Promise<UpdateWriteOpResult>;
  //   updateOne(filter: FilterQuery<TSchema>, update: UpdateQuery<TSchema> | TSchema, options?: ReplaceOneOptions): Promise<UpdateWriteOpResult>;
  // }
// }

