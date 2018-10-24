import shortid from 'shortid';

export default function shortIdPlugin(model, {idKey = '_sid'} = {}) {
  model.addSchemaProperties({
    [idKey]: {bsonType: 'string', minLength: 7, maxLength: 14}
  });
  model.pre('insert', (insert: T) => {
    insert[idKey] = shortid.generate();
  });
}
