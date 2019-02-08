import shortid from 'shortid';
import {memoize} from 'lodash';
// @types
import {Model} from '..';
import {FindOneOptions, UpdateQuery, UpdateWriteOpResult, ReplaceOneOptions} from 'mongodb';

export default function shortIdPlugin(model: Model, {sidKey = '_sid'} = {}) {
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
  model.pre('insert', (insert: T) => {
    insert[sidKey] = shortid.generate();
  });
}
