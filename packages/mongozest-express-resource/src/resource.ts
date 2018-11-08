// @docs https://www.mongodb.com/blog/post/handling-files-using-mongodb-stitch-and-aws-s3
// @docs https://github.com/hapijs/joi/blob/v13.7.0/API.md
// @docs https://github.com/dylang/shortid
// @docs http://mongodb.github.io/node-mongodb-native/3.1/reference/ecmascriptnext/crud/

import {cloneDeep, snakeCase, uniq} from 'lodash';
import pluralize from 'pluralize';
import {Router as createRouter} from 'express';
import Hooks from '@mongozest/hooks';
import {ObjectId} from 'mongodb';
import {mongoErrorMiddleware} from './utils/errors';
import {asyncHandler, parseBodyAsUpdate} from './utils/request';
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
  private params: Map<string, RegExp> = new Map([['_id', [OBJECT_ID_REGEX, ObjectId.createFromHexString]]]);

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
      const param = req.params[0];
      params.forEach((value, key) => {
        const [regex, transform] = Array.isArray(value) ? value : [value, null];
        if (regex.test(param)) {
          req.filter[key] = transform ? transform(param) : param;
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
    router.patch(`${path}/:_id`, asyncHandler(this.patchDocument.bind(this)));
    router.delete(`${path}/:_id`, asyncHandler(this.deleteDocument.bind(this)));
    // shutdown
    router.use(path, mongoErrorMiddleware);
    this.hooks.execPostSync('build', [router]);
    return router;
  }

  async getCollection(req: Request, res: Response) {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const filter: FilterQuery<TSchema> = req.filter;
    const options: FindOneOptions = {};
    const operation: OperationMap = new Map([['method', 'getCollection'], ['scope', 'collection'], ['request', req]]);
    // Execute preHooks
    await this.hooks.execManyPre(['filter', 'getCollection'], [filter, options, operation]);
    // Actual mongo call
    const result = await model.find(filter, options);
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

  async getDocument(req: Request, res: Response) {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const filter: FilterQuery<TSchema> = req.filter;
    const options: FindOneOptions = {};
    const operation: OperationMap = new Map([['method', 'getDocument'], ['scope', 'document'], ['request', req]]);
    // Execute preHooks
    await this.hooks.execManyPre(['filter', 'getDocument'], [filter, options, operation]);
    // Actual mongo call
    const result = await model.findOne(filter, options);
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execPost('getDocument', [filter, options, operation]);
    res.json(operation.get('result'));
  }

  async patchDocument(req: Request, res: Response) {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const filter: FilterQuery<TSchema> = req.filter;
    const update: UpdateQuery<TSchema> | TSchema = parseBodyAsUpdate(req.body);
    const options: FindOneAndReplaceOption = {returnOriginal: false};
    const operation: OperationMap = new Map([['method', 'patchDocument'], ['scope', 'document'], ['request', req]]);
    // Execute preHooks
    await this.hooks.execManyPre(['filter', 'patchDocument'], [filter, update, options, operation]);
    // Actual mongo call
    const {value: result} = await model.findOneAndUpdate(filter, update, options);
    operation.set('result', result);
    // Execute postHooks
    await this.hooks.execPost('patchDocument', [filter, update, options, operation]);
    res.json(operation.get('result'));
  }

  async deleteDocument(req: Request, res: Response) {
    const model = this.getModelFromRequest(req);
    // Prepare operation params
    const filter: FilterQuery<TSchema> = req.filter;
    const options: CommonOptions & {bypassDocumentValidation?: boolean} = {returnOriginal: false};
    const operation: OperationMap = new Map([['method', 'deleteDocument'], ['scope', 'document'], ['request', req]]);
    // Execute preHooks
    await this.hooks.execManyPre(['filter', 'deleteDocument'], [filter, options, operation]);
    // Actual mongo call
    const {result} = await model.deleteOne(filter, options);
    operation.set('result', {ok: result.ok, n: result.n});
    // Execute postHooks
    await this.hooks.execPost('deleteDocument', [filter, options, operation]);
    res.json(operation.get('result'));
  }
}
