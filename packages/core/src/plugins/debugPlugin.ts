import {ClientSession, CollectionCreateOptions} from 'mongodb';
import {Model, ModelHookName} from '../model';
import {DefaultSchema} from '../schema';
import {OperationMap} from '../operation';
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

export const debugPlugin = <TSchema extends DefaultSchema = DefaultSchema>(model: Model<TSchema>): void => {
  const {collectionName} = model;

  const logMethodOperation = (method: string, operation: OperationMap<TSchema>, ...args: any[]) => {
    if (operation.get('method') !== method) {
      return;
    }
    const stringifiedOptions = stringifyOptions(args[args.length - 1]);
    log(`db.${collectionName}.${method}(${args.slice(0, -1).map(inspect).join(', ')}, ${inspect(stringifiedOptions)})`);
  };

  const handleMongoError = (operation: OperationMap<TSchema>) => {
    const error = operation.get('error')!;
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

  const loggedPreHooks: ModelHookName[] = [
    'aggregate',
    'insertOne',
    'replaceOne',
    'insertMany',
    'updateOne',
    'updateMany',
    'findOneAndUpdate',
    'findOne',
    'findMany',
    'deleteOne',
    'deleteMany'
  ];
  loggedPreHooks.forEach((name) => {
    model.pre(name, (operation: OperationMap<TSchema>, ...args: unknown[]) => {
      logMethodOperation(name, operation, ...args);
    });
  });

  // ms-perf
  /*
  const timeSymbol = Symbol('time');
  model.pre('findOne', (query, options: FindOneOptions, operation) => {
    operation.set(timeSymbol, Date.now());
  });
  model.post('findOne', (doc: T, query, options: FindOneOptions, operation) => {
    const elapsed = Date.now() - operation.get(timeSymbol);
    log(`${inspect(doc)} returned in ${inspect(elapsed)}ms`);
  });
  */

  // ns-perf
  const NS_PER_SEC = 1e9;
  const hrtimeSymbol = Symbol('hrtime');
  model.pre('aggregate', (operation) => {
    operation.set(hrtimeSymbol, process.hrtime());
  });
  model.post('aggregate', (operation) => {
    const docs = operation.get('result');
    const diff = process.hrtime(operation.get(hrtimeSymbol));
    const elapsed = (diff[0] * NS_PER_SEC + diff[1]) / 1e6;
    log(
      `db.${collectionName}.aggregate: ${inspect(docs.length)}-document(s) returned in ${chalkNumber(
        elapsed.toPrecision(3)
      )}ms`
    );
  });
  model.pre('findMany', (operation) => {
    operation.set(hrtimeSymbol, process.hrtime());
  });
  model.post('findMany', (operation) => {
    const docs = operation.get('result');
    const diff = process.hrtime(operation.get(hrtimeSymbol));
    const elapsed = (diff[0] * NS_PER_SEC + diff[1]) / 1e6;
    log(
      `db.${collectionName}.find: ${chalkNumber(docs.length)}-result(s) returned in ${chalkNumber(
        elapsed.toPrecision(3)
      )}ms`
    );
  });
  model.pre('findOne', (operation) => {
    operation.set(hrtimeSymbol, process.hrtime());
  });
  model.post('findOne', (operation) => {
    const doc = operation.get('result');
    const diff = process.hrtime(operation.get(hrtimeSymbol));
    const elapsed = (diff[0] * NS_PER_SEC + diff[1]) / 1e6;
    log(
      `db.${collectionName}.findOne: ${chalkNumber(doc ? '1' : '0')}-result(s) returned in ${chalkNumber(
        elapsed.toPrecision(3)
      )}ms`
    );
  });

  model.pre('aggregate', (operation) => {
    operation.set(hrtimeSymbol, process.hrtime());
  });
  model.post('aggregate', (operation) => {
    const doc = operation.get('result');
    const diff = process.hrtime(operation.get(hrtimeSymbol));
    const elapsed = (diff[0] * NS_PER_SEC + diff[1]) / 1e6;
    log(
      `db.${collectionName}.aggregate: ${chalkNumber(doc ? '1' : '0')}-result(s) returned in ${chalkNumber(
        elapsed.toPrecision(3)
      )}ms`
    );
  });
};
