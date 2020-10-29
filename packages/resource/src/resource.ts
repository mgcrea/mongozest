import {DefaultSchema, Model, WriteableUpdateQuery} from '@mongozest/core';
import Hooks, {HookCallback} from '@mongozest/hooks';
import assert from 'assert';
import {Request, RequestHandler, Response, Router as createRouter, Router} from 'express';
import createError from 'http-errors';
import {clone, isFunction, pick, snakeCase, uniq} from 'lodash';
import {
  CollectionInsertOneOptions,
  CommonOptions,
  DeleteWriteOpResultObject,
  FilterQuery,
  FindOneAndUpdateOption,
  FindOneOptions,
  ObjectId,
  OptionalId,
  UpdateQuery,
  WithId
} from 'mongodb';
import pluralize from 'pluralize';
import {createOperationMap, OperationMap} from './operation';
import {aggregationPlugin, populatePlugin, queryPlugin} from './plugins';
import {mongoErrorMiddleware} from './utils/errors';
import {asyncHandler, parseBodyAsUpdate} from './utils/request';

interface ResourceOptions {
  router?: Router;
  paths?: Array<string>;
  plugins?: Array<any>;
  middleware?: RequestHandler;
  params?: {[s: string]: any};
}

export type AggregationPipeline = Array<Record<string, any>>;
export type RequestParamChecker = (s: string) => boolean;
export type RequestParamResolver<TSchema extends DefaultSchema> = (
  s: string,
  m: Model<TSchema>
) => FilterQuery<TSchema>;

// const OBJECT_ID_PATTERN = '[a-f\\d]{24}';
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

const assertScopedFilter = <TSchema>(filter: FilterQuery<TSchema>) => {
  assert(filter && Object.keys(filter).length, 'Invalid filter');
};

export class Resource<TSchema extends DefaultSchema> {
  static internalPrePlugins = [queryPlugin, populatePlugin, aggregationPlugin];
  static internalPostPlugins = [];

  public options: any = {};
  private plugins: Array<any>;
  // private statics: Map<string, () => void> = new Map();
  private params: Map<string, RequestParamResolver<TSchema>> = new Map();
  private ids: Map<RequestParamChecker, RequestParamResolver<TSchema>> = new Map([
    [
      (s: string) => OBJECT_ID_REGEX.test(s),
      (s: string) => ({_id: ObjectId.createFromHexString(s)} as FilterQuery<TSchema>)
    ]
  ]);

  private router: Router;
  private middleware: RequestHandler | null;
  private paths: Array<string>;
  public hooks = new Hooks<ResourceHookName>();

  static create<USchema extends DefaultSchema>(modelName: string, options?: ResourceOptions): Resource<USchema> {
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
    const {plugins, modelName} = this;
    const allPlugins = uniq([...Resource.internalPrePlugins, ...plugins, ...Resource.internalPostPlugins]);
    allPlugins.forEach((pluginConfig, index) => {
      const pluginFn = Array.isArray(pluginConfig) ? pluginConfig[0] : pluginConfig;
      if (!pluginFn || !isFunction(pluginFn)) {
        throw new Error(`Found unexpected non-function resource plugin at index=${index} for model="${modelName}"`);
      }
      try {
        if (Array.isArray(pluginConfig)) {
          pluginFn(this, pluginConfig[1]);
        } else {
          pluginFn(this);
        }
      } catch (err) {
        console.error(
          `Failed to load resource plugin named="${pluginFn.name}" at index=${index} for model="${modelName}"`
        );
        throw err;
      }
    });
  }

  public pre(hookName: ResourceHookName, callback: HookCallback): void {
    this.hooks.pre(hookName, callback);
  }
  public post(hookName: ResourceHookName, callback: HookCallback): void {
    this.hooks.post(hookName, callback);
  }

  // urlParams -> queryFilter

  public addIdentifierHandler(check: RequestParamChecker, resolve: RequestParamResolver<TSchema>): void {
    const {ids} = this;
    ids.set(check, resolve);
  }
  public addParams(paramsMap: {[k: string]: RequestParamResolver<TSchema>}): void {
    const {params} = this;
    Object.keys(paramsMap).forEach((key) => params.set(key, paramsMap[key]));
  }
  public getModelFromRequest(req: Request): Model<TSchema> {
    const {modelName} = this;
    return req.app.locals.mongo.model(modelName);
  }

  build(): Router {
    // console.warn('resource.build() is deprecated, please use resource.buildRouter() instead.');
    return this.buildRouter();
  }

