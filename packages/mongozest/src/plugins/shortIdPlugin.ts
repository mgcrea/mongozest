import shortid from 'shortid';
import {memoize, isEmpty} from 'lodash';
// @types
import {Model} from '..';
import {FindOneOptions, UpdateQuery, UpdateWriteOpResult, ReplaceOneOptions, ObjectId} from 'mongodb';

interface DocumentSchema {
  _id?: ObjectId;
}

export interface ShortIdPluginProps {
  _sid: string;
}

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

  // Easy case
  if (!insertKeyOnTop) {
    model.pre('insert', (insert: TSchema) => {
      insert[sidKey] = shortid.generate();
    });
  } else {
    // Complex logic as we want the _sid to end up on top
    model.pre('insertOne', (document: TSchema, _options: CollectionInsertOneOptions, operation: OperationMap) => {
      if (document) {
        operation.set('document', {[sidKey]: shortid.generate(), ...document});
      }
    });
    model.pre('replaceOne', (document: TSchema, _options: ReplaceOneOptions, operation: OperationMap) => {
      if (document) {
        operation.set('document', {[sidKey]: shortid.generate(), ...document});
      }
    });
    model.pre('replaceMany', (documents: TSchema[], _options: CollectionInsertManyOptions, operation: OperationMap) => {
      if (documents) {
        operation.set(
          'documents',
          documents.map(document => (document ? {[sidKey]: shortid.generate(), ...document} : document))
        );
      }
    });
  }
}
