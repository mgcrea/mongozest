import createMongo, { Schema, jsonSchemaPlugin, Model } from '@mongozest/core';
import { getDbName } from 'root/test/utils';
import { schemaIndexesPlugin } from '@mongozest/plugins';

const DB_NAME = getDbName(__filename);

const mongo = createMongo();

type Test = {
  username?: string;
  phoneNumber?: string;
  email?: string;
};
class TestModel extends Model<Test> {
  static schema: Schema<Test> = {
    username: { bsonType: 'string', index: { unique: true } },
    phoneNumber: { bsonType: 'string', index: { unique: false, name: undefined } },
    email: { bsonType: 'string', index: { unique: false, name: 'email' } },
  };
  static plugins = [jsonSchemaPlugin, schemaIndexesPlugin];
}
let testModel: TestModel;

beforeAll(async () => {
  const db = await mongo.connect(DB_NAME);
  await db.dropDatabase();
  testModel = await mongo.loadModel(TestModel);
  expect(testModel instanceof Model).toBeTruthy();
});

afterAll(async () => {
  await mongo.disconnect();
});

describe('schemaIndexesPlugin', () => {
  it('should properly loadModel and create indexes', async () => {
    const indexes = await testModel.collection.indexes();
    expect(indexes).toMatchSnapshot();
  });
});
