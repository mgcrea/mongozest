export {ObjectId, MongoError} from 'mongodb';
import type Model from 'src/model';
import type {DefaultSchema} from 'src/schema';
export type {OptionalId} from 'mongodb';

export type AggregatePipeline = Record<string, any>[];
export type Plugin<TSchema extends DefaultSchema = DefaultSchema> = (
  model: Model<TSchema>,
  options?: Record<string, unknown>
) => void;

// export type RequiredKeys<T, K extends keyof T = keyof T> = Pick<T, Exclude<keyof T, K>> & {[P in K]: NonNullable<T[P]>};

export type Writeable<T extends Record<string, any>, K extends keyof T = keyof T> = {
  [P in K]: T[P];
};

export type UnwrapPromise<T> = T extends Promise<infer U> ? U : never;
export type Constructor<T> = new (...args: any[]) => T;
