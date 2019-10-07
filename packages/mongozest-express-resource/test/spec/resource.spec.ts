import {makeFetch} from 'supertest-fetch';
import {ObjectId, Model} from '@mgcrea/mongozest';
import {omit, isObject} from 'lodash';
import {createTestApp, getDbName, breakdownMiddleware, fixtures} from './../utils';
import createResource, {Resource} from './../../src';

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
      const router = resource.build();
      app.use(router);
      app.use(breakdownMiddleware);
    });
  });

  describe('collection', () => {
    describe('GET /users', () => {
      it('should return 200', async () => {
        const {insertedId} = await insertFixture('User.mongozest');
        const res = await fetch(`/users`, {
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
    describe('POST /users', () => {
      it('should return 200 when payload is valid', async () => {
        const reqBody = {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@gmail.com'
        };
        const res = await fetch('/users', {
          method: 'post',
          body: JSON.stringify(reqBody),
          headers: {'Content-Type': 'application/json'}
        })
          .expect(200)
          .expect('content-type', /^application\/json/);
        const resBody = await res.json();
        expect(Object.keys(resBody)).toMatchObject([...Object.keys(reqBody), '_id']);
        expect(ObjectId.isValid(resBody._id)).toBeTruthy();
      });
      it('should return 400 when payload is invalid', async () => {
        const reqBody = {
          firstName: 'John',
          lastName: 'Doe'
        };
        const res = await fetch('/users', {
          method: 'post',
          body: JSON.stringify(reqBody),
          headers: {'Content-Type': 'application/json'}
        })
          .expect(422)
          .expect('content-type', /^application\/json/);
        const resBody = await res.json();
        expect(Object.keys(resBody)).toMatchObject(['error']);
        expect(resBody).toMatchSnapshot();
      });
    });
    describe('PATCH /users', () => {
      it('should return 200', async () => {
        const {insertedId} = await insertFixture('User.mongozest');
        const reqBody = {
          firstName: 'Alex'
        };
        const res = await fetch(`/users`, {
          method: 'patch',
          body: JSON.stringify(reqBody),
          headers: {'Content-Type': 'application/json'}
        })
          .expect(200)
          .expect('content-type', /^application\/json/);
        const resBody = await res.json();
        expect(Array.isArray(resBody)).toBeTruthy();
        expect(resBody.length > 0).toBeTruthy();
        expect(omit(resBody[0], '_id')).toMatchSnapshot();
      });
    });
    describe('DELETE /users', () => {
      it('should return 200', async () => {
        await insertFixture('User.mongozest');
        const res = await fetch(`/users`, {
          method: 'delete',
          headers: {'Content-Type': 'application/json'}
        })
          .expect(200)
          .expect('content-type', /^application\/json/);
        const resBody = await res.json();
        expect(isObject(resBody)).toBeTruthy();
        expect(Object.keys(resBody)).toMatchSnapshot();
      });
    });
  });

  describe('document', () => {
    describe('GET /users/:_id', () => {
      it('should return 200', async () => {
        const {_id: insertedId} = await insertFixture('User.mongozest');
        const res = await fetch(`/users/${insertedId}`, {
          method: 'get',
          headers: {'Content-Type': 'application/json'}
        })
          .expect(200)
          .expect('content-type', /^application\/json/);
        const resBody = await res.json();
        expect(isObject(resBody)).toBeTruthy();
        expect(Object.keys(resBody)).toMatchSnapshot();
        expect(omit(resBody, '_id')).toMatchSnapshot();
      });
    });
    describe('PATCH /users/:_id', () => {
      it('should return 200', async () => {
        const {_id: insertedId} = await insertFixture('User.mongozest');
        const reqBody = {
          firstName: 'Laura'
        };
        const res = await fetch(`/users/${insertedId}`, {
          method: 'patch',
          body: JSON.stringify(reqBody),
          headers: {'Content-Type': 'application/json'}
        })
          .expect(200)
          .expect('content-type', /^application\/json/);
        const resBody = await res.json();
        expect(isObject(resBody)).toBeTruthy();
        expect(Object.keys(resBody)).toMatchSnapshot();
        expect(omit(resBody, '_id')).toMatchSnapshot();
      });
    });
    describe('DELETE /users/:_id', () => {
      it('should return 200', async () => {
        const {_id: insertedId} = await insertFixture('User.mongozest');
        const res = await fetch(`/users/${insertedId}`, {
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

describe('resource with nested paths', () => {
  let resource: Resource;
  const PATH: string = '/devices/:device/users';
  it('should properly create resource', async () => {
    resource = createResource('User', {
      db: 'mongo',
      paths: [PATH],
      params: {
        device: (_id: string) => {
          return {device: ObjectId.createFromHexString(_id)};
        }
      }
    });
    expect(resource instanceof Resource).toBeTruthy();
  });
  it('should properly serve resource', async () => {
    const router = resource.build();
    app.use(router);
    app.use(breakdownMiddleware);
  });
  // describe('collection', () => {
  //   describe('GET /users', () => {
  //     it('should return 200', async () => {
  //       const {insertedId} = await insertFixture('User.mongozest');
  //       const res = await fetch(`/users`, {
  //         method: 'get',
  //         headers: {'Content-Type': 'application/json'}
  //       })
  //         .expect(200)
  //         .expect('content-type', /^application\/json/);
  //       const resBody = await res.json();
  //       expect(Array.isArray(resBody)).toBeTruthy();
  //       expect(resBody.length).toEqual(1);
  //       expect(omit(resBody[0], '_id')).toMatchSnapshot();
  //     });
  //   });
  //   describe('POST /users', () => {
  //     it('should return 200 when payload is valid', async () => {
  //       const reqBody = {
  //         firstName: 'John',
  //         lastName: 'Doe',
  //         email: 'john.doe@gmail.com'
  //       };
  //       const res = await fetch('/users', {
  //         method: 'post',
  //         body: JSON.stringify(reqBody),
  //         headers: {'Content-Type': 'application/json'}
  //       })
  //         .expect(200)
  //         .expect('content-type', /^application\/json/);
  //       const resBody = await res.json();
  //       expect(Object.keys(resBody)).toMatchObject([...Object.keys(reqBody), '_id']);
  //       expect(ObjectId.isValid(resBody._id)).toBeTruthy();
  //     });
  //     it('should return 400 when payload is invalid', async () => {
  //       const reqBody = {
  //         firstName: 'John',
  //         lastName: 'Doe'
  //       };
  //       const res = await fetch('/users', {
  //         method: 'post',
  //         body: JSON.stringify(reqBody),
  //         headers: {'Content-Type': 'application/json'}
  //       })
  //         .expect(422)
  //         .expect('content-type', /^application\/json/);
  //       const resBody = await res.json();
  //       expect(Object.keys(resBody)).toMatchObject(['error']);
  //       expect(resBody).toMatchSnapshot();
  //     });
  //   });
  // });
});
