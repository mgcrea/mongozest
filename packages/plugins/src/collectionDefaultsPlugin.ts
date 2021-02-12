import { AnySchema, DefaultSchema, Model, ModelConstructor } from '@mongozest/core';
import { MongoCountPreferences, OptionalId } from 'mongodb';

export const collectionDefaultsPlugin = <TSchema extends AnySchema = DefaultSchema>(
  model: Model<TSchema>,
  { maxTimeMS = 5000 }: MongoCountPreferences = {}
): void => {
  // model.addStatics({defaults: []});?
  model.post('initialize', async () => {
    const { defaults } = model.constructor as ModelConstructor<TSchema>;
    // Only if the collection is empty!
    if (defaults && defaults.length) {
      const count = await model.collection.estimatedDocumentCount({}, { maxTimeMS });
      if (!count) {
        // @ts-expect-error typing mismatch
        await model.insertMany(defaults);
      }
    }
  });
};

declare module '@mongozest/core' {
  interface ModelConstructor<TSchema extends AnySchema = DefaultSchema> {
    defaults?: OptionalId<TSchema>[];
  }
}
