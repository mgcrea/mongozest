import {DefaultSchema, Model, WriteableUpdateQuery} from '@mongozest/core';
import {memoize} from 'lodash';
import {FilterQuery, FindOneOptions, ReplaceOneOptions, UpdateWriteOpResult} from 'mongodb';
import shortid from 'shortid';

export type ShortId = string;

export type ShortIdPluginSchema = {
  _sid?: ShortId;
};

export type ShortIdPluginOptions = {
  sidKey?: ShortId;
  insertKeyOnTop?: boolean;
};

export const shortIdPlugin = <TSchema extends DefaultSchema & ShortIdPluginSchema>(
  model: Model<TSchema>,
  {sidKey = '_sid', insertKeyOnTop = true}: ShortIdPluginOptions = {}
): void => {
  model.addSchemaProperties({
    [sidKey]: {bsonType: 'string', minLength: 7, maxLength: 14, index: {unique: true}}
  });
  model.addStatics({
    findBySid: async <T = TSchema>(
      sid: ShortId,
      options?: FindOneOptions<T extends TSchema ? TSchema : T>
    ): Promise<T | null> => {
      return model.findOne<T>({[sidKey as '_sid']: sid} as FilterQuery<TSchema>, options);
    },
    updateBySid: async (
      sid: ShortId,
      update: WriteableUpdateQuery<TSchema>,
      options: ReplaceOneOptions = {}
    ): Promise<UpdateWriteOpResult> => {
      return model.updateOne({[sidKey as '_sid']: sid} as FilterQuery<TSchema>, update, options);
    },
    lazyIdFromSid: memoize(async (sid: ShortId) => {
      const doc = await model.findOne({[sidKey as '_sid']: sid} as FilterQuery<TSchema>, {projection: {_id: 1}});
      return doc ? doc._id : null;
    })
  });

  // Setup the generated key asap in the pipeline (eg. before defaults!)
  model.pre('insert', (_operation, document) => {
    document[sidKey as '_sid'] = shortid.generate();
  });
  // Complex logic as we want the _sid to end up on top
  if (insertKeyOnTop) {
    model.pre('insertOne', (operation, document, _options) => {
      if (document) {
        operation.set('document', {[sidKey]: undefined, ...document});
      }
    });
    model.pre('insertMany', (operation, documents) => {
      if (documents && Array.isArray(documents)) {
        operation.set(
          'documents',
          documents.map((document) => ({[sidKey]: undefined, ...document}))
        );
      }
    });
    model.pre('replaceOne', (operation, _filter, document) => {
      if (document) {
        operation.set('document', {[sidKey]: undefined, ...document});
      }
    });
    // model.pre('replaceMany', (documents: TSchema[], _options: CollectionInsertManyOptions, operation) => {
    //   if (documents) {
    //     operation.set(
    //       'documents',
    //       documents.map((document) => (document ? {[sidKey]: undefined, ...document} : document))
    //     );
    //   }
    // });
  }
};

// declare module '@mongozest/core' {
//   interface DefaultSchema {
//     _sid?: string;
//   }
// }
