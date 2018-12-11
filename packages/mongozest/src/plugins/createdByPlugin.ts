export default function createdByPlugin(model, {bsonType = 'objectId', ref = 'User'} = {}) {
  model.addSchemaProperties({
    createdBy: {bsonType, ref},
    updatedBy: {bsonType, ref}
  });
}
