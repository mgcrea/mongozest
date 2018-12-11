import createMongo, {Model, jsonSchemaPlugin, schemaCastingPlugin, schemaDefaultsPlugin} from './../../../src';
import {Decimal128 as Decimal} from 'mongodb';
import {getDbName} from './../../utils';

const DB_NAME = getDbName(__filename);

const mongo = createMongo();

beforeAll(async () => {
  const db = await mongo.connect(DB_NAME);
  await db.dropDatabase();
});

afterAll(async () => {
  await mongo.disconnect();
});

describe('schemaCastingPlugin', () => {
  describe('schema with basic properties', () => {
    class Test1 extends Model {
      static schema = {
        name: {bsonType: 'string'},
        stringValue: {bsonType: 'string', default: 'bar'},
        dateValue: {bsonType: 'date', default: Date.now},
        boolValue: {bsonType: 'bool', default: false}
      };
      static plugins = [jsonSchemaPlugin, schemaDefaultsPlugin, schemaCastingPlugin];
    }
    let TestModel: Model;
    it('should properly loadModel', async () => {
      TestModel = await mongo.loadModel(Test1);
      expect(TestModel instanceof Model).toBeTruthy();
    });
    describe('should properly handle a schema prop default', () => {
      it('from a `string`', async () => {
        const {ops, insertedId} = await TestModel.insertOne({
          name: 'foo'
        });
        // Check op result
        const insertedDoc = ops[0];
        expect(insertedDoc.stringValue).toEqual('bar');
        expect(insertedDoc.dateValue instanceof Date).toBeTruthy();
        expect(insertedDoc.dateValue.getTime() > 0).toBeTruthy();
        expect(insertedDoc.boolValue).toEqual(false);
        // Check findOne result
        const foundDoc = await TestModel.findOne({_id: insertedId});
        expect(foundDoc.stringValue).toEqual('bar');
        expect(foundDoc.dateValue instanceof Date).toBeTruthy();
        expect(foundDoc.dateValue.getTime() > 0).toBeTruthy();
        expect(foundDoc.boolValue).toEqual(false);
      });
    });
  });
  describe('schema with nestedObject properties', () => {
    class Test2 extends Model {
      static schema = {
        name: {bsonType: 'string'},
        nestedObject: {
          bsonType: 'object',
          properties: {latitude: 'decimal', longitude: 'decimal'},
          default: {latitude: Decimal.fromString('0'), longitude: Decimal.fromString('0')}
        }
      };
      static plugins = [jsonSchemaPlugin, schemaDefaultsPlugin];
    }
    let TestModel: Model;
    it('should properly loadModel', async () => {
      TestModel = await mongo.loadModel(Test2);
      expect(TestModel instanceof Model).toBeTruthy();
    });
    describe('should properly handle a schema prop default', () => {
      it('from a `string`', async () => {
        const {ops, insertedId} = await TestModel.insertOne({
          name: 'foo'
        });
        // Check op result
        const insertedDoc = ops[0];
        expect(insertedDoc.nestedObject).toEqual({
          latitude: Decimal.fromString('0'),
          longitude: Decimal.fromString('0')
        });
        // Check findOne result
        const foundDoc = await TestModel.findOne({_id: insertedId});
        expect(foundDoc.nestedObject).toEqual({latitude: Decimal.fromString('0'), longitude: Decimal.fromString('0')});
      });
    });
  });
  describe('schema with nestedArray properties', () => {
    class Test3 extends Model {
      static schema = {
        name: {bsonType: 'string'},
        nestedArray: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            properties: {title: 'string', createdAt: {bsonType: 'date', default: Date.now}}
          }
        }
      };
      static plugins = [jsonSchemaPlugin, schemaDefaultsPlugin, schemaCastingPlugin];
    }
    let TestModel: Model;
    it('should properly loadModel', async () => {
      TestModel = await mongo.loadModel(Test3);
      expect(TestModel instanceof Model).toBeTruthy();
    });
    describe('should properly handle a schema prop default', () => {
      it('from a `string`', async () => {
        const {ops, insertedId} = await TestModel.insertOne({
          name: 'foo',
          nestedArray: [{title: 'bar'}]
        });
        // Check op result
        const insertedDoc = ops[0];
        expect(Object.keys(insertedDoc.nestedArray[0])).toEqual(['title', 'createdAt']);
        expect(insertedDoc.nestedArray[0].createdAt instanceof Date).toBeTruthy();
        // Check findOne result
        const foundDoc = await TestModel.findOne({_id: insertedId});
        expect(foundDoc.nestedArray[0].createdAt instanceof Date).toBeTruthy();
      });
    });
  });
});
