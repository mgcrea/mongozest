export default function lastModifiedPlugin(model, options) {
  model.addSchemaProperties({
    updatedAt: {bsonType: 'date'},
    createdAt: {bsonType: 'date'}
  });
  model.pre('insert', (insert: T) => {
    const currentDate = new Date();
    insert.createdAt = currentDate;
    insert.updatedAt = currentDate;
  });
  model.pre('update', (filter: FilterQuery<TSchema>, update: UpdateQuery<TSchema> | TSchema) => {
    const currentDate = new Date();
    if (update.$set) {
      update.$set.updatedAt = currentDate;
    } else {
      update.$set = {updatedAt: currentDate};
    }
  });
}
