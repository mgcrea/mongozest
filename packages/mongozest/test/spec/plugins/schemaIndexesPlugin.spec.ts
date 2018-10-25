import createMongo, {Model, jsonSchemaPlugin, schemaIndexesPlugin} from './../../../src';

const DB_NAME = getDbName(__filename);

const mongo = createMongo();

class Test extends Model {
  static schema = {
    username: {bsonType: 'string', index: {unique: true}},
    phoneNumber: {bsonType: 'string', index: {unique: false, name: undefined}},
    email: {bsonType: 'string', index: {unique: false, name: 'email'}}
  };
  static plugins = [jsonSchemaPlugin, schemaIndexesPlugin];
}

beforeAll(async () => {
  const db = await mongo.connect(DB_NAME);
  await db.dropDatabase();
});

afterAll(async () => {
  await mongo.disconnect();
});

describe('schemaIndexesPlugin', () => {
  let testModel: Model;
  it('should properly loadModel', async () => {
    testModel = await mongo.loadModel(Test);
    expect(testModel instanceof Model).toBeTruthy();
    const indexes = await testModel.collection.indexes();
    expect(indexes).toMatchSnapshot();
  });
});
