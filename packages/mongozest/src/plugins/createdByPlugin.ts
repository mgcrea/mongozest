export default function createdByPlugin(model, {bsonType = 'objectId', ref = 'User'} = {}) {
  model.addSchemaProperties({
    ownedBy: {bsonType, ref},
    createdBy: {bsonType, ref},
    updatedBy: {bsonType, ref}
  });
}
