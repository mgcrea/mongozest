import {FilterQuery, UpdateQuery} from 'mongodb';
import {Model} from '..';

export interface lastModifiedPluginProps {
  updatedAt: Date;
  createdAt: Date;
}

export interface lastModifiedPluginOptions {}

export default function lastModifiedPlugin<TSchema extends lastModifiedPluginProps>(
  model: Model<TSchema>,
  _options: lastModifiedPluginOptions
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
