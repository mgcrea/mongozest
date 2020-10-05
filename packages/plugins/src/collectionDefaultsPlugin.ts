import {Model, ModelConstructor, UnknownSchema} from '@mongozest/core';
import {MongoCountPreferences, OptionalId} from 'mongodb';

declare module '@mongozest/core' {
  interface ModelConstructor<TSchema extends OptionalId<UnknownSchema> = UnknownSchema> {
    defaults?: OptionalId<TSchema>[];
  }
}

export const collectionDefaultsPlugin = <TSchema extends UnknownSchema>(
  model: Model<TSchema>,
  {maxTimeMS = 5000}: MongoCountPreferences = {}
): void => {
  // model.addStatics({defaults: []});?
  model.post('initialize', async () => {
    const {defaults} = model.constructor as ModelConstructor<TSchema>;
    // Only if the collection is empty!
    if (defaults && defaults.length) {
      const count = await model.collection.estimatedDocumentCount({}, {maxTimeMS});
      if (!count) {
        await model.insertMany(defaults as OptionalId<TSchema>[]); // @NOTE ts bug?
      }
    }
  });
};
