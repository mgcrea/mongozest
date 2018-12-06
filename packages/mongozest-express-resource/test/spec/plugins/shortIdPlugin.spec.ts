import {makeFetch} from 'supertest-fetch';
import {shortIdPlugin as modelShortIdPlugin, Model} from '@mgcrea/mongozest';
import {omit, isObject} from 'lodash';
import {createTestApp, getDbName, breakdownMiddleware} from './../../utils';
import createResource, {Resource} from './../../../src';
import shortIdPlugin from './../../../src/plugins/shortIdPlugin';

const DB_NAME = getDbName(__filename);

const app = createTestApp({routers: []});
const {mongo, redis, insertFixture} = app.locals;
const fetch = makeFetch(app);

class User extends Model {
  static schema = {
    firstName: {bsonType: 'string'},
    lastName: {bsonType: 'string'},
    email: {bsonType: 'string', required: true},
    nationality: {bsonType: 'string'}
  };
  static plugins = [modelShortIdPlugin];
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
      resource = createResource('User', {db: 'mongo', plugins: [shortIdPlugin]});
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
        const {_sid} = await insertFixture('User');
        const res = await fetch(`/users/${_sid}`, {
          method: 'get',
          headers: {'Content-Type': 'application/json'}
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
        const {_sid} = await insertFixture('User');
        const reqBody = {
          firstName: 'Laura'
        };
        const res = await fetch(`/users/${_sid}`, {
          method: 'patch',
          body: JSON.stringify(reqBody),
          headers: {'Content-Type': 'application/json'}
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
        const {_sid} = await insertFixture('User');
        const res = await fetch(`/users/${_sid}`, {
          method: 'delete',
          headers: {'Content-Type': 'application/json'}
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
