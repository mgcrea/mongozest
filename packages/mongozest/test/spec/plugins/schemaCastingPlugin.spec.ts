import createMongo, {Model, jsonSchemaPlugin, schemaCastingPlugin} from './../../../src';
import {getDbName} from './../../utils';
import {Long, Decimal128, ObjectId} from 'mongodb';

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
        objectIdValue: {bsonType: 'objectId'},
        intValue: {bsonType: 'int'},
        longValue: {bsonType: 'long'},
        decimalValue: {bsonType: 'decimal'},
        dateValue: {bsonType: 'date'}
      };
      static plugins = [jsonSchemaPlugin, schemaCastingPlugin];
    }
    let TestModel: Model;
    it('should properly loadModel', async () => {
      TestModel = await mongo.loadModel(Test1);
      expect(TestModel instanceof Model).toBeTruthy();
    });
    describe('should properly cast an `objectId` bsonType', () => {
      it('from a `string`', async () => {
        const {ops, insertedId} = await TestModel.insertOne({
          objectIdValue: '5bcdc07ffd331bc20d10f2d7'
        });
        // Check op result
        const insertedDoc = ops[0];
        expect(ObjectId.isValid(insertedDoc.objectIdValue)).toBeTruthy();
        expect(insertedDoc.objectIdValue.toString()).toEqual('5bcdc07ffd331bc20d10f2d7');
        // Check findOne result
        const foundDoc = await TestModel.findOne({_id: insertedId});
        expect(ObjectId.isValid(foundDoc.objectIdValue)).toBeTruthy();
        expect(foundDoc.objectIdValue.toString()).toEqual('5bcdc07ffd331bc20d10f2d7');
      });
    });
    describe('should properly cast an `int` bsonType', () => {
      it('from a `string`', async () => {
        const {ops, insertedId} = await TestModel.insertOne({intValue: '3.2'});
        // Check op result
        const insertedDoc = ops[0];
        expect(insertedDoc.intValue.valueOf()).toEqual(3);
        // Check findOne result
        const foundDoc = await TestModel.findOne({_id: insertedId});
        expect(foundDoc.intValue).toEqual(3);
      });
      it('from a `float`', async () => {
        const {ops, insertedId} = await TestModel.insertOne({intValue: 3.2});
        // Check op result
        const insertedDoc = ops[0];
        expect(insertedDoc.intValue.valueOf()).toEqual(3);
        // Check findOne result
        const foundDoc = await TestModel.findOne({_id: insertedId});
        expect(foundDoc.intValue).toEqual(3);
      });
      it('from a `number`', async () => {
        const {ops, insertedId} = await TestModel.insertOne({intValue: Number.MIN_VALUE});
        // Check op result
        const insertedDoc = ops[0];
        expect(insertedDoc.intValue.valueOf()).toEqual(0);
        // Check findOne result
        const foundDoc = await TestModel.findOne({_id: insertedId});
        expect(foundDoc.intValue).toEqual(0);
      });
      it('from `Infinity`', async () => {
        const {ops, insertedId} = await TestModel.insertOne({intValue: Infinity});
        // Check op result
        const insertedDoc = ops[0];
        expect(insertedDoc.intValue.valueOf()).toEqual(9007199254740991);
        // Check findOne result
        const foundDoc = await TestModel.findOne({_id: insertedId});
        expect(foundDoc.intValue).toEqual(-1); // @FIXME mongodb NodeJS bug?
      });
    });
    describe('should properly cast a `decimal` bsonType', () => {
      it('from a `string`', async () => {
        const {ops, insertedId} = await TestModel.insertOne({decimalValue: '3.2'});
        // Check op result
        const insertedDoc = ops[0];
        expect(insertedDoc.decimalValue instanceof Decimal128).toBeTruthy();
        expect(insertedDoc.decimalValue.toString()).toEqual('3.2');
        // Check findOne result
        const foundDoc = await TestModel.findOne({_id: insertedId});
        expect(foundDoc.decimalValue instanceof Decimal128).toBeTruthy();
        expect(foundDoc.decimalValue.toString()).toEqual('3.2');
      });
      it('from a `float`', async () => {
        const {ops, insertedId} = await TestModel.insertOne({decimalValue: 3.2});
        // Check op result
        const insertedDoc = ops[0];
        expect(insertedDoc.decimalValue instanceof Decimal128).toBeTruthy();
        expect(insertedDoc.decimalValue.toString()).toEqual('3.2');
        // Check findOne result
        const foundDoc = await TestModel.findOne({_id: insertedId});
        expect(foundDoc.decimalValue instanceof Decimal128).toBeTruthy();
        expect(foundDoc.decimalValue.toString()).toEqual('3.2');
      });
      // it('from a `number`', async () => {
      //   const {ops, insertedId} = await TestModel.insertOne({decimalValue: Number.MIN_VALUE});
      //   // Check op result
      //   const insertedDoc = ops[0];
      //   expect(insertedDoc.decimalValue.valueOf()).toEqual(0);
      //   // Check findOne result
      //   const foundDoc = await TestModel.findOne({_id: insertedId});
      //   expect(foundDoc.decimalValue).toEqual(0);
      // });
      // it('from `Infinity`', async () => {
      //   const {ops, insertedId} = await TestModel.insertOne({decimalValue: Infinity});
      //   // Check op result
      //   const insertedDoc = ops[0];
      //   expect(insertedDoc.decimalValue.valueOf()).toEqual(9007199254740991);
      //   // Check findOne result
      //   const foundDoc = await TestModel.findOne({_id: insertedId});
      //   expect(foundDoc.decimalValue).toEqual(-1); // @FIXME mongodb NodeJS bug?
      // });
    });
  });
  describe('schema with nestedObject properties', () => {
    class Test2 extends Model {
      static schema = {
        nestedObject: {
          bsonType: 'object',
          properties: {latitude: {bsonType: 'decimal'}, longitude: {bsonType: 'decimal'}}
        }
      };
      static plugins = [jsonSchemaPlugin, schemaCastingPlugin];
    }
    let TestModel: Model;
    it('should properly loadModel', async () => {
      TestModel = await mongo.loadModel(Test2);
      expect(TestModel instanceof Model).toBeTruthy();
    });
    it('should properly cast a nestedObject property', async () => {
      const {ops, insertedId} = await TestModel.insertOne({nestedObject: {latitude: '43.21', longitude: 45.67}});
      // Check op result
      const insertedDoc = ops[0];
      expect(insertedDoc.nestedObject.latitude instanceof Decimal128).toBeTruthy();
      expect(insertedDoc.nestedObject.longitude instanceof Decimal128).toBeTruthy();
      // Check findOne result
      const foundDoc = await TestModel.findOne({_id: insertedId});
      expect(foundDoc.nestedObject.latitude instanceof Decimal128).toBeTruthy();
      expect(foundDoc.nestedObject.longitude instanceof Decimal128).toBeTruthy();
    });
  });
  describe('schema with nestedArray properties', () => {
    class Test3 extends Model {
      static schema = {
        nestedArray: {bsonType: 'array', items: {bsonType: 'date'}},
        nestedArrayBis: {
          bsonType: 'array',
          minItems: 2,
          maxItems: 2,
          items: [
            {bsonType: 'decimal', minimum: -180, maximum: 180}, // longitude
            {bsonType: 'decimal', minimum: -90, maximum: 90} // latitude
          ]
        },
        nestedArrayDeep: {
          bsonType: 'array',
          items: {bsonType: 'object', properties: {dates: {bsonType: 'array', items: {bsonType: 'date'}}}}
        }
      };
      static plugins = [jsonSchemaPlugin, schemaCastingPlugin];
    }
    let TestModel: Model;
    it('should properly loadModel', async () => {
      TestModel = await mongo.loadModel(Test3);
      expect(TestModel instanceof Model).toBeTruthy();
    });
    it('should properly cast a nestedArray property', async () => {
      const date = new Date(Date.UTC(2000, 0, 1));
      const {ops, insertedId} = await TestModel.insertOne({nestedArray: [date.toISOString()]});
      // Check op result
      const insertedDoc = ops[0];
      expect(insertedDoc.nestedArray[0] instanceof Date).toBeTruthy();
      expect(insertedDoc.nestedArray[0] instanceof Date).toBeTruthy();
      // Check findOne result
      const foundDoc = await TestModel.findOne({_id: insertedId});
      expect(foundDoc.nestedArray[0] instanceof Date).toBeTruthy();
      expect(foundDoc.nestedArray[0] instanceof Date).toBeTruthy();
    });
    it('should properly cast a nestedArrayBis property', async () => {
      const date = new Date(Date.UTC(2000, 0, 1));
      const {ops, insertedId} = await TestModel.insertOne({nestedArrayBis: [1.743815, 47.364408]});
      // Check op result
      const insertedDoc = ops[0];
      expect(insertedDoc.nestedArrayBis[0] instanceof Decimal128).toBeTruthy();
      expect(insertedDoc.nestedArrayBis[1] instanceof Decimal128).toBeTruthy();
      // Check findOne result
      const foundDoc = await TestModel.findOne({_id: insertedId});
      expect(foundDoc.nestedArrayBis[0] instanceof Decimal128).toBeTruthy();
      expect(foundDoc.nestedArrayBis[1] instanceof Decimal128).toBeTruthy();
    });
    it('should properly cast a nestedArrayDeep property', async () => {
      const date = new Date(Date.UTC(2000, 0, 1));
      const {ops, insertedId} = await TestModel.insertOne({nestedArrayDeep: [{dates: [date.toISOString()]}]});
      // Check op result
      const insertedDoc = ops[0];
      expect(insertedDoc.nestedArrayDeep[0].dates[0] instanceof Date).toBeTruthy();
      expect(insertedDoc.nestedArrayDeep[0].dates[0] instanceof Date).toBeTruthy();
      // Check findOne result
      const foundDoc = await TestModel.findOne({_id: insertedId});
      expect(foundDoc.nestedArrayDeep[0].dates[0] instanceof Date).toBeTruthy();
      expect(foundDoc.nestedArrayDeep[0].dates[0] instanceof Date).toBeTruthy();
    });
  });
});
