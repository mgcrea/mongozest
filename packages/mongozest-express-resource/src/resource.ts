// @docs https://www.mongodb.com/blog/post/handling-files-using-mongodb-stitch-and-aws-s3
// @docs https://github.com/hapijs/joi/blob/v13.7.0/API.md
// @docs https://github.com/dylang/shortid
// @docs http://mongodb.github.io/node-mongodb-native/3.1/reference/ecmascriptnext/crud/

import assert from 'assert';
import {cloneDeep, snakeCase, uniq} from 'lodash';
import pluralize from 'pluralize';
import {Router as createRouter} from 'express';
import Hooks from '@mongozest/hooks';
import {ObjectId} from 'mongodb';
import {mongoErrorMiddleware} from './utils/errors';
import {asyncHandler, parseBodyAsUpdate} from './utils/request';
import queryPlugin from './plugins/queryPlugin';
import populatePlugin from './plugins/populatePlugin';
import createError from 'http-errors';

// @types
import {Model} from '@mgcrea/mongozest';
import {Request, RequestHandler, Response, Router} from 'express';
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

interface ResourceOptions {
  router?: Router;
  paths?: Array<string>;
  plugins?: Array<any>;
  middleware?: RequestHandler;
  params?: {[s: string]: any};
}

type OperationMap = Map<string, any>;
type RequestParamChecker = (s: string) => boolean;
type RequestParamResolver<T> = (s: string) => FilterQuery<T>;

const OBJECT_ID_PATTERN = '[a-f\\d]{24}';
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;
// const isidParam = (key: string, value: string) => {
//   const isMatch = key === '0' && OBJECT_ID_REGEX.test(value);
//   return isMatch ? {_id: ObjectId.createFromHexString(value)} : null;
// };

const assertScopedFilter = filter => {
  if (!filter || !Object.keys(filter).length) {
    throw createError(400, 'Invalid identifier');
  }
};

export default class Resource<T> {
  static internalPrePlugins = [queryPlugin, populatePlugin];
  static internalPostPlugins = [];

  public options: any = {};
  private plugins: Array<any>;
  // private statics: Map<string, () => void> = new Map();
  private params: Map<string, RequestParamResolver<T>> = new Map();
  private ids: Map<RequestParamChecker, RequestParamResolver<T>> = new Map([
    [(s: string) => OBJECT_ID_REGEX.test(s), (s: string) => ({_id: ObjectId.createFromHexString(s)})]
  ]);

  private router: Router;
  private middleware: RequestHandler | null;
  private paths: Array<string>;
  private hooks: Hooks = new Hooks();

  static create(modelName: string, options?: any) {
    return new Resource(modelName, options);
  }

