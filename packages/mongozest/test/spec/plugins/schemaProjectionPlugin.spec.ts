import createMongo, {Model, jsonSchemaPlugin, schemaProjectionPlugin} from './../../../src';
import {Decimal128 as Decimal} from 'mongodb';
import {basename} from 'path';
import {kebabCase} from 'lodash';

const DB_NAME = getDbName(__filename);

const mongo = createMongo();

class Test extends Model {
  static schema = {
    username: {bsonType: 'string'},
    password: {bsonType: 'string', select: false}
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

describe.only('schemaProjectionPlugin', () => {
  let TestModel: Model;
  it('should properly loadModel', async () => {
    TestModel = await mongo.loadModel(Test);
    expect(TestModel instanceof Model).toBeTruthy();
  });
  describe('should properly adapt projection on findOne', () => {
    it('from a `string`', async () => {
      const {ops, insertedId} = await TestModel.insertOne({
        username: 'foo',
        password: 'bar'
      });
      // Check findOne result
      const foundDoc = await TestModel.findOne({_id: insertedId});
      expect(foundDoc.username).toEqual('foo');
      expect(typeof foundDoc.password).toEqual('undefined');
    });
  });
  describe('should properly adapt projection on find', () => {
    it('from a `string`', async () => {
      const {ops, insertedId} = await TestModel.insertOne({
        username: 'foo',
        password: 'bar'
      });
      // Check findOne result
      const foundDoc = await TestModel.find({});
      expect(foundDoc[0].username).toEqual('foo');
      expect(typeof foundDoc[0].password).toEqual('undefined');
    });
  });
});
