import createMongo, {Model, collectionDefaultsPlugin} from './../../../src';
import {getDbName} from './../../utils';

const DB_NAME = getDbName(__filename);

const mongo = createMongo();

class Test extends Model {
  static schema = {
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
  let TestModel: Model;
  it('should properly loadModel ans insert defaults', async () => {
    TestModel = await mongo.loadModel(Test);
    expect(TestModel instanceof Model).toBeTruthy();
    const docs = await TestModel.find({});
    expect(docs).toMatchObject(Test.defaults);
  });
});
