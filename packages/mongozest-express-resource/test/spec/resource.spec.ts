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
        const {insertedId} = await insertFixture('User');
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
        const {insertedId} = await insertFixture('User');
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
        await insertFixture('User');
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
        const {_id: insertedId} = await insertFixture('User');
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
        const {_id: insertedId} = await insertFixture('User');
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
        const {_id: insertedId} = await insertFixture('User');
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
  //       const {insertedId} = await insertFixture('User');
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

describe('document', () => {
  describe(`GET ${PATH}/:_id`, () => {
    it('should return 200 with a matching device', async () => {
      const {_id: insertedId, device} = await insertFixture('User');
      const res = await fetch(`${PATH.replace(':device', device)}/${insertedId}`, {
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
    it('should return 404 for an invalid device', async () => {
      const {_id: insertedId} = await insertFixture('User');
      const res = await fetch(`${PATH.replace(':device', `${new ObjectId()}`)}/${insertedId}`, {
        method: 'get',
        headers: {'Content-Type': 'application/json'}
      })
        .expect(404)
        .expect('content-type', /^application\/json/);
    });
  });
  describe(`PATCH ${PATH}/:_id`, () => {
    it('should return 200', async () => {
      const {_id: insertedId, device} = await insertFixture('User');
      const reqBody = {
        firstName: 'Laura'
      };
      const res = await fetch(`${PATH.replace(':device', device)}/${insertedId}`, {
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
    it('should return 404 for an invalid device', async () => {
      const {_id: insertedId} = await insertFixture('User');
      const reqBody = {
        firstName: 'Laura'
      };
      const res = await fetch(`${PATH.replace(':device', `${new ObjectId()}`)}/${insertedId}`, {
        method: 'patch',
        body: JSON.stringify(reqBody),
        headers: {'Content-Type': 'application/json'}
      })
        .expect(404)
        .expect('content-type', /^application\/json/);
    });
  });
  describe(`DELETE ${PATH}/:_id`, () => {
    it('should return 200', async () => {
      const {_id: insertedId, device} = await insertFixture('User');
      const res = await fetch(`${PATH.replace(':device', device)}/${insertedId}`, {
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
    it('should return 404 for an invalid device', async () => {
      const {_id: insertedId} = await insertFixture('User');
      const res = await fetch(`${PATH.replace(':device', `${new ObjectId()}`)}/${insertedId}`, {
        method: 'delete',
        headers: {'Content-Type': 'application/json'}
      })
        .expect(404)
        .expect('content-type', /^application\/json/);
    });
  });
});

/*
import {makeFetch} from 'supertest-fetch';
import {ObjectId} from '@mgcrea/mongozest';

import {User, Group, Worker} from './../src/models';
import router from './../src/routers/workers';
import {createTestApp} from './utils/app';

const DB_NAME = getDbName(__filename);

const app = createTestApp({routers: [router]});
const {mongo, insertFixture} = app.locals;
const fetch = makeFetch(app);

beforeAll(async () => {
  const db = await mongo.connect(DB_NAME).catch(() => process.exit(1));
  await db.dropDatabase();
  await mongo.loadModel(Group);
  await mongo.loadModel(User);
  await mongo.loadModel(Worker);
});

afterAll(async () => {
  await mongo.disconnect();
});

describe('/workers', () => {
  afterEach(async () => {
    await mongo.model('User').deleteMany({});
  });

  describe('POST /workers/createProfile', () => {
    it('should return 200 when both `user` and payload are valid', async () => {
      const {insertedId} = await insertFixture('User');
      const reqBody = {
        email: 'olouvignes@gmail.com',
        phoneNumber: '+33612345678',
        firstName: 'Olivier',
        lastName: 'Louvignes',
        nationality: 'FRA',
        gender: 'male'
      };
      const res = await fetch(`/workers/createProfile?$user=${insertedId}`, {
        method: 'post',
        body: JSON.stringify(reqBody),
        headers: {'Content-Type': 'application/json'}
      })
        .expect(200)
        .expect('content-type', /^application\/json/);
      const resBody = await res.json();
      expect(Object.keys(resBody)).toMatchObject(['ok', 'n', 'nModified']);
      expect(resBody.ok).toEqual(1);
      expect(resBody.n).toEqual(1);
      expect(resBody.nModified).toEqual(0);
    });

    it('should return 401 when `user` is missing', async () => {
      const reqBody = {firstName: 'Olivier', lastName: 'Louvignes'};
      const res = await fetch(`/workers/createProfile`, {
        method: 'post',
        body: JSON.stringify(reqBody),
        headers: {'Content-Type': 'application/json'}
      }).expect(401);
    });

    it('should return 403 when `user` is invalid', async () => {
      const invalidId = new ObjectId();
      const reqBody = {user: invalidId, firstName: 'Olivier', lastName: 'Louvignes'};
      const res = await fetch(`/workers/createProfile?$user=${invalidId}`, {
        method: 'post',
        body: JSON.stringify(reqBody),
        headers: {'Content-Type': 'application/json'}
      }).expect(403);
    });

    it('should return 422 when `user` is valid but payload is invalid', async () => {
      const {insertedId} = await insertFixture('User');
      const reqBody = {firstName: 'Olivier'};
      const res = await fetch(`/workers/createProfile?$user=${insertedId}`, {
        method: 'post',
        body: JSON.stringify(reqBody),
        headers: {'Content-Type': 'application/json'}
      }).expect(422);
    });
  });
});

*/
