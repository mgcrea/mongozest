import createMongo, {Model, jsonSchemaPlugin} from './../../../src';
import {basename} from 'path';
import {kebabCase} from 'lodash';
import {Db} from 'mongodb';

const DB_NAME = getDbName(__filename);

const mongo = createMongo();

class Test extends Model {
  static schema = {
    name: {bsonType: 'string', required: true, someInvalidProp: true},
    avatar: {bsonType: 'object', properties: {fileName: 'string', size: 'long'}},
    list: {
      bsonType: 'array',
      items: {
        oneOf: [{bsonType: 'string'}, {bsonType: 'int'}]
      }
    },
    nestedObject: {
      bsonType: 'object',
      properties: {latitude: 'decimal', longitude: 'decimal'},
      someInvalidProp: {latitude: 0, longitude: 0}
    }
  };
  static plugins = [jsonSchemaPlugin];
}

beforeAll(async () => {
  const db = await mongo.connect(DB_NAME);
  await db.dropDatabase();
});

afterAll(async () => {
  await mongo.disconnect();
});

describe('jsonSchemaPlugin', () => {
  let TestModel: Model;
  it('should properly loadModel', async () => {
    TestModel = await mongo.loadModel(Test);
    expect(TestModel instanceof Model).toBeTruthy();
  });
  it('should properly add `validator.$jsonSchema` to both schema and collection', async () => {
    const {ops, insertedId} = await TestModel.insertOne({name: 'insertOne', list: [1, '2']});
    const {options} = await TestModel.getCollectionInfo();
    expect(options.validator).toHaveProperty('$jsonSchema');
    expect(options.validator.$jsonSchema).toMatchSnapshot();
  });
});
