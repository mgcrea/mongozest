// @docs https://www.mongodb.com/blog/post/handling-files-using-mongodb-stitch-and-aws-s3
// @docs https://github.com/hapijs/joi/blob/v13.7.0/API.md
// @docs https://github.com/dylang/shortid
// @docs http://mongodb.github.io/node-mongodb-native/3.1/reference/ecmascriptnext/crud/

import {cloneDeep, snakeCase, uniq} from 'lodash';
import pluralize from 'pluralize';
import {Router as createRouter} from 'express';
import Hooks from '@mongozest/hooks';
import {asyncHandler} from './utils/async';
import {mongoErrorMiddleware} from './utils/errors';
import queryPlugin from './plugins/queryPlugin';
import createError from 'http-errors';

// @types
import {Model} from '@mgcrea/mongozest';
import {Request, Response, Router} from 'express';
import {
  Db as MongoDb,
  Collection,
  CollectionCreateOptions,
  CollectionInsertOneOptions,
  CollectionInsertManyOptions,
  CommonOptions,
  DeleteWriteOpResultObject,
  InsertOneWriteOpResult,
  InsertWriteOpResult,
  FilterQuery,
  FindOneOptions,
  FindAndModifyWriteOpResultObject,
  FindOneAndReplaceOption,
  UpdateQuery,
  UpdateWriteOpResult,
  ReplaceWriteOpResult,
  ReplaceOneOptions
} from 'mongodb';
// require('debug-utils').default();
// restify.serve(router, 'Device', {
//   db,
//   log,
//   base: '/concepts/:concept',
//   ...conceptHooks
// });

type ResourceOptions = {
  router?: Router;
  path?: string;
  plugins?: Array<any>;
};

type OperationMap = Map<string, any>;

const OBJECT_ID_PATTERN = '[a-f\\d]{24}';
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

export default class Resource {
  static internalPrePlugins = [queryPlugin];
  static internalPostPlugins = [];

  public options: any = {};
  private plugins: Array<any>;
  // private statics: Map<string, () => void> = new Map();
  private params: Map<string, RegExp> = new Map([['_id', OBJECT_ID_REGEX]]);

  private router: Router;
  private path: string;
  private hooks: Hooks = new Hooks();

  static create(modelName: string, options?: any) {
    return new Resource(modelName, options);
  }

  constructor(public modelName: string, options: ResourceOptions = {}) {
    const {router, path, plugins} = options;
    this.router = router || createRouter();
    // const {name: className, collectionName, collectionOptions, schema, plugins} = this.constructor as any;
    this.path = path || `/${snakeCase(pluralize(modelName))}`;
    // this.collectionOptions = cloneDeep(collectionOptions);
    // this.schema = cloneDeep(schema);
    this.plugins = plugins || [];
    this.loadPlugins();
  }

  // Plugins management

  private loadPlugins() {
    const {plugins} = this;
    const allPlugins = uniq([...Resource.internalPrePlugins, ...plugins, ...Resource.internalPostPlugins]);
    allPlugins.forEach(pluginConfig => {
      if (Array.isArray(pluginConfig)) {
        pluginConfig[0](this, pluginConfig[1]);
      } else {
        pluginConfig(this);
      }
    });
  }

  public pre(hookName: string, callback: Function) {
    this.hooks.pre(hookName, callback);
  }
  public post(hookName: string, callback: Function) {
    this.hooks.post(hookName, callback);
  }

  // urlParams -> queryFilter

  public addFilterUrlParams(paramsMap: {[k: string]: RegExp}) {
    const {params} = this;
    Object.keys(paramsMap).forEach(key => this.params.set(key, paramsMap[key]));
  }
  private setupFilterUrlParams() {
    const {router, params, path} = this;
    router.all(`${path}/*`, (req, res, next) => {
      req.filter = {};
      params.forEach((value, key) => {
        if (value.test(req.params[0])) {
          req.filter[key] = req.params[0];
        }
      });
      next();
    });
  }

  private getModelFromRequest(req: Request): Model {
    const {modelName} = this;
    return req.app.locals.mongo.model(modelName);
  }
  private parseOptionsFromRequest(req: Request) {
    const {modelName} = this;
    return req.app.locals.mongo.model(modelName);
  }

  build() {
    const {router, path, params} = this;
    this.hooks.execPreSync('build', [router]);
    // params
    this.setupFilterUrlParams();
    // collection
    router.get(path, asyncHandler(this.getCollection.bind(this)));
    router.post(path, asyncHandler(this.postCollection.bind(this)));
    // document
    router.get(`${path}/:_id`, asyncHandler(this.getDocument.bind(this)));
    router.use(path, mongoErrorMiddleware);
    this.hooks.execPostSync('build', [router]);
    return router;
  }

  async getCollection(req: Request, res: Response) {
    const model = this.getModelFromRequest(req);
    // this.parseOptionsFromRequest(req, ['limit', 'sort' 'distinct', 'populate', 'sort'])
    const filter: FilterQuery<TSchema> = req.filter;
    const options: FindOneOptions = {};
    const operation: OperationMap = new Map([['request', req], ['method', 'GET'], ['scope', 'collection']]);
    await this.hooks.execManyPre(['filter', 'getCollection'], [filter, options, operation]);
    const result = await model.find(filter, options);
    operation.set('result', result);
    await this.hooks.execPost('getCollection', [filter, options, operation]);
    res.json(operation.get('result'));
  }

