import createMongoLeaf, {Model, jsonSchemaPlugin, schemaDefaultsPlugin} from './../../../src';
import {Decimal128 as Decimal} from 'mongodb';
import {basename} from 'path';
import {kebabCase} from 'lodash';

require('debug-utils').default();
const DB_NAME = kebabCase(basename(__filename, '.ts'));

const mongo = createMongoLeaf();

class Test extends Model {
  static schema = {
    name: {bsonType: 'string'},
    stringValue: {bsonType: 'string', default: 'bar'},
    dateValue: {bsonType: 'date', default: Date.now},
    nestedObject: {
      bsonType: 'object',
      properties: {latitude: 'decimal', longitude: 'decimal'},
      default: {latitude: Decimal.fromString('0'), longitude: Decimal.fromString('0')}
    }
  };
  static plugins = [jsonSchemaPlugin, schemaDefaultsPlugin];
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
      expect(insertedDoc.nestedObject).toEqual({latitude: Decimal.fromString('0'), longitude: Decimal.fromString('0')});
      // Check findOne result
      const foundDoc = await TestModel.findOne({_id: insertedId});
      expect(foundDoc.stringValue).toEqual('bar');
      expect(foundDoc.dateValue instanceof Date).toBeTruthy();
      expect(foundDoc.dateValue.getTime() > 0).toBeTruthy();
      expect(foundDoc.nestedObject).toEqual({latitude: Decimal.fromString('0'), longitude: Decimal.fromString('0')});
    });
  });
});
