import createMongo, {JsonSchema, jsonSchemaPlugin, Model} from '@mongozest/core';
import {getDbName} from 'root/test/utils';
import {schemaIndexesPlugin} from 'src/schemaIndexesPlugin';

const DB_NAME = getDbName(__filename);

const mongo = createMongo();

type Test = {
  username?: string;
  phoneNumber?: string;
  email?: string;
};
class TestModel extends Model<Test> {
  static schema: JsonSchema<Test> = {
    username: {bsonType: 'string', index: {unique: true}},
    phoneNumber: {bsonType: 'string', index: {unique: false, name: undefined}},
    email: {bsonType: 'string', index: {unique: false, name: 'email'}}
  };
  static plugins = [jsonSchemaPlugin, schemaIndexesPlugin];
}
let testModel: TestModel;

beforeAll(async () => {
  const db = await mongo.connect(DB_NAME);
  await db.dropDatabase();
  it('should properly loadModel', async () => {
    testModel = await mongo.loadModel(TestModel);
    expect(TestModel instanceof Model).toBeTruthy();
  });
});

afterAll(async () => {
  await mongo.disconnect();
});

describe('schemaIndexesPlugin', () => {
  let testModel: Model;
  it('should properly loadModel and create indexes', async () => {
    const indexes = await testModel.collection.indexes();
    expect(indexes).toMatchSnapshot();
  });
});
