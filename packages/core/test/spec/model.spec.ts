import createMongo, {Model, Schema} from '@mongozest/core';
import {jsonSchemaPlugin} from 'src/plugins/jsonSchemaPlugin';
import {getDbName} from 'root/test/utils';
import {Collection, CollectionCreateOptions, Decimal128} from 'mongodb';

const DB_NAME = getDbName(__filename);

const mongo = createMongo();

beforeAll(async () => {
  const db = await mongo.connect(DB_NAME);
  await db.dropDatabase();
});

afterAll(async () => {
  await mongo.disconnect();
});

describe('jsonSchemaPlugin', () => {
  describe('model with basic props', () => {
    type Test = {
      firstName: string;
      lastName: string;
    };
    class TestModel extends Model<Test> {
      static collectionName = 'test';
      static schema: Schema<Test> = {
        firstName: {bsonType: 'string', required: true},
        lastName: {bsonType: 'string', required: true}
      };
      static plugins = [];
    }
    let testModel: TestModel;
    it('should properly loadModel', async () => {
      testModel = await mongo.loadModel(TestModel);
      expect(testModel instanceof Model).toBeTruthy();
      expect(testModel.collection).toBeTruthy();
      expect(testModel.collection.collectionName).toEqual('test');
    });
  });
});
