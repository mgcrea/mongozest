import {log, inspect} from './../utils/logger';
import {Model} from '..';

const {NODE_DEBUG = '0'} = process.env;
const IS_DEBUG = NODE_DEBUG === '1';

export default function debugPlugin(model: Model, options) {
  const {collectionName} = model;
  if (IS_DEBUG) {
    model.pre('setup', (options: CollectionCreateOptions, {doesExist}) => {
      if (!doesExist) {
        log(`db.createCollection("${collectionName}", ${inspect(options)})`);
      } else {
        log(`db.command(${inspect({collMod: collectionName, ...options})}`);
      }
    });
  }
  model.pre('insertOne', (document: TSchema, options: CollectionInsertOneOptions) => {
    log(`db.${collectionName}.insertOne(${inspect(document)}, ${inspect(options)})`);
  });
  model.pre('replaceOne', (filter: FilterQuery<TSchema>, document: TSchema, options: ReplaceOneOptions) => {
    log(`db.${collectionName}.replaceOne(${inspect(filter)}, ${inspect(document)}, ${inspect(options)})`);
  });
  model.pre('insertMany', (docs: TSchema[]) => {
    log(`db.${collectionName}.insertMany(${inspect(docs)})`);
  });
  model.pre(
    'updateOne',
    (
      filter: FilterQuery<TSchema>,
      update: UpdateQuery<TSchema> | TSchema,
      options: ReplaceOneOptions,
      operation: OperationMap
    ) => {
      const method = operation.get('method');
      if (method !== 'updateOne') {
        return;
      }
      log(`db.${collectionName}.updateOne(${inspect(filter)}, ${inspect(update)}), ${inspect(options)}`);
    }
  );
  model.pre(
    'updateMany',
    (
      filter: FilterQuery<TSchema>,
      update: UpdateQuery<TSchema> | TSchema,
      options: UpdateManyOptions,
      operation: OperationMap
    ) => {
      log(`db.${collectionName}.updateMany(${inspect(filter)}, ${inspect(update)}), ${inspect(options)}`);
    }
  );
  model.pre(
    'findOneAndUpdate',
    (
      filter: FilterQuery<TSchema>,
      update: UpdateQuery<TSchema> | TSchema,
      options: FindOneOptions,
      operation: OperationMap
    ) => {
      log(`db.${collectionName}.findOneAndUpdate(${inspect(filter)}, ${inspect(update)}, ${inspect(options)})`);
    }
  );
  model.pre('findOne', (query: FilterQuery<TSchema>, options: FindOneOptions, operation: OperationMap) => {
    log(`db.${collectionName}.findOne(${inspect(query)}, ${inspect(options)})`);
  });
  model.pre('findMany', (query: FilterQuery<TSchema>, options: FindOneOptions) => {
    log(`db.${collectionName}.find(${inspect(query)}, ${inspect(options)})`);
  });
  model.pre(
    'deleteOne',
    (
      filter: FilterQuery<TSchema>,
      options: CommonOptions & {bypassDocumentValidation?: boolean},
      operation: OperationMap
    ) => {
      log(`db.${collectionName}.deleteOne(${inspect(filter)}, ${inspect(options)})`);
    }
  );
  model.pre('deleteMany', (filter: FilterQuery<TSchema>, options: CommonOptions) => {
    log(`db.${collectionName}.deleteMany(${inspect(filter)}, ${inspect(options)})`);
  });

  // ms-perf
  /*
  const timeSymbol = Symbol('time');
  model.pre('findOne', (query: FilterQuery<TSchema>, options: FindOneOptions, operation: OperationMap) => {
    operation.set(timeSymbol, Date.now());
  });
  model.post('findOne', (doc: T, query: FilterQuery<TSchema>, options: FindOneOptions, operation: OperationMap) => {
    const elapsed = Date.now() - operation.get(timeSymbol);
    log(`${inspect(doc)} returned in ${inspect(elapsed)}ms`);
  });
  */

  // ns-perf
  const NS_PER_SEC = 1e9;
  const hrtimeSymbol = Symbol('hrtime');
  model.pre('findOne', (query: FilterQuery<TSchema>, options: FindOneOptions, operation: OperationMap) => {
    operation.set(hrtimeSymbol, process.hrtime());
  });
  model.post('findOne', (query: FilterQuery<TSchema>, options: FindOneOptions, operation: OperationMap) => {
    const doc = operation.get('result');
    const diff = process.hrtime(operation.get(hrtimeSymbol));
    const elapsed = (diff[0] * NS_PER_SEC + diff[1]) / 1e6;
    log(`${inspect(doc)} returned in ${inspect(elapsed.toPrecision(3) * 1)}ms`);
  });
}
