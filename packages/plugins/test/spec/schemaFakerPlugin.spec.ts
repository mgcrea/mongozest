import createMongo, {Model, jsonSchemaPlugin} from '@mongozest/core';
import schemaFakerPlugin from 'src/schemaFakerPlugin';
import {getDbName} from 'root/test/utils';

import {Decimal128 as Decimal} from 'mongodb';

const DB_NAME = getDbName(__filename);

const mongo = createMongo();

class Test extends Model {
  static schema = {
    firstName: {bsonType: 'string', faker: 'name.firstName'},
    lastName: {bsonType: 'string', faker: 'name.lastName'},
    dateValue: {bsonType: 'date', default: 'date.soon'},
    zipCode: {bsonType: 'string', faker: 'address.zipCode'},
    city: {bsonType: 'string', faker: 'address.city'},
    nestedObject: {
      bsonType: 'object',
      properties: {latitude: 'decimal', longitude: 'decimal'},
      default: {latitude: Decimal.fromString('0'), longitude: Decimal.fromString('0')}
    }
  };
  static plugins = [jsonSchemaPlugin, schemaFakerPlugin];
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
  it('should properly generate a fake doc', () => {
    const fakeDoc = TestModel.fakeOne({
      firstName: 'Olivier'
    });
    expect(Object.keys(fakeDoc)).toMatchSnapshot();
    expect(fakeDoc.firstName).toEqual('Olivier');
  });
  it('should properly insert a fake doc`', async () => {
    const {ops, insertedId} = await TestModel.insertFakeOne({
      firstName: 'Olivier'
    });
    // Check op result
    const insertedDoc = ops[0];
    expect(Object.keys(insertedDoc)).toMatchSnapshot();
    expect(insertedDoc.firstName).toEqual('Olivier');
    // Check findOne result
    const foundDoc = await TestModel.findOne({_id: insertedId});
    expect(Object.keys(foundDoc)).toMatchSnapshot();
    expect(foundDoc.firstName).toEqual('Olivier');
  });
});
