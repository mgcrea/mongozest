import {Model} from '@mongozest/core';
import {populatePlugin as modelPopulatePlugin} from '@mongozest/plugins';
import {omit} from 'lodash';
import {getDbName} from 'root/test/utils';
import createResource, {Resource} from 'src/index';
import populatePlugin from 'src/plugins/populatePlugin';
import {makeFetch} from 'supertest-fetch';
import {breakdownMiddleware, createTestApp} from 'test/utils/app';
import fixtures from 'test/utils/fixtures';

const DB_NAME = getDbName(__filename);

const app = createTestApp({routers: []});
const {mongo, redis, insertFixture} = app.locals;
app.locals.fixtures = fixtures;
const fetch = makeFetch(app);

class User extends Model {
  static schema = {
    firstName: {bsonType: 'string'},
    lastName: {bsonType: 'string'},
    email: {bsonType: 'string', required: true},
    nationality: {bsonType: 'string'},
    device: {bsonType: 'objectId'}
  };
}

class Comment extends Model {
  static schema = {
    text: {bsonType: 'string'},
    user: {bsonType: 'objectId', ref: 'User'}
  };
  static plugins = [modelPopulatePlugin];
}

beforeAll(async () => {
  const db = await mongo.connect(DB_NAME);
  await db.dropDatabase();
  await mongo.loadModels({User, Comment});
});

afterAll(async () => {
  await Promise.all([app.close()]);
});

describe('populatePlugin', () => {
  describe('resources', () => {
    describe('User', () => {
      let resource: Resource;
      it('should properly create resources', async () => {
        resource = createResource('User', {db: 'mongo'});
        expect(resource instanceof Resource).toBeTruthy();
      });
      it('should properly serve resource', async () => {
        const router = resource.build();
        app.use(router);
      });
    });
    describe('Comment', () => {
      let resource: Resource;
      it('should properly create resources', async () => {
        resource = createResource('Comment', {db: 'mongo', plugins: [populatePlugin]});
        expect(resource instanceof Resource).toBeTruthy();
      });
      it('should properly serve resource', async () => {
        const router = resource.build();
        app.use(router);
      });
    });
    afterAll(() => {
      app.use(breakdownMiddleware);
    });
  });
  describe('collection', () => {
    describe('GET /comments', () => {
      it('should return 200', async () => {
        const {_id: userId} = await insertFixture('user.mongozest');
        const {insertedId} = await mongo.model('Comment').insertOne({text: 'Hello World', user: userId});
        const query = `population=${JSON.stringify({user: 1})}`;
        const res = await fetch(`/comments?${query}`, {
          method: 'get',
          headers: {'Content-Type': 'application/json'}
        })
          .expect(200)
          .expect('content-type', /^application\/json/);
        const resBody = await res.json();
        expect(Array.isArray(resBody)).toBeTruthy();
        expect(resBody.length).toEqual(1);
        expect(omit(resBody[0], '_id', 'user')).toMatchSnapshot();
        expect(typeof resBody[0].user).toBe('object');
        expect(omit(resBody[0].user, '_id')).toMatchSnapshot();
      });
    });
  });
});
