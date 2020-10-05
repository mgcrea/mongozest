import {ForeignRef, Model, ObjectId, Schema} from '@mongozest/core';
import {populationPlugin as modelPopulationPlugin} from '@mongozest/plugins';
import createResource, {populatePlugin, Resource} from '@mongozest/resource';
import {omit} from 'lodash';
import {getDbName} from 'root/test/utils';
import {makeFetch} from 'supertest-fetch';
import {breakdownMiddleware, createTestApp, fixtures} from '../../utils/';

const DB_NAME = getDbName(__filename);

const app = createTestApp({routers: []});
const {mongo, insertFixture} = app.locals;
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
    firstName: {bsonType: 'string'},
    lastName: {bsonType: 'string'},
    email: {bsonType: 'string', required: true},
    nationality: {bsonType: 'string'},
    device: {bsonType: 'objectId'}
  };
}

type Comment = {
  text?: string;
  user?: ForeignRef<User>;
};

class CommentModel extends Model<Comment> {
  static modelName = 'Comment';
  static schema: Schema<Comment> = {
    text: {bsonType: 'string'},
    user: {bsonType: 'objectId', ref: 'User'}
  };
  static plugins = [modelPopulationPlugin];
}

beforeAll(async () => {
  const db = await mongo.connect(DB_NAME);
  await db.dropDatabase();
  await mongo.loadModels({User: UserModel, Comment: CommentModel});
});

afterAll(async () => {
  await Promise.all([app.close()]);
});

describe('populatePlugin', () => {
  describe('resources', () => {
    describe('User', () => {
      let resource: Resource<User>;
      it('should properly create resources', async () => {
        resource = createResource('User');
        expect(resource instanceof Resource).toBeTruthy();
      });
      it('should properly serve resource', async () => {
        const router = resource.build();
        app.use(router);
      });
    });
    describe('Comment', () => {
      let resource: Resource<Comment>;
      it('should properly create resources', async () => {
        resource = createResource('Comment', {plugins: [populatePlugin]});
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
