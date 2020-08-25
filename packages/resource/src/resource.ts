import assert from 'assert';
import {snakeCase, uniq} from 'lodash';
import pluralize from 'pluralize';
import {Router as createRouter} from 'express';
import Hooks, {HookCallback} from '@mongozest/hooks';
import {ObjectId} from 'mongodb';
import {mongoErrorMiddleware} from './utils/errors';
import {asyncHandler, parseBodyAsUpdate} from './utils/request';
import queryPlugin from './plugins/queryPlugin';
import populatePlugin from './plugins/populatePlugin';
import createError from 'http-errors';
import {Model} from '@mongozest/core';
import {Request, RequestHandler, Response, Router} from 'express';
import {
  CollectionInsertOneOptions,
  CommonOptions,
  FilterQuery,
  FindOneOptions,
  FindOneAndReplaceOption,
  UpdateQuery
} from 'mongodb';
import aggregationPlugin from './plugins/aggregationPlugin';

interface ResourceOptions {
  router?: Router;
  paths?: Array<string>;
  plugins?: Array<any>;
  middleware?: RequestHandler;
  params?: {[s: string]: any};
}

export type OperationMap = Map<string, any>;
export type AggregationPipeline = Array<Record<string, any>>;
export type RequestParamChecker = (s: string) => boolean;
export type RequestParamResolver<TSchema> = (s: string, m: Model<TSchema>) => FilterQuery<TSchema>;

// const OBJECT_ID_PATTERN = '[a-f\\d]{24}';
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

const assertScopedFilter = <TSchema>(filter: FilterQuery<TSchema>) => {
  assert(filter && Object.keys(filter).length, 'Invalid filter');
};

export default class Resource<TSchema> {
  static internalPrePlugins = [queryPlugin, populatePlugin, aggregationPlugin];
  static internalPostPlugins = [];

  public options: any = {};
  private plugins: Array<any>;
  // private statics: Map<string, () => void> = new Map();
  private params: Map<string, RequestParamResolver<TSchema>> = new Map();
  private ids: Map<RequestParamChecker, RequestParamResolver<TSchema>> = new Map([
    [(s: string) => OBJECT_ID_REGEX.test(s), (s: string) => ({_id: ObjectId.createFromHexString(s)})]
  ]);

