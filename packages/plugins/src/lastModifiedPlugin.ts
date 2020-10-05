import {DefaultSchema, Model} from '@mongozest/core';

export type LastModifiedPluginSchema = {
  updatedAt?: Date;
  createdAt?: Date;
};

export const lastModifiedPlugin = <TSchema extends DefaultSchema & LastModifiedPluginSchema>(
  model: Model<TSchema>
): void => {
  model.addSchemaProperties({
    updatedAt: {bsonType: 'date'},
    createdAt: {bsonType: 'date'}
  });
  model.pre('insert', (_operation, insert) => {
    const currentDate = new Date();
    insert.createdAt = currentDate;
    insert.updatedAt = currentDate;
  });
  model.pre('update', (_operation, _filter, update) => {
    const currentDate = new Date();
    if (update.$set) {
      Object.assign(update.$set, {updatedAt: currentDate});
    } else {
      update.$set = {updatedAt: currentDate} as typeof update.$set;
    }
  });
};

// declare module '@mongozest/core' {
//   interface DefaultSchema {
//     updatedAt: Date;
//     createdAt: Date;
//   }
// }
