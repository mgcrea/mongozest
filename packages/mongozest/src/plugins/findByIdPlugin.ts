import {ObjectId} from 'mongodb';
// @types
import {Model} from '..';
import {FindOneOptions} from 'mongodb';

type StringOrObjectId = string | ObjectId;

export default function findByIdPlugin(model: Model) {
  model.addStatics({
    findById: async (id: StringOrObjectId, options?: FindOneOptions): Promise<TSchema | null> => {
      return model.findOne({_id: new ObjectId(id)}, options);
    }
  });
}
