import createMongo, {Schema, Model} from '@mongozest/core';
import {getDbName} from 'root/test/utils';
import {collectionDefaultsPlugin} from 'src/collectionDefaultsPlugin';

const DB_NAME = getDbName(__filename);

const mongo = createMongo();

type Test = {
  name: string;
};

class TestModel extends Model<Test> {
  static schema: Schema<Test> = {
    name: {bsonType: 'string', required: true}
  };
  static defaults = [{name: 'workers'}, {name: 'clients'}, {name: 'admins'}];
  static plugins = [collectionDefaultsPlugin];
}

beforeAll(async () => {
  const db = await mongo.connect(DB_NAME);
  await db.dropDatabase();
});

afterAll(async () => {
  await mongo.disconnect();
});

describe('jsonSchemaPlugin', () => {
  let testModel: Model<Test>;
  it('should properly loadModel ans insert defaults', async () => {
    testModel = await mongo.loadModel(TestModel);
    expect(testModel instanceof Model).toBeTruthy();
    const docs = await testModel.find({});
    expect(docs).toMatchObject(TestModel.defaults);
  });
});
