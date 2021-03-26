import createMongo, { Schema, Model } from '@mongozest/core';
import { getDbName } from 'root/test/utils';
import { lastModifiedPlugin, LastModifiedPluginSchema } from '@mongozest/plugins';

const DB_NAME = getDbName(__filename);

const mongo = createMongo();

type Test = LastModifiedPluginSchema & {
  name: string;
};

class TestModel extends Model<Test> {
  static schema: Schema<Test> = {
    name: { bsonType: 'string', required: true },
  };
  static plugins = [lastModifiedPlugin];
}

beforeAll(async () => {
  const db = await mongo.connect(DB_NAME);
  await db.dropDatabase();
});

afterAll(async () => {
  await mongo.disconnect();
});

describe('lastModifiedPlugin', () => {
  let testModel: Model<Test>;
  it('should properly loadModel', async () => {
    testModel = await mongo.loadModel(TestModel);
    expect(testModel instanceof Model).toBeTruthy();
  });
  it('should properly add `createdAt` and `updatedAt` on insertOne', async () => {
    const { ops, insertedId } = await testModel.insertOne({ name: 'insertOne' });
    // Check op result
    const insertedDoc = ops[0];
    expect(Object.keys(insertedDoc)).toMatchObject(['name', 'createdAt', 'updatedAt', '_id']);
    expect(insertedDoc.createdAt instanceof Date).toBeTruthy();
    expect(insertedDoc.updatedAt instanceof Date).toBeTruthy();
    expect(insertedDoc.updatedAt).toEqual(insertedDoc.createdAt);
    // Check findOne result
    const foundDoc = (await testModel.findOne({ _id: insertedId })) as Test;
    expect(foundDoc.createdAt instanceof Date).toBeTruthy();
    expect(foundDoc.updatedAt instanceof Date).toBeTruthy();
    expect(foundDoc.updatedAt).toEqual(foundDoc.createdAt);
  });
  it('should properly update `updatedAt` on updateOne', async () => {
    const { insertedId } = await testModel.insertOne({ name: 'insertOne' });
    const { result } = await testModel.updateOne({ _id: insertedId }, { $set: { name: 'updateOne' } });
    expect(result).toMatchObject({ n: 1, nModified: 1, ok: 1 });
    const foundDoc = (await testModel.findOne({ _id: insertedId })) as Test;
    expect(foundDoc.createdAt instanceof Date).toBeTruthy();
    expect(foundDoc.updatedAt instanceof Date).toBeTruthy();
    expect(foundDoc.updatedAt! > foundDoc.createdAt!).toBeTruthy();
  });
});
