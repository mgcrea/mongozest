import createMongo, { Model, Schema, jsonSchemaPlugin } from 'src/index';
import { getDbName } from 'root/test/utils';
import { CollectionCreateOptions, Decimal128 } from 'mongodb';

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
      name: string;
      avatar?: { fileName?: string; size?: number };
      list?: (string | number)[];
    };
    class TestModel extends Model<Test> {
      static schema: Schema<Test> = {
        // @ts-expect-error checking some invalid prop
        name: { bsonType: 'string', required: true, someInvalidProp: true },
        avatar: { bsonType: 'object', properties: { fileName: { bsonType: 'string' }, size: { bsonType: 'long' } } },
        list: {
          bsonType: 'array',
          items: {
            oneOf: [{ bsonType: 'string' }, { bsonType: 'int' }],
          },
        },
      };
      static plugins = [jsonSchemaPlugin];
    }
    let testModel: TestModel;
    // beforeAll(async () => {
    it('should properly loadModel', async () => {
      testModel = await mongo.loadModel(TestModel);
      expect(testModel instanceof Model).toBeTruthy();
    });
    // });
    it('should properly add `validator.$jsonSchema` to both schema and collection', async () => {
      const { ops, insertedId } = await testModel.insertOne({ name: 'insertOne', list: [1, '2'] });
      const { options } = await testModel.getCollectionInfo<{ options: CollectionCreateOptions }>();
      expect(options.validator).toHaveProperty('$jsonSchema');
      // @ts-expect-error missing prop
      expect(options.validator.$jsonSchema).toMatchSnapshot();
    });
  });
  describe('model with nested object', () => {
    type Test = {
      nestedObject?: { latitude: Decimal128; longitude?: Decimal128 };
    };
    class TestModel extends Model<Test> {
      static schema: Schema<Test> = {
        nestedObject: {
          bsonType: 'object',
          properties: { latitude: { bsonType: 'decimal', required: true }, longitude: { bsonType: 'decimal' } },
          // @ts-expect-error checking some invalid prop
          someInvalidProp: { latitude: 0, longitude: 0 },
        },
      };
      static plugins = [jsonSchemaPlugin];
    }
    let testModel: TestModel;
    // beforeAll(async () => {
    it('should properly loadModel', async () => {
      testModel = await mongo.loadModel(TestModel);
      expect(testModel instanceof Model).toBeTruthy();
    });
    // });
    it('should properly add `validator.$jsonSchema` to both schema and collection', async () => {
      // @ts-expect-error invalid insertOne
      const { ops, insertedId } = await testModel.insertOne({ name: 'insertOne', list: [1, '2'] });
      const { options } = await testModel.getCollectionInfo<{ options: CollectionCreateOptions }>();
      expect(options.validator).toHaveProperty('$jsonSchema');
      // @ts-expect-error missing prop
      expect(options.validator.$jsonSchema).toMatchSnapshot();
    });
  });
  describe('model with nested array', () => {
    type Test = {
      nestedArray?: { latitude: Decimal128; longitude?: Decimal128 }[];
    };
    class TestModel extends Model<Test> {
      static schema: Schema<Test> = {
        nestedArray: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            additionalProperties: true,
            properties: {
              latitude: { bsonType: 'decimal', required: true },
              longitude: { bsonType: 'decimal', required: true },
            },
          },
          // @ts-expect-error checking some invalid prop
          someInvalidProp: { latitude: 0, longitude: 0 },
        },
      };
      static plugins = [jsonSchemaPlugin];
    }
    let testModel: TestModel;
    // beforeAll(async () => {
    it('should properly loadModel', async () => {
      testModel = await mongo.loadModel(TestModel);
      expect(testModel instanceof Model).toBeTruthy();
    });
    // });
    it('should properly add `validator.$jsonSchema` to both schema and collection', async () => {
      // @ts-expect-error invalid insertOne
      const { ops, insertedId } = await testModel.insertOne({ name: 'insertOne', list: [1, '2'] });
      const { options } = await testModel.getCollectionInfo<{ options: CollectionCreateOptions }>();
      expect(options.validator).toHaveProperty('$jsonSchema');
      // @ts-expect-error missing prop
      expect(options.validator.$jsonSchema).toMatchSnapshot();
    });
  });
});
