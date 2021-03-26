import createMongo, { jsonSchemaPlugin, Model, Schema } from '@mongozest/core';
import { getDbName } from 'root/test/utils';
import { schemaProjectionPlugin } from '@mongozest/plugins';

const DB_NAME = getDbName(__filename);

const mongo = createMongo();

type Test = {
  username: string;
  password: string;
  code: string;
  email: string;
};

class TestModel extends Model<Test> {
  static schema: Schema<Test> = {
    username: { bsonType: 'string' },
    password: { bsonType: 'string', select: false },
    code: { bsonType: 'string', select: false },
    email: { bsonType: 'string' },
  };
  static plugins = [jsonSchemaPlugin, schemaProjectionPlugin];
}

beforeAll(async () => {
  const db = await mongo.connect(DB_NAME);
  await db.dropDatabase();
});

afterAll(async () => {
  await mongo.disconnect();
});

describe('schemaProjectionPlugin', () => {
  let testModel: TestModel;
  it('should properly loadModel', async () => {
    testModel = await mongo.loadModel(TestModel);
    expect(testModel instanceof Model).toBeTruthy();
  });
  describe('should properly adapt projection on findOne', () => {
    it('without initial projection', async () => {
      const { insertedId } = await testModel.insertOne({
        username: 'foo',
        password: 'bar',
        code: 'baz',
        email: 'qux',
      });
      // Check findOne result
      const foundDoc = await testModel.findOne({ _id: insertedId });
      expect(foundDoc?.username).toEqual('foo');
      expect(typeof foundDoc?.password).toEqual('undefined');
      expect(typeof foundDoc?.code).toEqual('undefined');
    });
    it('with initial inclusive projection', async () => {
      const { insertedId } = await testModel.insertOne({
        username: 'foo',
        password: 'bar',
        code: 'baz',
        email: 'qux',
      });
      // Check findOne result
      const foundDoc = await testModel.findOne({ _id: insertedId }, { projection: { username: 1 } });
      expect(foundDoc?.username).toEqual('foo');
      expect(typeof foundDoc?.password).toEqual('undefined');
      expect(typeof foundDoc?.code).toEqual('undefined');
    });
    it('with initial exclusive projection', async () => {
      const { insertedId } = await testModel.insertOne({
        username: 'foo',
        password: 'bar',
        code: 'baz',
        email: 'qux',
      });
      // Check findOne result
      const foundDoc = await testModel.findOne({ _id: insertedId }, { projection: { email: 0 } });
      expect(foundDoc?.username).toEqual('foo');
      expect(typeof foundDoc?.password).toEqual('undefined');
      expect(typeof foundDoc?.code).toEqual('undefined');
    });
  });
  describe('should properly adapt projection on find', () => {
    it('without initial projection', async () => {
      const { insertedId } = await testModel.insertOne({
        username: 'foo',
        password: 'bar',
        code: 'baz',
        email: 'qux',
      });
      // Check findOne result
      const foundDocs = await testModel.find({});
      foundDocs.forEach((foundDoc) => {
        expect(foundDoc?.username).toEqual('foo');
        expect(typeof foundDoc?.password).toEqual('undefined');
        expect(typeof foundDoc?.code).toEqual('undefined');
      });
    });
    it('with initial inclusive projection', async () => {
      const { insertedId } = await testModel.insertOne({
        username: 'foo',
        password: 'bar',
        code: 'baz',
        email: 'qux',
      });
      // Check findOne result
      const foundDocs = await testModel.find({}, { projection: { username: 1 } });
      foundDocs.forEach((foundDoc) => {
        expect(foundDoc?.username).toEqual('foo');
        expect(typeof foundDoc?.password).toEqual('undefined');
        expect(typeof foundDoc?.code).toEqual('undefined');
      });
    });
    it('with initial exclusive projection', async () => {
      const { insertedId } = await testModel.insertOne({
        username: 'foo',
        password: 'bar',
        code: 'baz',
        email: 'qux',
      });
      // Check findOne result
      const foundDocs = await testModel.find({}, { projection: { email: 0 } });
      foundDocs.forEach((foundDoc) => {
        expect(foundDoc?.username).toEqual('foo');
        expect(typeof foundDoc?.password).toEqual('undefined');
        expect(typeof foundDoc?.code).toEqual('undefined');
      });
    });
  });
});
