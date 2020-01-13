import createMongo, {Model} from '@mongozest/core';
import shortIdPlugin from 'src/shortIdPlugin';
import {getDbName} from 'root/test/utils';

const DB_NAME = getDbName(__filename);

const mongo = createMongo();

class Test extends Model {
  static schema = {
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
  let TestModel: Model;
  it('should properly loadModel', async () => {
    TestModel = await mongo.loadModel(Test);
    expect(TestModel instanceof Model).toBeTruthy();
  });
  it('should properly add `_sid` on insertOne', async () => {
    const {ops, insertedId} = await TestModel.insertOne({name: 'insertOne'});
    // Check op result
    const insertedDoc = ops[0];
    expect(Object.keys(insertedDoc)).toMatchObject(['_sid', 'name', '_id']);
    expect(typeof insertedDoc._sid).toEqual('string');
    expect(insertedDoc._sid.length > 0).toBeTruthy();
    // Check findOne result
    const foundDoc = await TestModel.findOne({_id: insertedId});
    expect(typeof foundDoc._sid).toEqual('string');
    expect(foundDoc._sid.length > 0).toBeTruthy();
  });
});