  constructor(public modelName: string, options: ResourceOptions = {}) {
    const {router, middleware, paths, params, plugins} = options;
    this.router = router || createRouter();
    this.middleware = middleware || null;
    // const {name: className, collectionName, collectionOptions, schema, plugins} = this.constructor as any;
    if (params) {
      this.addParams(params);
    }
    this.paths = paths || [`/${snakeCase(pluralize(modelName))}`];
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

  public addIdentifierHandler(check: RequestParamChecker, resolve: RequestParamResolver<T>) {
    const {ids} = this;
    ids.set(check, resolve);
  }
  public addParams(paramsMap: {[k: string]: RequestParamResolver<T>}) {
    const {params} = this;
    Object.keys(paramsMap).forEach(key => params.set(key, paramsMap[key]));
  }
  private getModelFromRequest(req: Request): Model {
    const {modelName} = this;
    return req.app.locals.mongo.model(modelName);
  }

  build() {
    const {router, paths, middleware} = this;
    this.hooks.execPreSync('build', [router]);
    // params
    paths.forEach(path => {
      // startup
      // wildcard allows req.params to be properly populated
      router.all(`${path}*`, asyncHandler(this.buildRequestFilter.bind(this)));
      // router.use(path, asyncHandler(this.buildRequestFilter.bind(this)));
      if (middleware) {
        router.use(path, middleware);
      }
      // collection
      router.get(path, asyncHandler(this.getCollection.bind(this)));
      router.post(path, asyncHandler(this.postCollection.bind(this)));
      router.delete(path, asyncHandler(this.deleteCollection.bind(this)));
      // document
      router.get(`${path}/:_id`, asyncHandler(this.getDocument.bind(this)));
      router.patch(`${path}/:_id`, asyncHandler(this.patchDocument.bind(this)));
      router.delete(`${path}/:_id`, asyncHandler(this.deleteDocument.bind(this)));
      // shutdown
      router.use(path, mongoErrorMiddleware);
    });
    this.hooks.execPostSync('build', [router]);
    return router;
  }

  async buildRequestFilter(req: Request, res: Response, next: NextFunction) {
    const model = this.getModelFromRequest(req);
    const {ids, params} = this;
    req.filter = await Object.keys(req.params).reduce(async (promiseSoFar, key) => {
      const soFar = await promiseSoFar;
      const isIdentifier = key === '0';
      const value = isIdentifier ? req.params[key].slice(1) : req.params[key];
      if (isIdentifier) {
        ids.forEach((resolve, test) => {
          if (test(value)) {
            try {
              Object.assign(soFar, resolve(value, model));
            } catch (err) {
              throw createError(400, 'Invalid url identifier');
            }
          }
        });
      } else if (params.has(key)) {
        const resolve = params.get(key);
        try {
          Object.assign(soFar, await resolve(value, model));
        } catch (err) {
          throw createError(400, 'Invalid url parameter');
        }
      }
      return soFar;
    }, Promise.resolve({}));
    next();
  }

  async getCollection(req: Request, res: Response) {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const filter: FilterQuery<TSchema> = req.filter;
    const options: FindOneOptions = {};
    const operation: OperationMap = new Map([
      ['method', 'getCollection'],
      ['scope', 'collection'],
      ['request', req],
      ['filter', filter]
    ]);
    // Execute preHooks
    await this.hooks.execManyPre(['filter', 'getCollection'], [filter, options, operation]);
    // Actual mongo call
    const result = await model.find(operation.get('filter'), options);
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execPost('getCollection', [filter, options, operation]);
    res.json(operation.get('result'));
  }

  async postCollection(req: Request, res: Response) {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const document: TSchema = req.body;
    const options: CollectionInsertOneOptions = {};
    const operation: OperationMap = new Map([['method', 'postCollection'], ['scope', 'collection'], ['request', req]]);
    // Execute preHooks
    await this.hooks.execManyPre(['insert', 'postCollection'], [document, options, operation]);
    // Actual mongo call
    const {ops} = await model.insertOne(document, options);
    operation.set('result', ops[0]);
    // Execute postHooks
    await this.hooks.execPost('postCollection', [document, options, operation]);
    res.json(operation.get('result'));
  }

  async deleteCollection(req: Request, res: Response) {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const filter: FilterQuery<TSchema> = req.filter;
    const options: CommonOptions = {};
    const operation: OperationMap = new Map([
      ['method', 'deleteCollection'],
      ['scope', 'collection'],
      ['request', req],
      ['filter', filter]
    ]);
    // Execute preHooks
    await this.hooks.execManyPre(['filter', 'deleteCollection'], [filter, options, operation]);
    // Actual mongo call
    const result = await model.deleteMany(operation.get('filter'), options);
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execPost('deleteCollection', [filter, options, operation]);
    res.json(operation.get('result'));
  }

  async getDocument(req: Request, res: Response) {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const filter: FilterQuery<TSchema> = req.filter;
    assertScopedFilter(req.filter);
    const options: FindOneOptions = {};
    const operation: OperationMap = new Map([
      ['method', 'getDocument'],
      ['scope', 'document'],
      ['request', req],
      ['filter', filter]
    ]);
    // Execute preHooks
    await this.hooks.execManyPre(['filter', 'getDocument'], [filter, options, operation]);
    // Actual mongo call
    const result = await model.findOne(operation.get('filter'), options);
    if (!result) {
      throw createError(404);
    }
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execPost('getDocument', [filter, options, operation]);
    res.json(operation.get('result'));
  }

  async patchDocument(req: Request, res: Response) {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const filter: FilterQuery<TSchema> = req.filter;
    assertScopedFilter(req.filter);
    const update: UpdateQuery<TSchema> | TSchema = parseBodyAsUpdate(req.body);
    const options: FindOneAndReplaceOption = {returnOriginal: false};
    const operation: OperationMap = new Map([
      ['method', 'patchDocument'],
      ['scope', 'document'],
      ['request', req],
      ['filter', filter]
    ]);
    // Execute preHooks
    await this.hooks.execManyPre(['filter', 'patchDocument'], [filter, update, options, operation]);
    // Actual mongo call
    const {value: result} = await model.findOneAndUpdate(operation.get('filter'), update, options);
    if (!result) {
      throw createError(404);
    }
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execPost('patchDocument', [filter, update, options, operation]);
    res.json(operation.get('result'));
  }

  async deleteDocument(req: Request, res: Response) {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const filter: FilterQuery<TSchema> = req.filter;
    assertScopedFilter(req.filter);
    const options: CommonOptions & {bypassDocumentValidation?: boolean} = {returnOriginal: false};
    const operation: OperationMap = new Map([
      ['method', 'deleteDocument'],
      ['scope', 'document'],
      ['request', req],
      ['filter', filter]
    ]);
    // Execute preHooks
    await this.hooks.execManyPre(['filter', 'deleteDocument'], [filter, options, operation]);
    // Actual mongo call
    const {result} = await model.deleteOne(operation.get('filter'), options);
    if (result.n === 0) {
      throw createError(404);
    }
    operation.set('result', {ok: result.ok, n: result.n});
    // Execute postHooks
    await this.hooks.execPost('deleteDocument', [filter, options, operation]);
    res.json(operation.get('result'));
  }
}
