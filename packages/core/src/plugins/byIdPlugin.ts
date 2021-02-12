import {
  CommonOptions,
  DeleteWriteOpResultObject,
  FilterQuery,
  FindOneOptions,
  ObjectId,
  ReplaceOneOptions,
  UpdateWriteOpResult,
} from 'mongodb';
import type { Model } from '../model';
import type { AnySchema, DefaultSchema, WriteableUpdateQuery } from '../typings';

export const byIdPlugin = <TSchema extends DefaultSchema = DefaultSchema>(model: Model<TSchema>): void => {
  model.addStatics({
    findById: async <T = TSchema>(
      id: ObjectId | string,
      options?: FindOneOptions<T extends TSchema ? TSchema : T>
    ): Promise<T | null> => {
      return model.findOne<T>({ _id: new ObjectId(id) } as FilterQuery<TSchema>, options);
    },
    updateById: async (
      id: ObjectId | string,
      update: WriteableUpdateQuery<TSchema>,
      options: ReplaceOneOptions
    ): Promise<UpdateWriteOpResult> => {
      return model.updateOne({ _id: new ObjectId(id) } as FilterQuery<TSchema>, update, options);
    },
    deleteById: async (
      id: ObjectId | string,
      options: CommonOptions & { bypassDocumentValidation?: boolean } = {}
    ): Promise<DeleteWriteOpResultObject> => {
      return model.deleteOne({ _id: new ObjectId(id) } as FilterQuery<TSchema>, options);
    },
  });
};

declare module '../model' {
  interface Model<TSchema extends AnySchema = DefaultSchema> {
    findById: <T = TSchema>(
      id: ObjectId | string,
      options?: FindOneOptions<T extends TSchema ? TSchema : T>
    ) => Promise<T | null>;
    updateById: (
      id: ObjectId | string,
      update: WriteableUpdateQuery<TSchema>,
      options?: ReplaceOneOptions
    ) => Promise<UpdateWriteOpResult>;
    deleteById: (
      id: ObjectId | string,
      options?: CommonOptions & { bypassDocumentValidation?: boolean }
    ) => Promise<DeleteWriteOpResultObject>;
  }
}
