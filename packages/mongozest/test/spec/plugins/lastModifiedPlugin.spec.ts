import createMongo, {Model, lastModifiedPlugin} from './../../../src';
import {basename} from 'path';
import {kebabCase} from 'lodash';

const DB_NAME = getDbName(__filename);

const mongo = createMongo();

class Test extends Model {
  static schema = {
    name: {bsonType: 'string', required: true}
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
  let TestModel: Model;
  it('should properly loadModel', async () => {
    TestModel = await mongo.loadModel(Test);
    expect(TestModel instanceof Model).toBeTruthy();
  });
  it('should properly add `createdAt` and `updatedAt` on insertOne', async () => {
    const {ops, insertedId} = await TestModel.insertOne({name: 'insertOne'});
    // Check op result
    const insertedDoc = ops[0];
    expect(Object.keys(insertedDoc)).toMatchObject(['name', 'createdAt', 'updatedAt', '_id']);
    expect(insertedDoc.createdAt instanceof Date).toBeTruthy();
    expect(insertedDoc.updatedAt instanceof Date).toBeTruthy();
    expect(insertedDoc.updatedAt).toEqual(insertedDoc.createdAt);
    // Check findOne result
    const foundDoc = await TestModel.findOne({_id: insertedId});
    expect(foundDoc.createdAt instanceof Date).toBeTruthy();
    expect(foundDoc.updatedAt instanceof Date).toBeTruthy();
    expect(foundDoc.updatedAt).toEqual(foundDoc.createdAt);
  });
  it('should properly update `updatedAt` on updateOne', async () => {
    const {insertedId} = await TestModel.insertOne({name: 'insertOne'});
    const {result} = await TestModel.updateOne({_id: insertedId}, {$set: {name: 'updateOne'}});
    expect(result).toMatchObject({n: 1, nModified: 1, ok: 1});
    const foundDoc = await TestModel.findOne({_id: insertedId});
    expect(foundDoc.createdAt instanceof Date).toBeTruthy();
    expect(foundDoc.updatedAt instanceof Date).toBeTruthy();
    expect(foundDoc.updatedAt > foundDoc.createdAt).toBeTruthy();
  });
});
