import createMongo, {JsonSchema, jsonSchemaPlugin, Model} from '@mongozest/core';
import {Decimal128 as Decimal} from 'mongodb';
import {getDbName} from 'root/test/utils';
import {schemaFakerPlugin} from 'src/schemaFakerPlugin';

const DB_NAME = getDbName(__filename);

const mongo = createMongo();

type Test = {
  firstName?: string;
  lastName?: string;
  dateValue?: Date;
  zipCode?: string;
  city?: string;
  nestedObject?: {
    latitude?: Decimal;
    longitude?: Decimal;
  };
};
class TestModel extends Model<Test> {
  static schema: JsonSchema<Test> = {
    firstName: {bsonType: 'string', faker: 'name.firstName'},
    lastName: {bsonType: 'string', faker: 'name.lastName'},
    dateValue: {bsonType: 'date', faker: 'date.soon'},
    zipCode: {bsonType: 'string', faker: 'address.zipCode'},
    city: {bsonType: 'string', faker: 'address.city'},
    nestedObject: {
      bsonType: 'object',
      properties: {latitude: {bsonType: 'decimal'}, longitude: {bsonType: 'decimal'}},
      default: {latitude: Decimal.fromString('0'), longitude: Decimal.fromString('0')}
    }
  };
  static plugins = [jsonSchemaPlugin, schemaFakerPlugin];
}
let testModel: TestModel;

beforeAll(async () => {
  const db = await mongo.connect(DB_NAME);
  await db.dropDatabase();
  it('should properly loadModel', async () => {
    testModel = await mongo.loadModel(TestModel);
    expect(TestModel instanceof Model).toBeTruthy();
  });
});

afterAll(async () => {
  await mongo.disconnect();
});

describe('schemaCastingPlugin', () => {
  it('should properly generate a fake doc', () => {
    const fakeDoc = testModel.fakeOne({
      firstName: 'Olivier'
    });
    expect(Object.keys(fakeDoc)).toMatchSnapshot();
    expect(fakeDoc.firstName).toEqual('Olivier');
  });
  it('should properly insert a fake doc`', async () => {
    const {ops, insertedId} = await testModel.insertFakeOne({
      firstName: 'Olivier'
    });
    // Check op result
    const insertedDoc = ops[0];
    expect(Object.keys(insertedDoc)).toMatchSnapshot();
    expect(insertedDoc.firstName).toEqual('Olivier');
    // Check findOne result
    const foundDoc = await testModel.findOne({_id: insertedId});
    expect(Object.keys(foundDoc)).toMatchSnapshot();
    expect(foundDoc.firstName).toEqual('Olivier');
  });
});
