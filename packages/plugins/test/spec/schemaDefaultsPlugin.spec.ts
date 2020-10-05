import createMongo, {jsonSchemaPlugin, Model, Schema} from '@mongozest/core';
import {schemaCastingPlugin, schemaDefaultsPlugin} from '@mongozest/plugins';
import {Decimal128 as Decimal} from 'mongodb';
import {getDbName} from 'root/test/utils';

const DB_NAME = getDbName(__filename);

const mongo = createMongo();

beforeAll(async () => {
  const db = await mongo.connect(DB_NAME);
  await db.dropDatabase();
});

afterAll(async () => {
  await mongo.disconnect();
});

describe('schemaDefaultsPlugin', () => {
  describe('schema with basic properties', () => {
    type Test = {
      name?: string;
      stringValue?: string;
      dateValue?: Date;
      boolValue?: boolean;
      refValue?: string;
    };
    class TestModelOne extends Model<Test> {
      static schema: Schema<Test> = {
        name: {bsonType: 'string'},
        stringValue: {bsonType: 'string', default: 'bar'},
        dateValue: {bsonType: 'date', default: (Date.now as unknown) as () => Date}, // @NOTE schemaCasting
        boolValue: {bsonType: 'bool', default: false},
        refValue: {bsonType: 'string', default: '${name}bar'}
      };
      static plugins = [jsonSchemaPlugin, schemaDefaultsPlugin, schemaCastingPlugin];
    }
    let testModel: TestModelOne;

    it('should properly loadModel', async () => {
      testModel = await mongo.loadModel(TestModelOne);
      expect(testModel instanceof Model).toBeTruthy();
    });
    describe('should properly handle a schema prop default', () => {
      it('from a `string`', async () => {
        const {ops, insertedId} = await testModel.insertOne({
          name: 'foo'
        });
        // Check op result
        const insertedDoc = ops[0];
        expect(insertedDoc.stringValue).toEqual('bar');
        expect(insertedDoc.dateValue instanceof Date).toBeTruthy();
        expect(insertedDoc.dateValue!.getTime() > 0).toBeTruthy();
        expect(insertedDoc.boolValue).toEqual(false);
        expect(insertedDoc.refValue).toEqual('foobar');
        // Check findOne result
        const foundDoc = await testModel.findOne({_id: insertedId});
        expect(foundDoc?.stringValue).toEqual('bar');
        expect(foundDoc?.dateValue instanceof Date).toBeTruthy();
        expect(foundDoc!.dateValue!.getTime() > 0).toBeTruthy();
        expect(foundDoc?.boolValue).toEqual(false);
        expect(foundDoc?.refValue).toEqual('foobar');
      });
    });
  });
  describe('schema with nestedObject properties', () => {
    type Test = {
      name?: string;
      nestedObject?: {latitude?: Decimal; longitude?: Decimal};
    };
    class TestModelTwo extends Model<Test> {
      static schema: Schema<Test> = {
        name: {bsonType: 'string'},
        nestedObject: {
          bsonType: 'object',
          properties: {latitude: {bsonType: 'decimal'}, longitude: {bsonType: 'decimal'}},
          default: {latitude: Decimal.fromString('0'), longitude: Decimal.fromString('0')}
        }
      };
      static plugins = [jsonSchemaPlugin, schemaDefaultsPlugin];
    }
    let testModel: TestModelTwo;

    it('should properly loadModel', async () => {
      testModel = await mongo.loadModel(TestModelTwo);
      expect(testModel instanceof Model).toBeTruthy();
    });
    describe('should properly handle a schema prop default', () => {
      it('from a `string`', async () => {
        const {ops, insertedId} = await testModel.insertOne({
          name: 'foo'
        });
        // Check op result
        const insertedDoc = ops[0];
        expect(insertedDoc.nestedObject).toEqual({
          latitude: Decimal.fromString('0'),
          longitude: Decimal.fromString('0')
        });
        // Check findOne result
        const foundDoc = await testModel.findOne({_id: insertedId});
        expect(foundDoc?.nestedObject).toEqual({latitude: Decimal.fromString('0'), longitude: Decimal.fromString('0')});
      });
    });
  });
  describe('schema with nestedArray properties', () => {
    type Test = {
      name?: string;
      nestedArray?: {title?: string; createdAt?: Date}[];
    };
    class TestModelThree extends Model<Test> {
      static schema: Schema<Test> = {
        name: {bsonType: 'string'},
        nestedArray: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            properties: {title: {bsonType: 'string'}, createdAt: {bsonType: 'date', default: Date.now}}
          }
        }
      };
      static plugins = [jsonSchemaPlugin, schemaDefaultsPlugin, schemaCastingPlugin];
    }
    let testModel: TestModelThree;

    it('should properly loadModel', async () => {
      testModel = await mongo.loadModel(TestModelThree);
      expect(testModel instanceof Model).toBeTruthy();
    });
    describe('should properly handle a schema prop default', () => {
      it('from a `string`', async () => {
        const {ops, insertedId} = await testModel.insertOne({
          name: 'foo',
          nestedArray: [{title: 'bar'}]
        });
        // Check op result
        const insertedDoc = ops[0];
        expect(Object.keys(insertedDoc?.nestedArray![0])).toEqual(['title', 'createdAt']);
        expect(insertedDoc?.nestedArray![0].createdAt instanceof Date).toBeTruthy();
        // Check findOne result
        const foundDoc = await testModel.findOne({_id: insertedId});
        expect(foundDoc?.nestedArray![0].createdAt instanceof Date).toBeTruthy();
      });
    });
  });
});