  private router: Router;
  private middleware: RequestHandler | null;
  private paths: Array<string>;
  public hooks: Hooks = new Hooks();

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
    allPlugins.forEach((pluginConfig) => {
      if (Array.isArray(pluginConfig)) {
        pluginConfig[0](this, pluginConfig[1]);
      } else {
        pluginConfig(this);
      }
    });
  }

  public pre(hookName: string, callback: HookCallback) {
    this.hooks.pre(hookName, callback);
  }
  public post(hookName: string, callback: HookCallback) {
    this.hooks.post(hookName, callback);
  }

  // urlParams -> queryFilter

  public addIdentifierHandler(check: RequestParamChecker, resolve: RequestParamResolver<TSchema>) {
    const {ids} = this;
    ids.set(check, resolve);
  }
  public addParams(paramsMap: {[k: string]: RequestParamResolver<TSchema>}) {
    const {params} = this;
    Object.keys(paramsMap).forEach((key) => params.set(key, paramsMap[key]));
  }
  public getModelFromRequest(req: Request): Model<TSchema> {
    const {modelName} = this;
    return req.app.locals.mongo.model(modelName);
  }

  build() {
    // console.warn('resource.build() is deprecated, please use resource.buildRouter() instead.');
    return this.buildRouter();
  }

  buildRouter() {
    const {router, paths, middleware} = this;
    this.hooks.execPreSync('buildRouter', [router, paths]);
    // params
    paths.forEach((path) => {
      const docPath = `${path}/:_id`;
      // startup
      if (middleware) {
        router.all(path, middleware);
        router.all(docPath, middleware);
      }
      // hooks
      this.hooks.execPreSync('buildPath', [router, path]);
      // collection
      router.get(path, asyncHandler(this.getCollection.bind(this)));
      router.post(path, asyncHandler(this.postCollection.bind(this)));
      router.patch(path, asyncHandler(this.patchCollection.bind(this)));
      router.delete(path, asyncHandler(this.deleteCollection.bind(this)));
      // document
      router.get(docPath, asyncHandler(this.getDocument.bind(this)));
      router.patch(docPath, asyncHandler(this.patchDocument.bind(this)));
      router.delete(docPath, asyncHandler(this.deleteDocument.bind(this)));
      // hooks
      this.hooks.execPostSync('buildPath', [router, path]);
      // shutdown
      router.use(path, mongoErrorMiddleware);
    });
    this.hooks.execPostSync('buildRouter', [router, paths]);
    return router;
  }

  async buildRequestFilter(req: Request): Promise<FilterQuery<TSchema>> {
    const model = this.getModelFromRequest(req);
    const {ids, params} = this;
    return await Object.keys(req.params).reduce(async (promiseSoFar, key) => {
      const soFar = await promiseSoFar;
      const isIdentifier = key === '_id';
      const value = req.params[key];
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
        if (resolve) {
          try {
            Object.assign(soFar, await resolve(value, model));
          } catch (err) {
            throw createError(400, 'Invalid url parameter');
          }
        }
      }
      return soFar;
    }, Promise.resolve({}));
  }

  async getCollection(req: Request, res: Response) {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const filter: FilterQuery<TSchema> = await this.buildRequestFilter(req);
    const options: FindOneOptions = {};
    const operation: OperationMap = new Map<string, unknown>([
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
    await this.hooks.execPost('getCollection', [operation.get('filter'), options, operation]);
    res.json(operation.get('result'));
  }

  async postCollection(req: Request, res: Response) {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const document: TSchema = req.body;
    const options: CollectionInsertOneOptions = {};
    const operation: OperationMap = new Map<string, unknown>([
      ['method', 'postCollection'],
      ['scope', 'collection'],
      ['request', req]
    ]);
    // Execute preHooks
    await this.hooks.execManyPre(['insert', 'postCollection'], [document, options, operation]);
    // Actual mongo call
    const {ops} = await model.insertOne(document, options);
    operation.set('result', ops[0]);
    // Execute postHooks
    await this.hooks.execPost('postCollection', [document, options, operation]);
    res.json(operation.get('result'));
  }

  async patchCollection(req: Request, res: Response) {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const filter: FilterQuery<TSchema> = await this.buildRequestFilter(req);
    const update: UpdateQuery<TSchema> = parseBodyAsUpdate(req.body);
    const options: CommonOptions = {};
    const operation: OperationMap = new Map<string, unknown>([
      ['method', 'patchCollection'],
      ['scope', 'collection'],
      ['request', req],
      ['filter', filter]
    ]);
    // Execute preHooks
    await this.hooks.execManyPre(['filter', 'patchCollection'], [filter, update, options, operation]);
    // Actual mongo call
    const {result: updateResult} = await model.updateMany(operation.get('filter'), update, options);
    const result = await model.find(operation.get('filter'), options);
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execPost('patchCollection', [operation.get('filter'), update, options, operation]);
    res.json(operation.get('result'));
  }

  async deleteCollection(req: Request, res: Response) {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const filter: FilterQuery<TSchema> = await this.buildRequestFilter(req);
    const options: CommonOptions = {};
    const operation: OperationMap = new Map<string, unknown>([
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
    await this.hooks.execPost('deleteCollection', [operation.get('filter'), options, operation]);
    res.json(operation.get('result'));
  }

  async getDocument(req: Request, res: Response) {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const filter: FilterQuery<TSchema> = await this.buildRequestFilter(req);
    assertScopedFilter(filter);
    const options: FindOneOptions = {};
    const operation: OperationMap = new Map<string, unknown>([
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
    await this.hooks.execPost('getDocument', [operation.get('filter'), options, operation]);
    res.json(operation.get('result'));
  }

  async patchDocument(req: Request, res: Response) {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const filter: FilterQuery<TSchema> = await this.buildRequestFilter(req);
    assertScopedFilter(filter);
    const update: UpdateQuery<TSchema> = parseBodyAsUpdate(req.body);
    const options: FindOneAndReplaceOption = {returnOriginal: false};
    const operation: OperationMap = new Map<string, unknown>([
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
    await this.hooks.execPost('patchDocument', [operation.get('filter'), update, options, operation]);
    res.json(operation.get('result'));
  }

  async deleteDocument(req: Request, res: Response) {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const filter: FilterQuery<TSchema> = await this.buildRequestFilter(req);
    assertScopedFilter(filter);
    const options: CommonOptions & {bypassDocumentValidation?: boolean} = {};
    const operation: OperationMap = new Map<string, unknown>([
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
    await this.hooks.execPost('deleteDocument', [operation.get('filter'), options, operation]);
    res.json(operation.get('result'));
  }
}
