import { Model, ObjectId, Schema } from '@mongozest/core';
import { shortIdPlugin as modelShortIdPlugin } from '@mongozest/plugins';
import createResource, { Resource, shortIdPlugin } from '@mongozest/resource';
import { isObject, omit } from 'lodash';
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
  static plugins = [modelShortIdPlugin];
}

beforeAll(async () => {
  const db = await mongo.connect(DB_NAME);
  await db.dropDatabase();
  await mongo.loadModel(UserModel);
});

afterAll(async () => {
  await Promise.all([app.close()]);
});

describe('shortIdPlugin', () => {
  let resource: Resource<User>;
  describe('resource', () => {
    it('should properly create resource', async () => {
      resource = createResource('User', { plugins: [shortIdPlugin] });
      expect(resource instanceof Resource).toBeTruthy();
    });
    it('should properly build and serve resource', async () => {
      const router = resource.build();
      app.use(router);
      // @NOTE Rebind breakdown middleware to ease testing
      app.use(breakdownMiddleware);
    });
  });
  describe('document', () => {
    describe('GET /users/:_sid', () => {
      it('should return 200', async () => {
        const { _sid } = await insertFixture('User.mongozest');
        const res = await fetch(`/users/${_sid}`, {
          method: 'get',
          headers: { 'Content-Type': 'application/json' },
        })
          .expect(200)
          .expect('content-type', /^application\/json/);
        const resBody = await res.json();
        expect(isObject(resBody)).toBeTruthy();
        expect(Object.keys(resBody)).toMatchSnapshot();
        expect(omit(resBody, '_id', '_sid')).toMatchSnapshot();
      });
      it('should not disrupt existing behavior', async () => {
        const { _id } = await insertFixture('User.mongozest');
        const res = await fetch(`/users/${_id}`, {
          method: 'get',
          headers: { 'Content-Type': 'application/json' },
        })
          .expect(200)
          .expect('content-type', /^application\/json/);
        const resBody = await res.json();
        expect(isObject(resBody)).toBeTruthy();
        expect(Object.keys(resBody)).toMatchSnapshot();
        expect(omit(resBody, '_id', '_sid')).toMatchSnapshot();
      });
    });
    describe('PATCH /users/:_sid', () => {
      it('should return 200', async () => {
        const { _sid } = await insertFixture('User.mongozest');
        const reqBody = {
          firstName: 'Laura',
        };
        const res = await fetch(`/users/${_sid}`, {
          method: 'patch',
          body: JSON.stringify(reqBody),
          headers: { 'Content-Type': 'application/json' },
        })
          .expect(200)
          .expect('content-type', /^application\/json/);
        const resBody = await res.json();
        expect(isObject(resBody)).toBeTruthy();
        expect(Object.keys(resBody)).toMatchSnapshot();
        expect(omit(resBody, '_id', '_sid')).toMatchSnapshot();
      });
    });
    describe('DELETE /users/:_sid', () => {
      it('should return 200', async () => {
        const { _sid } = await insertFixture('User.mongozest');
        const res = await fetch(`/users/${_sid}`, {
          method: 'delete',
          headers: { 'Content-Type': 'application/json' },
        })
          .expect(200)
          .expect('content-type', /^application\/json/);
        const resBody = await res.json();
        expect(isObject(resBody)).toBeTruthy();
        expect(Object.keys(resBody)).toMatchSnapshot();
        expect(resBody).toMatchSnapshot();
      });
    });
  });
});
