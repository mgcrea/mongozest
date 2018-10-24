import {ObjectId} from 'mongodb';

type StringOrObjectId = string | ObjectId;

export default function findByIdPlugin(model: Model) {
  model.addStatics({
    findById: async (id: StringOrObjectId, options?: FindOneOptions) => {
      return model.findOne({_id: new ObjectId(id)}, options);
    }
  });
}
