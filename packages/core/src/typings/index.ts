export {ObjectId, MongoError} from 'mongodb';
import type Model from 'src/model';
import type {BaseSchema} from 'src/schema';

export type AggregatePipeline = Record<string, any>[];
export type OperationMap = Map<string | symbol, any>;
export type Plugin<TSchema extends BaseSchema = BaseSchema> = (
  model: Model<TSchema>,
  options?: Record<string, unknown>
) => void;

/**
 * Construct a type with the properties of T except for those in type K.
 */
export type RequiredKeys<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>> & {[k in K]: NonNullable<T[k]>};
