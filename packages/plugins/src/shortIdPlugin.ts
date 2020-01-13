import shortid from 'shortid';
import {memoize, isEmpty} from 'lodash';
// @types
import {Model, OperationMap} from '..';
import {
  FindOneOptions,
  UpdateQuery,
  UpdateWriteOpResult,
  ReplaceOneOptions,
  ObjectId,
  CollectionInsertManyOptions,
  CollectionInsertOneOptions
} from 'mongodb';

interface DocumentSchema {
  _id?: ObjectId;
}

export interface ShortIdPluginProps {
  _sid: string;
}

const isInclusiveProjection = (projection: {[s: string]: any}) =>
  Object.keys(projection).some(key => projection[key] === 1);

interface DocumentWithPluginProps extends DocumentSchema, ShortIdPluginProps {}

export interface ShortIdPluginOptions {
  sidKey?: string;
  insertKeyOnTop?: boolean;
}

export default function shortIdPlugin<TSchema extends DocumentWithPluginProps>(
  model: Model<TSchema>,
  {sidKey = '_sid', insertKeyOnTop = true}: ShortIdPluginOptions = {}
) {
  model.addSchemaProperties({
    [sidKey]: {bsonType: 'string', minLength: 7, maxLength: 14, index: {unique: true}}
  });
  model.addStatics({
    findBySid: async (sid: string, options?: FindOneOptions): Promise<TSchema | null> => {
      return model.findOne({[sidKey]: sid}, options);
    },
    updateBySid: async (
      sid: string,
      update: UpdateQuery<TSchema> | TSchema,
      options: ReplaceOneOptions = {}
    ): Promise<UpdateWriteOpResult> => {
      return model.updateOne({[sidKey]: sid}, update, options);
    },
    lazyIdFromSid: memoize(async (sid: string) => {
      const doc = await model.findOne({[sidKey]: sid}, {projection: {_id: 1}});
      return doc ? doc._id : null;
    })
  });

  // Setup the generated key asap in the pipeline (eg. before defaults!)
  model.pre('insert', (insert: TSchema) => {
    insert[sidKey] = shortid.generate();
  });
  // Complex logic as we want the _sid to end up on top
  if (insertKeyOnTop) {
    model.pre('insertOne', (document: TSchema, _options: CollectionInsertOneOptions, operation: OperationMap) => {
      if (document) {
        operation.set('document', {[sidKey]: undefined, ...document});
      }
    });
    model.pre(
      'insertMany',
      (documents: TSchema[], _options: CollectionInsertManyOptions = {}, operation: OperationMap) => {
        if (documents && Array.isArray(documents)) {
          operation.set(
            'documents',
            documents.map((document: TSchema) => ({[sidKey]: undefined, ...document}))
          );
        }
      }
    );
    model.pre('replaceOne', (document: TSchema, _options: ReplaceOneOptions, operation: OperationMap) => {
      if (document) {
        operation.set('document', {[sidKey]: undefined, ...document});
      }
    });
    model.pre('replaceMany', (documents: TSchema[], _options: CollectionInsertManyOptions, operation: OperationMap) => {
      if (documents) {
        operation.set(
          'documents',
          documents.map(document => (document ? {[sidKey]: undefined, ...document} : document))
        );
      }
    });
  }

  // Support {_id: 0} to clear existing _id from projections
  // model.pre('find', (query: FilterQuery<TSchema>, options: FindOneOptions, operation: OperationMap) => {
  //   // Nothing to do if we don't have a projection
  //   if (!options.projection) {
  //     return;
  //   }
  //   // Check that we have both {_id: 0} and an inclusive projection
  //   if (options.projection._id !== 0 || !isInclusiveProjection(options.projection)) {
  //     return;
  //   }
  //   // Drop invalid projection
  //   d('in!!');
  //   delete options.projection._id;
  //   operation.set('shortIdPlugin.clearId', true);
  // });
  // model.post('find', (filter: FilterQuery<TSchema>, options: FindOneOptions, operation: OperationMap) => {
  //   const clearId = operation.get('shortIdPlugin.clearId');
  //   if (clearId) {
  //     const result = operation.get('result');
  //     delete result._id;
  //   }
  // });
}