  buildRouter(): Router {
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
    const {ids, params: configParams} = this;
    const {params: reqParams} = req;
    return await Object.keys(reqParams).reduce(async (promiseSoFar, key) => {
      const soFar = await promiseSoFar;
      const value = reqParams[key];
      const isIdentifier = key === '_id';
      if (isIdentifier) {
        // Special case to handle several ids
        ids.forEach((resolve, test) => {
          if (test(value)) {
            try {
              Object.assign(soFar, resolve(value, model));
            } catch (err) {
              throw createError(400, 'Invalid url identifier');
            }
          }
        });
      } else if (configParams.has(key)) {
        // Params defined through options
        const resolve = configParams.get(key);
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

  async getCollection(req: Request, res: Response): Promise<void> {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const filter = await this.buildRequestFilter(req);
    const options: FindOneOptions<TSchema extends TSchema ? TSchema : TSchema> = {};
    const operation = createOperationMap<TSchema>({
      method: 'getCollection',
      scope: 'collection',
      request: req,
      filter
    });
    // Execute preHooks
    await this.hooks.execPre('filter', [operation, filter]);
    await this.hooks.execPre('getCollection', [operation, filter, options]);
    // Actual mongo call
    const result = await model.find(operation.get('filter'), options);
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execPost('getCollection', [operation, operation.get('filter'), options]);
    res.json(operation.get('result'));
  }

  async postCollection(req: Request, res: Response): Promise<void> {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const document: OptionalId<TSchema> = clone(req.body);
    const options: CollectionInsertOneOptions = {};
    const operation = createOperationMap<TSchema>({
      method: 'postCollection',
      scope: 'collection',
      request: req,
      document
    });
    // Execute preHooks
    await this.hooks.execManyPre(['insert', 'postCollection'], [operation, document, options]);
    // Actual mongo call
    const {ops} = await model.insertOne(operation.has('document') ? operation.get('document') : document, options);
    operation.set('result', ops[0]);
    // Execute postHooks
    await this.hooks.execPost('postCollection', [operation, document, options]);
    res.json(operation.get('result'));
  }

  async patchCollection(req: Request, res: Response): Promise<void> {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const filter = await this.buildRequestFilter(req);
    const update: WriteableUpdateQuery<TSchema> = parseBodyAsUpdate(req.body);
    const options: CommonOptions = {};
    const operation = createOperationMap<TSchema>({
      method: 'patchCollection',
      scope: 'collection',
      request: req,
      filter
    });
    // Execute preHooks
    await this.hooks.execPre('filter', [operation, filter]);
    await this.hooks.execPre('patchCollection', [operation, filter, update, options]);
    // Actual mongo call
    await model.updateMany(
      operation.get('filter'),
      operation.has('update') ? operation.get('update') : update,
      options
    );
    const result = await model.find(operation.get('filter'), options);
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execPost('patchCollection', [operation, operation.get('filter'), update, options]);
    res.json(operation.get('result'));
  }

  async deleteCollection(req: Request, res: Response): Promise<void> {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const filter = await this.buildRequestFilter(req);
    const options: CommonOptions = {};
    const operation = createOperationMap<TSchema>({
      method: 'deleteCollection',
      scope: 'collection',
      request: req,
      filter
    });
    // Execute preHooks
    await this.hooks.execPre('filter', [operation, filter]);
    await this.hooks.execPre('deleteCollection', [operation, filter, options]);
    // Actual mongo call
    const result = await model.deleteMany(operation.get('filter'), options);
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execPost('deleteCollection', [operation, operation.get('filter'), options]);
    res.json(operation.get('result'));
  }

  async getDocument(req: Request, res: Response): Promise<void> {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const filter = await this.buildRequestFilter(req);
    assertScopedFilter(filter);
    const options: FindOneOptions<TSchema extends TSchema ? TSchema : TSchema> = {};
    const operation = createOperationMap<TSchema>({
      method: 'getDocument',
      scope: 'document',
      request: req,
      filter
    });
    // Execute preHooks
    await this.hooks.execPre('filter', [operation, filter]);
    await this.hooks.execPre('getDocument', [operation, filter, options]);
    // Actual mongo call
    const result = await model.findOne(operation.get('filter'), options);
    if (!result) {
      throw createError(404);
    }
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execPost('getDocument', [operation, operation.get('filter'), options]);
    res.json(operation.get('result'));
  }

  async patchDocument(req: Request, res: Response): Promise<void> {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const filter = await this.buildRequestFilter(req);
    assertScopedFilter(filter);
    const update: WriteableUpdateQuery<TSchema> = parseBodyAsUpdate(req.body);
    const options: FindOneAndUpdateOption<TSchema> = {returnOriginal: false};
    const operation = createOperationMap<TSchema>({
      method: 'patchDocument',
      scope: 'document',
      request: req,
      filter
    });
    // Execute preHooks
    await this.hooks.execPre('filter', [operation, filter]);
    await this.hooks.execPre('patchDocument', [operation, filter, update, options]);
    // Actual mongo call
    const {value: result} = await model.findOneAndUpdate(operation.get('filter'), update, options);
    if (!result) {
      throw createError(404);
    }
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execPost('patchDocument', [operation, operation.get('filter'), update, options]);
    res.json(operation.get('result'));
  }

  async deleteDocument(req: Request, res: Response): Promise<void> {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const filter = await this.buildRequestFilter(req);
    assertScopedFilter(filter);
    const options: CommonOptions & {bypassDocumentValidation?: boolean} = {};
    const operation = createOperationMap<TSchema>({
      method: 'deleteDocument',
      scope: 'document',
      request: req,
      filter
    });
    // Execute preHooks
    await this.hooks.execManyPre(['filter', 'deleteDocument'], [operation, filter, options]);
    // Actual mongo call
    const {result} = await model.deleteOne(operation.get('filter'), options);
    if (result.n === 0) {
      throw createError(404);
    }
    operation.set('result', pick(result, 'ok', 'n'));
    // Execute postHooks
    await this.hooks.execPost('deleteDocument', [operation, operation.get('filter'), options]);
    res.json(operation.get('result'));
  }
}

export type ResourceHookName =
  | 'buildRouter'
  | 'buildPath'
  | 'filter'
  | 'insert'
  | 'getCollection'
  | 'postCollection'
  | 'patchCollection'
  | 'deleteCollection'
  | 'getDocument'
  | 'patchDocument'
  | 'deleteDocument'
  | 'aggregateCollection';

export interface Resource<TSchema extends DefaultSchema> {
  // pre
  pre(hookName: 'filter', callback: (operation: OperationMap<TSchema>, filter: FilterQuery<TSchema>) => void): void;
  pre(
    hookName: 'getCollection' | 'getDocument',
    callback: (
      operation: OperationMap<TSchema>,
      filter: FilterQuery<TSchema>,
      options: FindOneOptions<TSchema extends TSchema ? TSchema : TSchema>
    ) => void
  ): void;
  pre(
    hookName: 'insert' | 'postCollection',
    callback: (
      operation: OperationMap<TSchema>,
      document: OptionalId<TSchema>,
      options: CollectionInsertOneOptions
    ) => void
  ): void;
  pre(
    hookName: 'patchCollection',
    callback: (
      operation: OperationMap<TSchema>,
      filter: FilterQuery<TSchema>,
      update: UpdateQuery<TSchema>,
      options: CommonOptions
    ) => void
  ): void;
  pre(
    hookName: 'deleteCollection',
    callback: (operation: OperationMap<TSchema>, filter: FilterQuery<TSchema>, options: CommonOptions) => void
  ): void;
  pre(
    hookName: 'patchDocument',
    callback: (
      operation: OperationMap<TSchema>,
      filter: FilterQuery<TSchema>,
      update: UpdateQuery<TSchema>,
      options: FindOneAndUpdateOption<TSchema>
    ) => void
  ): void;
  pre(
    hookName: 'deleteDocument',
    callback: (
      operation: OperationMap<TSchema>,
      filter: FilterQuery<TSchema>,
      options: CommonOptions & {bypassDocumentValidation?: boolean}
    ) => void
  ): void;
  pre(
    hookName: 'aggregateCollection',
    callback: (
      operation: OperationMap<TSchema>,
      pipeline: AggregationPipeline,
      options: CommonOptions & {bypassDocumentValidation?: boolean}
    ) => void
  ): void;
  // post
  post(
    hookName: 'getCollection',
    callback: (
      operation: OperationMap<TSchema, TSchema[]>,
      filter: FilterQuery<TSchema>,
      options: FindOneOptions<TSchema extends TSchema ? TSchema : TSchema>
    ) => void
  ): void;
  post(
    hookName: 'postCollection',
    callback: (
      operation: OperationMap<TSchema, WithId<TSchema>>,
      document: OptionalId<TSchema>,
      options: CollectionInsertOneOptions
    ) => void
  ): void;
  post(
    hookName: 'patchCollection',
    callback: (
      operation: OperationMap<TSchema, TSchema[]>,
      filter: FilterQuery<TSchema>,
      update: UpdateQuery<TSchema>,
      options: FindOneOptions<TSchema extends TSchema ? TSchema : TSchema>
    ) => void
  ): void;
  post(
    hookName: 'deleteCollection',
    callback: (
      operation: OperationMap<TSchema, DeleteWriteOpResultObject>,
      filter: FilterQuery<TSchema>,
      options: CommonOptions
    ) => void
  ): void;
  post(
    hookName: 'getDocument',
    callback: (
      operation: OperationMap<TSchema, TSchema | null>,
      filter: FilterQuery<TSchema>,
      options: FindOneOptions<TSchema extends TSchema ? TSchema : TSchema>
    ) => void
  ): void;
  post(
    hookName: 'deleteDocument',
    callback: (
      operation: OperationMap<TSchema, DeleteWriteOpResultObject['result']>,
      filter: FilterQuery<TSchema>,
      options: CommonOptions & {bypassDocumentValidation?: boolean}
    ) => void
  ): void;
  post(
    hookName: 'aggregateCollection',
    callback: (
      operation: OperationMap<TSchema, TSchema[]>,
      pipeline: AggregationPipeline,
      options: CommonOptions & {bypassDocumentValidation?: boolean}
    ) => void
  ): void;
}

export default Resource;