  async postCollection(req: Request, res: Response) {
    const model = this.getModelFromRequest(req);
    const document: TSchema = req.body;
    const options: CollectionInsertOneOptions = {};
    const operation: OperationMap = new Map([['request', req], ['method', 'POST'], ['scope', 'collection']]);
    await this.hooks.execManyPre(['insert', 'postCollection'], [document, options, operation]);
    const {ops, insertedCount, insertedId} = await model.insertOne(document, options);
    operation.set('result', ops[0]);
    await this.hooks.execPost('postCollection', [document, options, operation]);
    res.json(operation.get('result'));
  }

  async getDocument(req: Request, res: Response) {
    const model = this.getModelFromRequest(req);
    // this.parseOptionsFromRequest(req, ['limit', 'sort' 'distinct', 'populate', 'sort'])
    const filter: FilterQuery<TSchema> = req.filter;
    const options: FindOneOptions = {};
    const operation: OperationMap = new Map([['request', req], ['method', 'GET'], ['scope', 'collection']]);
    await this.hooks.execManyPre(['filter', 'getDocument'], [filter, options, operation]);
    d('getDocument', {filter});
    const result = await model.findOne(filter, options);
    operation.set('result', result);
    await this.hooks.execPost('getDocument', [filter, options, operation]);
    res.json(operation.get('result'));
  }

  /*
      get: (req, res, next) => {
      const model = db(req).model(modelName);
      const queryOptions = parseQueryOptions(req, ['query', 'select', 'limit', 'distinct', 'populate', 'sort']);
      Promise.resolve(onQuery ? onQuery(req, queryOptions.query, {method: 'GET'}) : queryOptions.query)
        .then(resolvedQuery => {
          const query = model.find(resolvedQuery);
          return applyQueryOptions(query, {limit: defaultLimit * 1, ...queryOptions}).exec();
        })
        .then(docs => (postFind ? postFind(req, docs, model) : docs))
        .then(::res.json)
        .catch({name: 'TypeError'}, err => {
          throw createError(400, err.message);
        })
        .catch(next);
    },
    */

  // Initialization

  // async initialize() {
  //   // Load plugins
  //   // await this.loadPlugins();
  //   // PreHooks handling
  //   await this.hooks.execPre('initialize', []);
  //   await this.hooks.execPost('initialize', []);
  // }

  // Plugins management

  // private async loadPlugins() {
  //   const {plugins} = this;
  //   const allPlugins = uniq([...Model.internalPrePlugins, ...plugins, ...Model.internalPostPlugins]);
  //   allPlugins.forEach(pluginConfig => {
  //     if (Array.isArray(pluginConfig)) {
  //       pluginConfig[0](this, pluginConfig[1]);
  //     } else {
  //       pluginConfig(this);
  //     }
  //   });
  // }

  // // @docs http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#insertOne
  // async insertOne(document: TSchema, options: CollectionInsertOneOptions = {}): Promise<InsertOneWriteOpResult> {
  //   await this.hooks.execManyPre(['insert', 'insertOne'], [document, options]);
  //   const response = await this.collection.insertOne(document, options);
  //   /* [ 'result', 'connection', 'message', 'ops', 'insertedCount', 'insertedId' ] */
  //   const {result, ops, insertedCount, insertedId} = response;
  //   await this.hooks.execManyPost(['insert', 'insertOne'], [document, {result, ops, insertedCount, insertedId}]);
  //   return response;
  // }
}

/*
// mongozest-express-resource

// const users = createResource('User', {db: 'mongo', plugins: []});
// users.pre('getCollection')
// users.post('getCollection')

router.get(
  '/users',
  requireUser({role: 'admin'}),
  asyncHandler(async (req, res) => {
    const {mongo: db} = req.app.locals;
    const User = db.model('User');
    const users = await User.find();
    res.json(users);
  })
);

router.param('sid', (req, res, next, id) => {
  if (!id.match(/^[a-zA-Z0-9]{7,14}$/)) {
    next(createError(400, 'Invalid shortId'));
    return;
  }
  next();
});

router.get(
  '/users/:sid',
  requireUser({role: 'admin'}),
  asyncHandler(async (req, res) => {
    const {mongo: db} = req.app.locals;
    const User = db.model('User');
    const user = await User.findBySid(req.params.sid);
    if (!user) {
      throw createError(404);
    }
    res.json(user);
  })
);


router.patch(
  '/users/:sid',
  requireUser({role: 'admin'}),
  asyncHandler(async (req, res) => {
    const {mongo: db} = req.app.locals;
    const User = db.model('User');
    const {_sid, ...payload} = req.body
    const {result, matchedCount} = await User.updateOne({_sid: req.params.sid}, {$set: payload});
    // const {result, modifiedCount, matchedCount, upsertedId, upsertedCount} = response;
    if (!matchedCount) {
      throw createError(404);
    }
    res.json(pick(result, ['n', 'nModified', 'ok']));
  })
);

router.post(
  '/users',
  requireUser({role: 'admin'}),
  asyncHandler(async (req, res) => {
    const {mongo: db} = req.app.locals;
    const User = db.model('User');
    const {result, ops, insertedCount, insertedId} = await User.insertOne(req.body);
    res.json({result, ops, insertedCount, insertedId});
  })
);

*/
