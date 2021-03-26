import { AggregationPipeline, Model, ObjectId, Schema } from '@mongozest/core';
import createResource, { Resource } from '@mongozest/resource';
import { omit } from 'lodash';
import { getDbName } from 'root/test/utils';
import { makeFetch } from 'supertest-fetch';
import { breakdownMiddleware, createTestApp, fixtures } from '../../utils/';

const DB_NAME = getDbName(__filename);

const app = createTestApp({ routers: [] });
const { mongo, insertFixture } = app.locals;
app.locals.fixtures = fixtures;
const fetch = makeFetch(app);

type User = {
  firstName?: string;
  lastName?: string;
  email: string;
  nationality?: string;
  device?: ObjectId;
};

class UserModel extends Model<User> {
  static modelName = 'User';
  static schema: Schema<User> = {
    firstName: { bsonType: 'string' },
    lastName: { bsonType: 'string' },
    email: { bsonType: 'string', required: true },
    nationality: { bsonType: 'string' },
    device: { bsonType: 'objectId' },
  };
}

beforeAll(async () => {
  const db = await mongo.connect(DB_NAME);
  await db.dropDatabase();
  await mongo.loadModel(UserModel);
});

afterAll(async () => {
  await Promise.all([app.close()]);
});

describe('Resource', () => {
  let resource: Resource<User>;
  beforeAll(async () => {
    resource = createResource('User');
    expect(resource instanceof Resource).toBeTruthy();
  });
  describe('resource', () => {
    it('should properly serve resource', async () => {
      const router = resource.buildRouter();
      app.use(router);
      app.use(breakdownMiddleware);
    });
  });
  describe('collection', () => {
    describe('GET /users/aggregate', () => {
      it('should return 200', async () => {
        const { insertedId } = await insertFixture('User.mongozest');
        const pipeline: AggregationPipeline = [];
        const query = `pipeline=${JSON.stringify(pipeline)}`;
        const res = await fetch(`/users/aggregate?${query}`, {
          method: 'get',
          headers: { 'Content-Type': 'application/json' },
        })
          .expect(200)
          .expect('content-type', /^application\/json/);
        const resBody = await res.json();
        expect(Array.isArray(resBody)).toBeTruthy();
        expect(resBody.length).toEqual(1);
        expect(omit(resBody[0], '_id')).toMatchSnapshot();
      });
    });
  });
});
