import createMongo, {Model, jsonSchemaPlugin} from '@mongozest/core';
import schemaProjectionPlugin from 'src/schemaProjectionPlugin';
import {getDbName} from 'root/test/utils';

const DB_NAME = getDbName(__filename);

const mongo = createMongo();

class Test extends Model {
  static schema = {
    username: {bsonType: 'string'},
    password: {bsonType: 'string', select: false},
    code: {bsonType: 'string', select: false},
    email: {bsonType: 'string'}
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
  let TestModel: Model;
  it('should properly loadModel', async () => {
    TestModel = await mongo.loadModel(Test);
    expect(TestModel instanceof Model).toBeTruthy();
  });
  describe('should properly adapt projection on findOne', () => {
    it('without initial projection', async () => {
      const {insertedId} = await TestModel.insertOne({
        username: 'foo',
        password: 'bar',
        code: 'baz',
        email: 'qux'
      });
      // Check findOne result
      const foundDoc = await TestModel.findOne({_id: insertedId});
      expect(foundDoc.username).toEqual('foo');
      expect(typeof foundDoc.password).toEqual('undefined');
      expect(typeof foundDoc.code).toEqual('undefined');
    });
    it('with initial inclusive projection', async () => {
      const {insertedId} = await TestModel.insertOne({
        username: 'foo',
        password: 'bar',
        code: 'baz',
        email: 'qux'
      });
      // Check findOne result
      const foundDoc = await TestModel.findOne({_id: insertedId}, {projection: {username: 1}});
      expect(foundDoc.username).toEqual('foo');
      expect(typeof foundDoc.password).toEqual('undefined');
      expect(typeof foundDoc.code).toEqual('undefined');
    });
    it('with initial exclusive projection', async () => {
      const {insertedId} = await TestModel.insertOne({
        username: 'foo',
        password: 'bar',
        code: 'baz',
        email: 'qux'
      });
      // Check findOne result
      const foundDoc = await TestModel.findOne({_id: insertedId}, {projection: {email: 0}});
      expect(foundDoc.username).toEqual('foo');
      expect(typeof foundDoc.password).toEqual('undefined');
      expect(typeof foundDoc.code).toEqual('undefined');
    });
  });
  describe('should properly adapt projection on find', () => {
    it('without initial projection', async () => {
      const {insertedId} = await TestModel.insertOne({
        username: 'foo',
        password: 'bar',
        code: 'baz',
        email: 'qux'
      });
      // Check findOne result
      const foundDocs = await TestModel.find({});
      foundDocs.forEach(foundDoc => {
        expect(foundDoc.username).toEqual('foo');
        expect(typeof foundDoc.password).toEqual('undefined');
        expect(typeof foundDoc.code).toEqual('undefined');
      });
    });
    it('with initial inclusive projection', async () => {
      const {insertedId} = await TestModel.insertOne({
        username: 'foo',
        password: 'bar',
        code: 'baz',
        email: 'qux'
      });
      // Check findOne result
      const foundDocs = await TestModel.find({}, {projection: {username: 1}});
      foundDocs.forEach(foundDoc => {
        expect(foundDoc.username).toEqual('foo');
        expect(typeof foundDoc.password).toEqual('undefined');
        expect(typeof foundDoc.code).toEqual('undefined');
      });
    });
    it('with initial exclusive projection', async () => {
      const {insertedId} = await TestModel.insertOne({
        username: 'foo',
        password: 'bar',
        code: 'baz',
        email: 'qux'
      });
      // Check findOne result
      const foundDocs = await TestModel.find({}, {projection: {email: 0}});
      foundDocs.forEach(foundDoc => {
        expect(foundDoc.username).toEqual('foo');
        expect(typeof foundDoc.password).toEqual('undefined');
        expect(typeof foundDoc.code).toEqual('undefined');
      });
    });
  });
});
