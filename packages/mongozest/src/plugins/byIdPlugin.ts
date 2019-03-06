import {ObjectId} from 'mongodb';
// @types
import {Model} from '..';
import {
  FindOneOptions,
  UpdateQuery,
  ReplaceOneOptions,
  CommonOptions,
  DeleteWriteOpResultObject,
  UpdateWriteOpResult
} from 'mongodb';

type StringOrObjectId = string | ObjectId;

export default function byIdPlugin<TSchema>(model: Model<TSchema>) {
  model.addStatics({
    findById: async (id: StringOrObjectId, options?: FindOneOptions): Promise<TSchema | null> => {
      return model.findOne({_id: new ObjectId(id)}, options);
    },
    updateById: async (
      id: StringOrObjectId,
      update: UpdateQuery<TSchema> | TSchema,
      options: ReplaceOneOptions
    ): Promise<UpdateWriteOpResult> => {
      return model.updateOne({_id: new ObjectId(id)}, update, options);
    },
    deleteById: async (
      id: StringOrObjectId,
      options: CommonOptions & {bypassDocumentValidation?: boolean} = {}
    ): Promise<DeleteWriteOpResultObject> => {
      return model.deleteOne({_id: new ObjectId(id)}, options);
    }
  });
}