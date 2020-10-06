export {ObjectId, OptionalId, WithId, FilterQuery, MongoError} from 'mongodb';
import {UpdateQuery, MatchKeysAndValues, OnlyFieldsOfType, SchemaMember} from 'mongodb';
import type {Model} from '../model';
import type {DefaultSchema} from '../schema';

export type AggregationPipeline = Record<string, any>[];
export type Plugin<TSchema extends DefaultSchema = DefaultSchema> = (
  model: Model<TSchema>,
  options?: Record<string, unknown>
) => void;

// export type RequiredKeys<T, K extends keyof T = keyof T> = Pick<T, Exclude<keyof T, K>> & {[P in K]: NonNullable<T[P]>};

export type Writeable<T> = {-readonly [P in keyof T]: T[P]};
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : never;
export type Constructor<T> = new (...args: any[]) => T;

export type SetUpdate<TSchema> = Writeable<MatchKeysAndValues<TSchema>>;
// export type WriteableNonNullable<T> = {-readonly [P in keyof T]-?: T[P]};
export type WriteableUpdateQuery<TSchema> = Omit<UpdateQuery<TSchema>, '$set' | '$inc'> & {
  $set?: SetUpdate<TSchema>;
  $inc?: SchemaMember<TSchema, number>;
};

// $inc issue#1
/*
const {value: user} = await userModel.findOneAndUpdate(
  {username},
  {$inc: {verificationAttempts: 1}}
);
*/
