import {FilterQuery, UpdateQuery} from 'mongodb';
import {Model} from '@mongozest/core';

export interface LastModifiedPluginProps {
  updatedAt: Date;
  createdAt: Date;
}

// export interface LastModifiedPluginOptions {}

export default function lastModifiedPlugin<TSchema extends LastModifiedPluginProps>(
  model: Model<TSchema>
  // _options: LastModifiedPluginOptions
) {
  model.addSchemaProperties({
    updatedAt: {bsonType: 'date'},
    createdAt: {bsonType: 'date'}
  });
  model.pre('insert', (insert: TSchema) => {
    const currentDate = new Date();
    insert.createdAt = currentDate;
    insert.updatedAt = currentDate;
  });
  model.pre('update', (filter: FilterQuery<TSchema>, update: UpdateQuery<TSchema>) => {
    const currentDate = new Date();
    if (update.$set) {
      update.$set.updatedAt = currentDate;
    } else {
      update.$set = {updatedAt: currentDate};
    }
  });
}
