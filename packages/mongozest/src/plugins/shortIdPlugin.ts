import shortid from 'shortid';
// @types
import {Model} from '..';
import {FindOneOptions, UpdateQuery, UpdateWriteOpResult, ReplaceOneOptions} from 'mongodb';

export default function shortIdPlugin(model: Model, {idKey = '_sid'} = {}) {
  model.addSchemaProperties({
    [idKey]: {bsonType: 'string', minLength: 7, maxLength: 14, index: {unique: true}}
  });
  model.addStatics({
    findBySid: async (sid: string, options?: FindOneOptions): Promise<TSchema | null> => {
      return model.findOne({_sid: sid}, options);
    },
    updateBySid: async (
      sid: string,
      update: UpdateQuery<TSchema> | TSchema,
      options: ReplaceOneOptions = {}
    ): Promise<UpdateWriteOpResult> => {
      return model.updateOne({_sid: sid}, update, options);
    }
  });
  model.pre('insert', (insert: T) => {
    insert[idKey] = shortid.generate();
  });
}
