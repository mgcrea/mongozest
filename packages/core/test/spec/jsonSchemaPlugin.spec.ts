import createMongo, {Model} from 'src/';
import jsonSchemaPlugin from 'src/plugins/jsonSchemaPlugin';
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

describe('jsonSchemaPlugin', () => {
  describe('model with basic props', () => {
    class Test extends Model {
      static schema = {
        name: {bsonType: 'string', required: true, someInvalidProp: true},
        avatar: {bsonType: 'object', properties: {fileName: 'string', size: 'long'}},
        list: {
          bsonType: 'array',
          items: {
            oneOf: [{bsonType: 'string'}, {bsonType: 'int'}]
          }
        }
      };
      static plugins = [jsonSchemaPlugin];
    }
    let TestModel: Model;
    it('should properly loadModel', async () => {
      TestModel = await mongo.loadModel(Test);
      expect(TestModel instanceof Model).toBeTruthy();
    });
    it('should properly add `validator.$jsonSchema` to both schema and collection', async () => {
      const {ops, insertedId} = await TestModel.insertOne({name: 'insertOne', list: [1, '2']});
      const {options} = await TestModel.getCollectionInfo();
      expect(options.validator).toHaveProperty('$jsonSchema');
      expect(options.validator.$jsonSchema).toMatchSnapshot();
    });
  });
  describe('model with nested object', () => {
    class Test extends Model {
      static schema = {
        nestedObject: {
          bsonType: 'object',
          properties: {latitude: {bsonType: 'decimal', required: true}, longitude: 'decimal'},
          someInvalidProp: {latitude: 0, longitude: 0}
        }
      };
      static plugins = [jsonSchemaPlugin];
    }
    let TestModel: Model;
    it('should properly loadModel', async () => {
      TestModel = await mongo.loadModel(Test);
      expect(TestModel instanceof Model).toBeTruthy();
    });
    it('should properly add `validator.$jsonSchema` to both schema and collection', async () => {
      const {ops, insertedId} = await TestModel.insertOne({name: 'insertOne', list: [1, '2']});
      const {options} = await TestModel.getCollectionInfo();
      expect(options.validator).toHaveProperty('$jsonSchema');
      expect(options.validator.$jsonSchema).toMatchSnapshot();
    });
  });
  describe('model with nested array', () => {
    class Test extends Model {
      static schema = {
        nestedArray: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            additionalProperties: true,
            properties: {
              latitude: {bsonType: 'decimal', required: true},
              longitude: {bsonType: 'decimal', required: true}
            }
          },
          someInvalidProp: {latitude: 0, longitude: 0}
        }
      };
      static plugins = [jsonSchemaPlugin];
    }
    let TestModel: Model;
    it('should properly loadModel', async () => {
      TestModel = await mongo.loadModel(Test);
      expect(TestModel instanceof Model).toBeTruthy();
    });
    it('should properly add `validator.$jsonSchema` to both schema and collection', async () => {
      const {ops, insertedId} = await TestModel.insertOne({name: 'insertOne', list: [1, '2']});
      const {options} = await TestModel.getCollectionInfo();
      expect(options.validator).toHaveProperty('$jsonSchema');
      expect(options.validator.$jsonSchema).toMatchSnapshot();
    });
  });
});
