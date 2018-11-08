import {inspect} from 'util';
import express from 'express';
import createMongoInterface, {ObjectId} from '@mgcrea/mongozest';
require('debug-utils').default();
import {Request, Response, NextFunction} from 'express';
// import {mongoErrorMiddleware} from './../../src';

import * as fixtures from './fixtures';

interface TestAppOptions {
  routers: express.Router[];
}

export const breakdownMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (true || !err.status || err.status === 500) {
    console.log(inspect(err, {compact: true, colors: true, depth: Infinity, breakLength: Infinity}));
  }
  res.status(err.status || 500).json({error: err.message || 'Internal Error'});
};

export const createTestApp = ({routers = []}: TestAppOptions) => {
  const app = express();
  app.use(express.json());
  // Mock auth middleware
  app.use((req, res, next) => {
    if (req.query.$user) {
      req.user = {_id: new ObjectId(req.query.$user)};
    }
    next();
  });
  routers.forEach(router => app.use(router));
  // Test breakdown middleware
  app.use(breakdownMiddleware);

  const mongo = createMongoInterface();
  app.locals.mongo = mongo;
  app.locals.insertFixture = async (model: string, payload = {}) => {
    const defaults = fixtures[model];
    return await mongo.model(model).insertOne({...defaults, ...payload});
  };

  return app;
};
