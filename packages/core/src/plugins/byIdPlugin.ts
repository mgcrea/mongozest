import {
  CommonOptions,
  DeleteWriteOpResultObject,
  FilterQuery,
  FindOneOptions,
  ObjectId,
  ReplaceOneOptions,
  UpdateQuery,
  UpdateWriteOpResult
} from 'mongodb';
import {Model} from '../model';
import {DefaultSchema} from '../schema';

type StringOrObjectId = string | ObjectId;

export const byIdPlugin = <TSchema extends DefaultSchema = DefaultSchema>(model: Model<TSchema>): void => {
  model.addStatics({
    findById: async <T = TSchema>(
      id: StringOrObjectId,
      options?: FindOneOptions<T extends TSchema ? TSchema : T>
    ): Promise<T | null> => {
      return model.findOne<T>({_id: new ObjectId(id)} as FilterQuery<TSchema>, options);
    },
    updateById: async (
      id: StringOrObjectId,
      update: UpdateQuery<TSchema>,
      options: ReplaceOneOptions
    ): Promise<UpdateWriteOpResult> => {
      return model.updateOne({_id: new ObjectId(id)} as FilterQuery<TSchema>, update, options);
    },
    deleteById: async (
      id: StringOrObjectId,
      options: CommonOptions & {bypassDocumentValidation?: boolean} = {}
    ): Promise<DeleteWriteOpResultObject> => {
      return model.deleteOne({_id: new ObjectId(id)} as FilterQuery<TSchema>, options);
    }
  });
};
