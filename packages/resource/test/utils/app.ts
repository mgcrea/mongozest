// @docs http://expressjs.com/en/4x/api.html#express

import {inspect, promisify} from 'util';
import express from 'express';
import createError from 'http-errors';
// import {createClient as createRedis} from 'redis';
import createMongo, {ObjectId, Model} from '@mongozest/core';
import {Application, Request, Response, NextFunction} from 'express';
import {upperFirst, camelCase, cloneDeep} from 'lodash';
// import {AUTH_USER_PROJECTION} from './../../packages/core-auth/src/models/behaviors/userLogInBehavior';

import * as fixtures from './fixtures';
import assert from 'assert';

interface TestAppOptions {
  config?: (app: Application) => void;
  routers: express.Router[];
}

interface ConnectedExpress extends express.Express {
  close: () => void;
}

export const breakdownMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (!err.status || err.status === 500) {
    console.log(inspect(err, {compact: true, colors: true, depth: Infinity, breakLength: Infinity}));
  }
  if (err.name === 'MongoError' && err.code === 121) {
    res.status(422).end();
    return;
  }
  res.status(err.status || 500).json({error: err.message || 'Internal Error'});
};

export const getFixture = (name: string, payload = {}) => {
  const [model, fixture] = name.split('.');
  const key = fixture ? `${model.toLowerCase()}_${fixture}` : model.toLowerCase();
  const eligibleFixture = fixtures[key] || fixtures[fixture];
  assert(eligibleFixture, `Fixture "${key}" not found`);
  return cloneDeep(Object.assign(eligibleFixture, payload));
};

export const createTestApp = ({config, routers = []}: TestAppOptions) => {
  const app = express();
  // generic middlewares
  app.use(express.json());
  // database setup and injection
  const mongo = createMongo(process.env.MONGODB_URI || 'mongodb://mongo:27017');
  app.locals.mongo = mongo;
  // const redis = createRedis(process.env.REDIS_URI || 'redis://redis:6379/11');
  // const quit = redis.quit;
  // redis.quit = promisify(quit).bind(redis);
  // app.locals.redis = redis;
  // specific app configuration from package
  if (config) {
    config(app);
  }
  // // Mock auth middleware
  // app.use(async (req, res, next) => {
  //   if (!req.user && req.query.$user) {
  //     const User = mongo.model('User') as Model;
  //     req.user = await User.findById(req.query.$user, {projection: AUTH_USER_PROJECTION});
  //     if (!req.user) {
  //       next(createError(403));
  //     }
  //   }
  //   next();
  // });
  routers.forEach(router => app.use(router));
  // Test breakdown middleware
  app.use(breakdownMiddleware);

  app.locals.fixtures = fixtures;
  app.locals.getFixture = getFixture;
  app.locals.insertFixture = async (name: string, payload = {}) => {
    const [model, fixture] = name.split('.');
    const modelName = upperFirst(camelCase(model));
    const Model = mongo.model(modelName) as Model;
    const operation = await Model.insertOne({...app.locals.getFixture(name), ...payload});
    return operation.ops[0];
  };

  (app as ConnectedExpress).close = async () => {
    await Promise.all([/*redis.quit(), */ mongo.disconnect()]);
  };

  return app as ConnectedExpress;
};
