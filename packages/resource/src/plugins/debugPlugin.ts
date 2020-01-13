import {log, inspect, chalk} from './../utils/logger';
import {Resource} from '..';
import {FilterQuery, CollectionInsertOneOptions, UpdateQuery, FindOneAndReplaceOption} from 'mongodb';

export default function debugPlugin(resource: Resource, options = {}) {
  resource.pre('postCollection', (document: TSchema, options: CollectionInsertOneOptions, operation: OperationMap) => {
    const req = operation.get('request');
    log(`${req.method} ${req.path} ${inspect(req.body)}`);
    // log(`${req.method} ${path} (${inspect(document)}, ${inspect(options)})`);
  });
  resource.pre(
    'patchDocument',
    (
      filter: FilterQuery<TSchema>,
      update: UpdateQuery<TSchema> | TSchema,
      options: FindOneAndReplaceOption,
      operation: OperationMap
    ) => {
      const req = operation.get('request');
      log(`${chalk.cyan(req.method)} ${req.path} ${inspect(req.body)}`);
      // log(`${method} ${path} (${inspect(filter)}, ${inspect(update)})`);
    }
  );

  // model.pre('replaceOne', (filter: FilterQuery<TSchema>, document: TSchema, options: ReplaceOneOptions) => {
  //   log(`db.${collectionName}.replaceOne(${inspect(filter)}, ${inspect(document)}, ${inspect(options)})`);
  // });
  // model.pre('insertMany', (docs: TSchema[]) => {
  //   log(`db.${collectionName}.insertMany(${inspect(docs)})`);
  // });
  // model.pre('updateOne', (filter: FilterQuery<TSchema>, update: UpdateQuery<TSchema> | TSchema) => {
  //   log(`db.${collectionName}.updateOne(${inspect(filter)}, ${inspect(update)})`);
  // });
  // model.pre(
  //   'findOneAndUpdate',
  //   (filter: FilterQuery<TSchema>, update: UpdateQuery<TSchema> | TSchema, options: FindOneOptions, opMap: Map) => {
  //     log(`db.${collectionName}.findOneAndUpdate(${inspect(filter)}, ${inspect(update)}, ${inspect(options)})`);
  //   }
  // );
  // model.pre('findOne', (query: FilterQuery<TSchema>, options: FindOneOptions, opMap: Map) => {
  //   log(`db.${collectionName}.findOne(${inspect(query)}, ${inspect(options)})`);
  // });
  // model.pre('findMany', (query: FilterQuery<TSchema>, options: FindOneOptions) => {
  //   log(`db.${collectionName}.find(${inspect(query)}, ${inspect(options)})`);
  // });
  // model.pre(
  //   'deleteOne',
  //   (filter: FilterQuery<TSchema>, options: CommonOptions & {bypassDocumentValidation?: boolean}, opMap: Map) => {
  //     log(`db.${collectionName}.deleteOne(${inspect(filter)}, ${inspect(options)})`);
  //   }
  // );
  // model.pre('deleteMany', (filter: FilterQuery<TSchema>, options: CommonOptions) => {
  //   log(`db.${collectionName}.deleteMany(${inspect(filter)}, ${inspect(options)})`);
  // });

  // ms-perf
  /*
  const timeSymbol = Symbol('time');
  model.pre('findOne', (query: FilterQuery<TSchema>, options: FindOneOptions, opMap: Map) => {
    opMap.set(timeSymbol, Date.now());
  });
  model.post('findOne', (doc: T, query: FilterQuery<TSchema>, options: FindOneOptions, opMap: Map) => {
    const elapsed = Date.now() - opMap.get(timeSymbol);
    log(`${inspect(doc)} returned in ${inspect(elapsed)}ms`);
  });
  */

  // ns-perf
  // const NS_PER_SEC = 1e9;
  // const hrtimeSymbol = Symbol('hrtime');
  // model.pre('findOne', (query: FilterQuery<TSchema>, options: FindOneOptions, opMap: Map) => {
  //   opMap.set(hrtimeSymbol, process.hrtime());
  // });
  // model.post('findOne', (doc: T, query: FilterQuery<TSchema>, options: FindOneOptions, opMap: Map) => {
  //   const diff = process.hrtime(opMap.get(hrtimeSymbol));
  //   const elapsed = (diff[0] * NS_PER_SEC + diff[1]) / 1e6;
  //   log(`${inspect(doc)} returned in ${inspect(elapsed.toPrecision(3) * 1)}ms`);
  // });
}