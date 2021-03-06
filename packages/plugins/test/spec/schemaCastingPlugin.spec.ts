import createMongo, { Schema, jsonSchemaPlugin, Model } from '@mongozest/core';
import { Decimal128, Long, ObjectId } from 'mongodb';
import { getDbName } from 'root/test/utils';
import { schemaCastingPlugin } from '@mongozest/plugins';

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
    type Test = {
      _id: ObjectId;
      name?: string;
      objectIdValue?: ObjectId;
      intValue?: number;
      longValue?: number;
      decimalValue?: number;
      dateValue?: Date;
    };
    class TestModelOne extends Model<Test> {
      static schema: Schema<Test> = {
        name: { bsonType: 'string' },
        objectIdValue: { bsonType: 'objectId' },
        intValue: { bsonType: 'int' },
        longValue: { bsonType: 'long' },
        decimalValue: { bsonType: 'decimal' },
        dateValue: { bsonType: 'date' },
      };
      static plugins = [jsonSchemaPlugin, schemaCastingPlugin];
    }
    let testModel: TestModelOne;
    beforeAll(async () => {
      testModel = await mongo.loadModel(TestModelOne);
      expect(testModel instanceof Model).toBeTruthy();
    });
    describe('should properly cast an `objectId` bsonType', () => {
      it('from a `string`', async () => {
        const { ops, insertedId } = await testModel.insertOne({
          objectIdValue: ('5bcdc07ffd331bc20d10f2d7' as unknown) as ObjectId,
        });
        // Check op result
        const insertedDoc = ops[0];
        expect(ObjectId.isValid(insertedDoc.objectIdValue!)).toBeTruthy();
        expect(insertedDoc.objectIdValue?.toString()).toEqual('5bcdc07ffd331bc20d10f2d7');
        // Check findOne result
        const foundDoc = await testModel.findOne({ _id: insertedId });
        expect(ObjectId.isValid(foundDoc!.objectIdValue!)).toBeTruthy();
        expect(foundDoc?.objectIdValue?.toString()).toEqual('5bcdc07ffd331bc20d10f2d7');
      });
      // it('from a nullable value', async () => {
      //   const {ops, insertedId} = await TestModel.insertOne({
      //     objectIdValue: null
      //   });
      //   // Check op result
      //   const insertedDoc = ops[0];
      //   expect(ObjectId.isValid(insertedDoc.objectIdValue)).toBeTruthy();
      //   // Check findOne result
      //   const foundDoc = await TestModel.findOne({_id: insertedId});
      //   expect(ObjectId.isValid(foundDoc.objectIdValue)).toBeTruthy();
      // });
    });
    describe('should properly cast an `int` bsonType', () => {
      it('from a `string`', async () => {
        const { ops, insertedId } = await testModel.insertOne({ intValue: ('3.2' as unknown) as number });
        // Check op result
        const insertedDoc = ops[0];
        expect(insertedDoc.intValue?.valueOf()).toEqual(3);
        // Check findOne result
        const foundDoc = await testModel.findOne({ _id: insertedId });
        expect(foundDoc?.intValue).toEqual(3);
      });
      it('from a `float`', async () => {
        const { ops, insertedId } = await testModel.insertOne({ intValue: 3.2 });
        // Check op result
        const insertedDoc = ops[0];
        expect(insertedDoc.intValue?.valueOf()).toEqual(3);
        // Check findOne result
        const foundDoc = await testModel.findOne({ _id: insertedId });
        expect(foundDoc?.intValue).toEqual(3);
      });
      it('from a `number`', async () => {
        const { ops, insertedId } = await testModel.insertOne({ intValue: Number.MIN_VALUE });
        // Check op result
        const insertedDoc = ops[0];
        expect(insertedDoc.intValue?.valueOf()).toEqual(0);
        // Check findOne result
        const foundDoc = await testModel.findOne({ _id: insertedId });
        expect(foundDoc?.intValue).toEqual(0);
      });
      it('from `Infinity`', async () => {
        const { ops, insertedId } = await testModel.insertOne({ intValue: Infinity });
        // Check op result
        const insertedDoc = ops[0];
        expect(insertedDoc.intValue?.valueOf()).toEqual(9007199254740991);
        // Check findOne result
        const foundDoc = await testModel.findOne({ _id: insertedId });
        expect(foundDoc?.intValue).toEqual(-1); // @FIXME mongodb NodeJS bug?
      });
    });
    describe('should properly cast a `decimal` bsonType', () => {
      it('from a `string`', async () => {
        const { ops, insertedId } = await testModel.insertOne({ decimalValue: ('3.2' as unknown) as number });
        // Check op result
        const insertedDoc = ops[0];
        expect((insertedDoc.decimalValue as any) instanceof Decimal128).toBeTruthy();
        expect(insertedDoc.decimalValue?.toString()).toEqual('3.2');
        // Check findOne result
        const foundDoc = await testModel.findOne({ _id: insertedId });
        expect(typeof foundDoc?.decimalValue === 'number').toBeTruthy();
        expect(foundDoc?.decimalValue?.toString()).toEqual('3.2');
      });
      it('from a `float`', async () => {
        const { ops, insertedId } = await testModel.insertOne({ decimalValue: 3.2 });
        // Check op result
        const insertedDoc = ops[0];
        expect((insertedDoc.decimalValue as any) instanceof Decimal128).toBeTruthy();
        expect(insertedDoc.decimalValue?.toString()).toEqual('3.2');
        // Check findOne result
        const foundDoc = await testModel.findOne({ _id: insertedId });
        expect(typeof foundDoc?.decimalValue === 'number').toBeTruthy();
        expect(foundDoc?.decimalValue?.toString()).toEqual('3.2');
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
    type Test = {
      nestedObject?: {
        decimal?: number;
        long?: number;
        date?: Date;
      };
      deepNestedObject?: {
        nestedObject?: {
          decimal?: number;
          long?: number;
          date?: Date;
        };
      };
    };
    class TestModelTwo extends Model<Test> {
      static schema: Schema<Test> = {
        nestedObject: {
          bsonType: 'object',
          properties: { decimal: { bsonType: 'decimal' }, long: { bsonType: 'long' }, date: { bsonType: 'date' } },
        },
        deepNestedObject: {
          bsonType: 'object',
          properties: {
            nestedObject: {
              bsonType: 'object',
              properties: { decimal: { bsonType: 'decimal' }, long: { bsonType: 'long' }, date: { bsonType: 'date' } },
            },
          },
        },
      };
      static plugins = [jsonSchemaPlugin, schemaCastingPlugin];
    }
    let testModel: TestModelTwo;

    beforeAll(async () => {
      testModel = await mongo.loadModel(TestModelTwo);
      expect(testModel instanceof Model).toBeTruthy();
    });
    it('should properly cast a nestedObject property', async () => {
      const { ops, insertedId } = await testModel.insertOne({
        nestedObject: {
          decimal: ('43.21' as unknown) as number,
          long: ('123456' as unknown) as number,
          date: (new Date().toISOString() as unknown) as Date,
        },
      });
      // Check op result
      const insertedDoc = ops[0];
      expect((insertedDoc.nestedObject?.decimal as any) instanceof Decimal128).toBeTruthy();
      expect((insertedDoc.nestedObject?.long as any) instanceof Long).toBeTruthy();
      expect(insertedDoc.nestedObject?.date instanceof Date).toBeTruthy();
      // Check findOne result
      const foundDoc = await testModel.findOne({ _id: insertedId });
      expect(typeof foundDoc?.nestedObject?.decimal === 'number').toBeTruthy();
      expect(typeof foundDoc?.nestedObject?.long === 'number').toBeTruthy();
      expect(foundDoc?.nestedObject?.date instanceof Date).toBeTruthy();
      // Check deepNested update
      const { value: updatedDoc } = await testModel.findOneAndUpdate(
        { _id: insertedId },
        {
          $set: {
            'deepNestedObject.nestedObject': { decimal: '43.21', long: '123456', date: new Date().toISOString() },
          },
        },
        { returnOriginal: false }
      );
      expect(typeof updatedDoc?.deepNestedObject?.nestedObject?.decimal === 'number').toBeTruthy();
      expect(typeof updatedDoc?.deepNestedObject?.nestedObject?.long === 'number').toBeTruthy();
      expect(updatedDoc?.deepNestedObject?.nestedObject?.date instanceof Date).toBeTruthy();
      // Check findOne result
      const foundDocAfterUpdate = await testModel.findOne({ _id: insertedId });
      expect(typeof foundDocAfterUpdate?.deepNestedObject?.nestedObject?.decimal === 'number').toBeTruthy();
      expect(typeof foundDocAfterUpdate?.deepNestedObject?.nestedObject?.long === 'number').toBeTruthy();
      expect(foundDocAfterUpdate?.deepNestedObject?.nestedObject?.date instanceof Date).toBeTruthy();
    });
  });
  describe('schema with nestedArray properties', () => {
    type Test = {
      nestedArray?: Date[];
      nestedArrayBis?: [number, number];
      nestedArrayObject?: { date?: Date }[];
      nestedArrayDeep?: { dates?: Date[] }[];
    };
    class TestModelThree extends Model<Test> {
      static schema: Schema<Test> = {
        nestedArray: { bsonType: 'array', items: { bsonType: 'date' } },
        nestedArrayBis: {
          bsonType: 'array',
          minItems: 2,
          maxItems: 2,
          items: [
            { bsonType: 'decimal', minimum: -180, maximum: 180 }, // longitude
            { bsonType: 'decimal', minimum: -90, maximum: 90 }, // latitude
          ],
        },
        nestedArrayObject: {
          bsonType: 'array',
          items: { bsonType: 'object', properties: { date: { bsonType: 'date' } } },
        },
        nestedArrayDeep: {
          bsonType: 'array',
          items: { bsonType: 'object', properties: { dates: { bsonType: 'array', items: { bsonType: 'date' } } } },
        },
      };
      static plugins = [jsonSchemaPlugin, schemaCastingPlugin];
    }
    let testModel: TestModelThree;

    beforeAll(async () => {
      testModel = await mongo.loadModel(TestModelThree);
      expect(testModel instanceof Model).toBeTruthy();
    });
    describe('insertOne', () => {
      it('should properly cast a nestedArray property', async () => {
        const date = new Date(Date.UTC(2000, 0, 1));
        const { ops, insertedId } = await testModel.insertOne({
          nestedArray: [(date.toISOString() as unknown) as Date],
        });
        // Check op result
        const insertedDoc = ops[0];
        expect(insertedDoc?.nestedArray![0] instanceof Date).toBeTruthy();
        expect(insertedDoc?.nestedArray![0] instanceof Date).toBeTruthy();
        // Check findOne result
        const foundDoc = await testModel.findOne({ _id: insertedId });
        expect(foundDoc?.nestedArray![0] instanceof Date).toBeTruthy();
        expect(foundDoc?.nestedArray![0] instanceof Date).toBeTruthy();
      });
      it('should properly cast a nestedArrayBis property', async () => {
        const { ops, insertedId } = await testModel.insertOne({ nestedArrayBis: [1.743815, 47.364408] });
        // Check op result
        const insertedDoc = ops[0];
        expect((insertedDoc?.nestedArrayBis![0] as any) instanceof Decimal128).toBeTruthy();
        expect((insertedDoc?.nestedArrayBis![1] as any) instanceof Decimal128).toBeTruthy();
        // Check findOne result
        const foundDoc = await testModel.findOne({ _id: insertedId });
        expect(typeof foundDoc?.nestedArrayBis![0] === 'number').toBeTruthy();
        expect(typeof foundDoc?.nestedArrayBis![1] === 'number').toBeTruthy();
      });
      it('should properly cast a nestedArrayDeep property', async () => {
        const date = new Date(Date.UTC(2000, 0, 1));
        const { ops, insertedId } = await testModel.insertOne({
          nestedArrayDeep: [{ dates: [(date.toISOString() as unknown) as Date] }],
        });
        // Check op result
        const insertedDoc = ops[0];
        expect(insertedDoc?.nestedArrayDeep![0].dates![0] instanceof Date).toBeTruthy();
        expect(insertedDoc?.nestedArrayDeep![0].dates![0] instanceof Date).toBeTruthy();
        // Check findOne result
        const foundDoc = await testModel.findOne({ _id: insertedId });
        expect(foundDoc?.nestedArrayDeep![0].dates![0] instanceof Date).toBeTruthy();
        expect(foundDoc?.nestedArrayDeep![0].dates![0] instanceof Date).toBeTruthy();
      });
    });
    describe('updateOne', () => {
      it('should properly cast a nestedArray property with $set', async () => {
        const date = new Date(Date.UTC(2000, 0, 1));
        const { insertedId } = await testModel.insertOne({ nestedArray: [] });
        const { result } = await testModel.updateOne(
          { _id: insertedId },
          { $set: { nestedArray: [(date.toISOString() as unknown) as Date] } }
        );
        // Check op result
        expect(result.nModified).toEqual(1);
        // Check findOne result
        const foundDoc = await testModel.findOne({ _id: insertedId });
        expect(foundDoc?.nestedArray![0] instanceof Date).toBeTruthy();
        expect(foundDoc?.nestedArray![0] instanceof Date).toBeTruthy();
      });
      it('should properly cast a nestedArray property with $push', async () => {
        const date = new Date(Date.UTC(2000, 0, 1));
        const { insertedId } = await testModel.insertOne({ nestedArray: [] });
        const { result } = await testModel.updateOne(
          { _id: insertedId },
          { $push: { nestedArray: (date.toISOString() as unknown) as Date } }
        );
        // Check op result
        expect(result.nModified).toEqual(1);
        // Check findOne result
        const foundDoc = await testModel.findOne({ _id: insertedId });
        expect(foundDoc?.nestedArray![0] instanceof Date).toBeTruthy();
        expect(foundDoc?.nestedArray![0] instanceof Date).toBeTruthy();
      });
      it('should properly cast a nestedArray property with $set with a positional operator', async () => {
        const date = new Date(Date.UTC(2000, 0, 1));
        const { insertedId } = await testModel.insertOne({
          nestedArray: [(date.toISOString() as unknown) as Date, (date.toISOString() as unknown) as Date],
        });
        const updatedDate = new Date(Date.UTC(2010, 0, 1));
        const { result } = await testModel.updateOne(
          { _id: insertedId },
          { $set: { ['nestedArray.1']: updatedDate.toISOString() } }
        );
        // Check op result
        expect(result.nModified).toEqual(1);
        // Check findOne result
        const foundDoc = await testModel.findOne({ _id: insertedId });
        expect(foundDoc?.nestedArray![1] instanceof Date).toBeTruthy();
        expect(foundDoc?.nestedArray![1]).toEqual(updatedDate);
      });
      it('should properly cast a nestedArrayObject property with $set with a positional operator', async () => {
        const date = new Date(Date.UTC(2000, 0, 1));
        const { insertedId } = await testModel.insertOne({
          nestedArrayObject: [
            { date: (date.toISOString() as unknown) as Date },
            { date: (date.toISOString() as unknown) as Date },
          ],
        });
        const updatedDate = new Date(Date.UTC(2010, 0, 1));
        const { result } = await testModel.updateOne(
          { _id: insertedId },
          { $set: { ['nestedArrayObject.1']: { date: updatedDate.toISOString() } } }
        );
        // Check op result
        expect(result.nModified).toEqual(1);
        // Check findOne result
        const foundDoc = await testModel.findOne({ _id: insertedId });
        expect(foundDoc?.nestedArrayObject![1].date instanceof Date).toBeTruthy();
        expect(foundDoc?.nestedArrayObject![1].date).toEqual(updatedDate);
      });
    });
  });
});
