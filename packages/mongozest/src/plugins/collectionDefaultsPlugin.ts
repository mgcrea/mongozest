// @types
import {Model} from '..';

export default function collectionDefaultsPlugin(model: Model, {maxTimeMS = 5000} = {}) {
  model.post('initialize', async () => {
    const {defaults} = model.constructor;
    // Only if the collection is empty!
    if (defaults && defaults.length) {
      const count = await model.collection.estimatedDocumentCount({maxTimeMS});
      if (!count) {
        await model.insertMany(defaults);
      }
    }
  });
}
