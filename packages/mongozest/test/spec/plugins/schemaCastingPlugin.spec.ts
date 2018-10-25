import createMongo, {Model, jsonSchemaPlugin, schemaCastingPlugin} from './../../../src';
import {basename} from 'path';
import {kebabCase} from 'lodash';
import {Long, ObjectId} from 'mongodb';

const DB_NAME = getDbName(__filename);

const mongo = createMongo();

class Test extends Model {
  static schema = {
    name: {bsonType: 'string'},
    objectIdValue: {bsonType: 'objectId'},
    intValue: {bsonType: 'int'},
    longValue: {bsonType: 'long'},
    decimalValue: {bsonType: 'decimal'},
    nestedObject: {bsonType: 'object', properties: {latitude: 'decimal', longitude: 'decimal'}},
    dateValue: {bsonType: 'date'}
  };
  static plugins = [jsonSchemaPlugin, schemaCastingPlugin];
}

beforeAll(async () => {
  const db = await mongo.connect(DB_NAME);
  await db.dropDatabase();
});

afterAll(async () => {
  await mongo.disconnect();
});

describe('schemaCastingPlugin', () => {
  let TestModel: Model;
  it('should properly loadModel', async () => {
    TestModel = await mongo.loadModel(Test);
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
  // it('should properly add `createdAt` and `updatedAt` on insertOne', async () => {
  //   const {ops, insertedId} = await TestModel.insertOne({
  //     name: 'insertOne',
  //     user: '5bcbc487e244fe1b0b4a1eb5',
  //     wei: Long.MAX_VALUE.toNumber(),
  //     location: {latitude: 48.8588377, longitude: 2.2770212},
  //     createdAt: 0
  //   });
  //   // Check op result
  //   const insertedDoc = ops[0];
  //   d({insertedDoc});
  //   expect(ObjectId.isValid(insertedDoc.user)).toBeTruthy();
  //   expect(insertedDoc.wei.toNumber()).toEqual(Long.MAX_VALUE.toNumber());
  //   // // Check findOne result
  //   // const foundDoc = await TestModel.findOne({_id: insertedId});
  //   // expect(foundDoc.createdAt instanceof Date).toBeTruthy();
  //   // expect(foundDoc.updatedAt instanceof Date).toBeTruthy();
  //   // expect(foundDoc.updatedAt).toEqual(foundDoc.createdAt);
  // });
});
