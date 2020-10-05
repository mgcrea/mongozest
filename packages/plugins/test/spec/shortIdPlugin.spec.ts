import createMongo, {Model, Schema} from '@mongozest/core';
import {getDbName} from 'root/test/utils';
import {shortIdPlugin, ShortIdPluginSchema} from '@mongozest/plugins';

const DB_NAME = getDbName(__filename);

const mongo = createMongo();

type Test = ShortIdPluginSchema & {
  name: string;
};

class TestModel extends Model<Test> {
  static schema: Schema<Test> = {
    name: {bsonType: 'string', required: true}
  };
  static plugins = [shortIdPlugin];
}

beforeAll(async () => {
  const db = await mongo.connect(DB_NAME);
  await db.dropDatabase();
});

afterAll(async () => {
  await mongo.disconnect();
});

describe('shortIdPlugin', () => {
  let testModel: TestModel;
  it('should properly loadModel', async () => {
    testModel = await mongo.loadModel(TestModel);
    expect(testModel instanceof Model).toBeTruthy();
  });
  it('should properly add `_sid` on insertOne', async () => {
    const {ops, insertedId} = await testModel.insertOne({name: 'insertOne'});
    // Check op result
    const insertedDoc = ops[0];
    expect(Object.keys(insertedDoc)).toMatchObject(['_sid', 'name', '_id']);
    expect(typeof insertedDoc?._sid).toEqual('string');
    expect(insertedDoc!._sid!.length > 0).toBeTruthy();
    // Check findOne result
    const foundDoc = await testModel.findOne({_id: insertedId});
    expect(typeof foundDoc?._sid).toEqual('string');
    expect(foundDoc!._sid!.length > 0).toBeTruthy();
  });
});
