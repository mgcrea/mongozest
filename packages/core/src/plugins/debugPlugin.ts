import {log, inspect, chalkNumber, chalk, chalkString} from './../utils/logger';
import {Model, ObjectId, OperationMap} from '..';
import {FilterQuery, UpdateQuery, ReplaceOneOptions, UpdateManyOptions, FindOneOptions} from 'mongodb';

const {NODE_DEBUG = '0'} = process.env;
const IS_DEBUG = NODE_DEBUG === '1';

type AggregatePipeline = Record<string, any>[];

const leanOptions = (options) => {
  const {session, ...otherOptions} = options;
  if (session) {
    const {id} = session.id;
    otherOptions.session = `[ClientSession: ${id.toString('hex')}]`;
  }
  return otherOptions;
};

export default function debugPlugin<TSchema>(model: Model, options) {
  const {collectionName} = model;

  const handleMongoError = (...params) => {
    const operation = params[params.length - 1];
    const error = operation.get('error');
    const method = operation.get('method');
    log(chalk.red(`db.${collectionName}.${method} failed with error.message=${chalkString(error.message)}`));
    error.message = `${error.message} (db.${collectionName}.${method})`;
  };
  model.post('error', handleMongoError);

  if (IS_DEBUG) {
    model.pre('setup', (options: CollectionCreateOptions, {doesExist}) => {
      if (!doesExist) {
        log(`db.createCollection("${collectionName}", ${inspect(leanOptions(options))})`);
      } else {
        log(`db.command(${inspect({collMod: collectionName, ...options})}`);
      }
    });
  }
  model.pre('aggregate', (pipeline?: AggregatePipeline, options?: CollectionAggregationOptions) => {
    log(`db.${collectionName}.aggregate(${inspect(pipeline)}, ${inspect(leanOptions(options))})`);
  });
  model.pre('insertOne', (document: TSchema, options: CollectionInsertOneOptions) => {
    log(`db.${collectionName}.insertOne(${inspect(document)}, ${inspect(leanOptions(options))})`);
  });
  model.pre('replaceOne', (filter: FilterQuery<TSchema>, document: TSchema, options: ReplaceOneOptions) => {
    log(`db.${collectionName}.replaceOne(${inspect(filter)}, ${inspect(document)}, ${inspect(leanOptions(options))})`);
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
      log(`db.${collectionName}.updateOne(${inspect(filter)}, ${inspect(update)}), ${inspect(leanOptions(options))}`);
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
      log(`db.${collectionName}.updateMany(${inspect(filter)}, ${inspect(update)}), ${inspect(leanOptions(options))}`);
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
      log(
        `db.${collectionName}.findOneAndUpdate(${inspect(filter)}, ${inspect(update)}, ${inspect(
          leanOptions(options)
        )})`
      );
    }
  );
  model.pre('findOne', (query: FilterQuery<TSchema>, options: FindOneOptions, operation: OperationMap) => {
    log(`db.${collectionName}.findOne(${inspect(query)}, ${inspect(leanOptions(options))})`);
  });
  model.pre('findMany', (query: FilterQuery<TSchema>, options: FindOneOptions) => {
    log(`db.${collectionName}.find(${inspect(query)}, ${inspect(leanOptions(options))})`);
  });
  model.pre(
    'deleteOne',
    (
      filter: FilterQuery<TSchema>,
      options: CommonOptions & {bypassDocumentValidation?: boolean},
      operation: OperationMap
    ) => {
      log(`db.${collectionName}.deleteOne(${inspect(filter)}, ${inspect(leanOptions(options))})`);
    }
  );
  model.pre('deleteMany', (filter: FilterQuery<TSchema>, options: CommonOptions) => {
    log(`db.${collectionName}.deleteMany(${inspect(filter)}, ${inspect(leanOptions(options))})`);
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
  model.pre(
    'aggregate',
    (pipeline?: AggregatePipeline, options?: CollectionAggregationOptions, operation: OperationMap) => {
      operation.set(hrtimeSymbol, process.hrtime());
    }
  );
  model.post(
    'aggregate',
    (pipeline?: AggregatePipeline, options?: CollectionAggregationOptions, operation: OperationMap) => {
      const docs = operation.get('result');
      const diff = process.hrtime(operation.get(hrtimeSymbol));
      const elapsed = (diff[0] * NS_PER_SEC + diff[1]) / 1e6;
      log(`${inspect(docs.length)}-document(s) returned in ${inspect(elapsed.toPrecision(3) * 1)}ms`);
    }
  );
  model.pre('findMany', (query: FilterQuery<TSchema>, options: FindOneOptions, operation: OperationMap) => {
    operation.set(hrtimeSymbol, process.hrtime());
  });
  model.post('findMany', (query: FilterQuery<TSchema>, options: FindOneOptions, operation: OperationMap) => {
    const docs = operation.get('result');
    const diff = process.hrtime(operation.get(hrtimeSymbol));
    const elapsed = (diff[0] * NS_PER_SEC + diff[1]) / 1e6;
    log(
      `db.${collectionName}.find: ${chalkNumber(docs.length)}-result(s) returned in ${chalkNumber(
        elapsed.toPrecision(3)
      )}ms`
    );
  });
  model.pre('findOne', (query: FilterQuery<TSchema>, options: FindOneOptions, operation: OperationMap) => {
    operation.set(hrtimeSymbol, process.hrtime());
  });
  model.post('findOne', (query: FilterQuery<TSchema>, options: FindOneOptions, operation: OperationMap) => {
    const doc = operation.get('result');
    const diff = process.hrtime(operation.get(hrtimeSymbol));
    const elapsed = (diff[0] * NS_PER_SEC + diff[1]) / 1e6;
    log(
      `db.${collectionName}.findOne: ${chalkNumber(doc ? '1' : '0')}-result(s) returned in ${chalkNumber(
        elapsed.toPrecision(3)
      )}ms`
    );
  });
}
