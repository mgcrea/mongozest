import {makeFetch} from 'supertest-fetch';
import {ObjectId, Model} from '@mgcrea/mongozest';
import {omit, isObject} from 'lodash';
import {createTestApp, getDbName, breakdownMiddleware, fixtures} from './../../utils';
import createResource, {Resource} from 'src/';

const DB_NAME = getDbName(__filename);

const app = createTestApp({routers: []});
const {mongo, redis, insertFixture} = app.locals;
app.locals.fixtures = fixtures;
const fetch = makeFetch(app);

interface UserSchema {
  firstName?: string;
  lastName?: string;
  email: string;
  nationality?: string;
  device?: ObjectId;
}

class User extends Model<UserSchema> {
  static schema = {
    firstName: {bsonType: 'string'},
    lastName: {bsonType: 'string'},
    email: {bsonType: 'string', required: true},
    nationality: {bsonType: 'string'},
    device: {bsonType: 'objectId'}
  };
}

beforeAll(async () => {
  const db = await mongo.connect(DB_NAME);
  await db.dropDatabase();
  await mongo.loadModel(User);
});

afterAll(async () => {
  await Promise.all([redis.quit(), mongo.disconnect()]);
});

describe('Resource', () => {
  let resource: Resource;
  describe('resource', () => {
    it('should properly create resource', async () => {
      resource = createResource('User', {db: 'mongo'});
      expect(resource instanceof Resource).toBeTruthy();
    });
    it('should properly serve resource', async () => {
      const router = resource.buildRouter();
      app.use(router);
      app.use(breakdownMiddleware);
    });
  });
  describe('collection', () => {
    describe('GET /users/aggregate', () => {
      it('should return 200', async () => {
        const {insertedId} = await insertFixture('User');
        const pipeline = [];
        const query = `pipeline=${JSON.stringify(pipeline)}`;
        const res = await fetch(`/users/aggregate?${query}`, {
          method: 'get',
          headers: {'Content-Type': 'application/json'}
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
