import {
  ClientSession,
  CollectionAggregationOptions,
  CollectionCreateOptions,
  CollectionInsertOneOptions,
  CommonOptions,
  FilterQuery,
  FindOneOptions,
  ReplaceOneOptions,
  UpdateManyOptions,
  UpdateQuery
} from 'mongodb';
import {BaseSchema} from 'src/schema';
import type {AggregatePipeline, OperationMap} from 'src/typings';
import {Model} from '..';
import {chalk, chalkNumber, chalkString, inspect, log} from './../utils/logger';

const {NODE_DEBUG = '0'} = process.env;
const IS_DEBUG = NODE_DEBUG === '1';

const stringifyOptions = <T extends {session?: ClientSession; [s: string]: any}>(
  options: T | undefined = {} as T
): Omit<T, 'session'> & {session?: string} => {
  const {session, ...otherOptions} = options;
  if (session) {
    const {id} = session.id;
    Object.assign(otherOptions, {session: `[ClientSession: ${id.toString('hex')}]`});
  }
  return otherOptions;
};

export const debugPlugin = <TSchema extends BaseSchema = BaseSchema>(model: Model<TSchema>): void => {
  const {collectionName} = model;

  const handleMongoError = (...params: [OperationMap]) => {
    const operation = params[params.length - 1];
    const error = operation.get('error');
    const method = operation.get('method');
    log(chalk.red(`db.${collectionName}.${method} failed with error.message=${chalkString(error.message)}`));
    error.message = `${error.message} (db.${collectionName}.${method})`;
  };
  model.post('error', handleMongoError);

  if (IS_DEBUG) {
    model.pre('setup', (options: CollectionCreateOptions, {doesExist}: {doesExist: boolean}) => {
      if (!doesExist) {
        log(`db.createCollection("${collectionName}", ${inspect(stringifyOptions(options))})`);
      } else {
        log(`db.command(${inspect({collMod: collectionName, ...options})}`);
      }
    });
  }
  model.pre('aggregate', (pipeline?: AggregatePipeline, options?: CollectionAggregationOptions) => {
    log(`db.${collectionName}.aggregate(${inspect(pipeline)}, ${inspect(stringifyOptions(options))})`);
  });
  model.pre('insertOne', (document: TSchema, options: CollectionInsertOneOptions) => {
    log(`db.${collectionName}.insertOne(${inspect(document)}, ${inspect(stringifyOptions(options))})`);
  });
  model.pre('replaceOne', (filter: FilterQuery<TSchema>, document: TSchema, options: ReplaceOneOptions) => {
    log(
      `db.${collectionName}.replaceOne(${inspect(filter)}, ${inspect(document)}, ${inspect(stringifyOptions(options))})`
    );
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
      log(
        `db.${collectionName}.${method}(${inspect(filter)}, ${inspect(update)}), ${inspect(stringifyOptions(options))}`
      );
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
      const method = operation.get('method');
      if (method !== 'updateMany') {
        return;
      }
      log(
        `db.${collectionName}.${method}(${inspect(filter)}, ${inspect(update)}), ${inspect(stringifyOptions(options))}`
      );
    }
  );
  model.pre(
    'findOneAndUpdate',
    (
      filter: FilterQuery<TSchema>,
      update: UpdateQuery<TSchema> | TSchema,
      options: FindOneOptions<TSchema>,
      operation: OperationMap
    ) => {
      const method = operation.get('method');
      if (method !== 'findOneAndUpdate') {
        return;
      }
      log(
        `db.${collectionName}.${method}(${inspect(filter)}, ${inspect(update)}, ${inspect(stringifyOptions(options))})`
      );
    }
  );
  model.pre('findOne', (query: FilterQuery<TSchema>, options: FindOneOptions<TSchema>, operation: OperationMap) => {
    const method = operation.get('method');
    if (method !== 'findOne') {
      return;
    }
    log(`db.${collectionName}.${method}(${inspect(query)}, ${inspect(stringifyOptions(options))})`);
  });
  model.pre('findMany', (query: FilterQuery<TSchema>, options: FindOneOptions<TSchema>, operation: OperationMap) => {
    const method = operation.get('method');
    if (method !== 'find') {
      return;
    }
    log(`db.${collectionName}.${method}(${inspect(query)}, ${inspect(stringifyOptions(options))})`);
  });
  model.pre(
    'deleteOne',
    (
      filter: FilterQuery<TSchema>,
      options: CommonOptions & {bypassDocumentValidation?: boolean},
      operation: OperationMap
    ) => {
      const method = operation.get('method');
      if (method !== 'deleteOne') {
        return;
      }
      log(`db.${collectionName}.deleteOne(${inspect(filter)}, ${inspect(stringifyOptions(options))})`);
    }
  );
  model.pre('deleteMany', (filter: FilterQuery<TSchema>, options: CommonOptions, operation: OperationMap) => {
    const method = operation.get('method');
    if (method !== 'deleteMany') {
      return;
    }
    log(`db.${collectionName}.deleteMany(${inspect(filter)}, ${inspect(stringifyOptions(options))})`);
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
    (pipeline: AggregatePipeline, options: CollectionAggregationOptions, operation: OperationMap) => {
      operation.set(hrtimeSymbol, process.hrtime());
    }
  );
  model.post(
    'aggregate',
    (pipeline: AggregatePipeline, options: CollectionAggregationOptions, operation: OperationMap) => {
      const docs = operation.get('result');
      const diff = process.hrtime(operation.get(hrtimeSymbol));
      const elapsed = (diff[0] * NS_PER_SEC + diff[1]) / 1e6;
      log(
        `db.${collectionName}.aggregate: ${inspect(docs.length)}-document(s) returned in ${chalkNumber(
          elapsed.toPrecision(3)
        )}ms`
      );
    }
  );
  model.pre('findMany', (query: FilterQuery<TSchema>, options: FindOneOptions<TSchema>, operation: OperationMap) => {
    operation.set(hrtimeSymbol, process.hrtime());
  });
  model.post('findMany', (query: FilterQuery<TSchema>, options: FindOneOptions<TSchema>, operation: OperationMap) => {
    const docs = operation.get('result');
    const diff = process.hrtime(operation.get(hrtimeSymbol));
    const elapsed = (diff[0] * NS_PER_SEC + diff[1]) / 1e6;
    log(
      `db.${collectionName}.find: ${chalkNumber(docs.length)}-result(s) returned in ${chalkNumber(
        elapsed.toPrecision(3)
      )}ms`
    );
  });
  model.pre('findOne', (query: FilterQuery<TSchema>, options: FindOneOptions<TSchema>, operation: OperationMap) => {
    operation.set(hrtimeSymbol, process.hrtime());
  });
  model.post('findOne', (query: FilterQuery<TSchema>, options: FindOneOptions<TSchema>, operation: OperationMap) => {
    const doc = operation.get('result');
    const diff = process.hrtime(operation.get(hrtimeSymbol));
    const elapsed = (diff[0] * NS_PER_SEC + diff[1]) / 1e6;
    log(
      `db.${collectionName}.findOne: ${chalkNumber(doc ? '1' : '0')}-result(s) returned in ${chalkNumber(
        elapsed.toPrecision(3)
      )}ms`
    );
  });

  model.pre(
    'aggregate',
    (pipeline: Array<Record<string, unknown>>, options: CollectionAggregationOptions, operation: OperationMap) => {
      operation.set(hrtimeSymbol, process.hrtime());
    }
  );
  model.post(
    'aggregate',
    (pipeline: Array<Record<string, unknown>>, options: CollectionAggregationOptions, operation: OperationMap) => {
      const doc = operation.get('result');
      const diff = process.hrtime(operation.get(hrtimeSymbol));
      const elapsed = (diff[0] * NS_PER_SEC + diff[1]) / 1e6;
      log(
        `db.${collectionName}.aggregate: ${chalkNumber(doc ? '1' : '0')}-result(s) returned in ${chalkNumber(
          elapsed.toPrecision(3)
        )}ms`
      );
    }
  );
};
