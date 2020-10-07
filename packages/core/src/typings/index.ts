export {FilterQuery, MongoError, ObjectId, OptionalId, WithId} from 'mongodb';
import {MatchKeysAndValues, ProjectionOperators, PushOperator, SchemaMember, UpdateQuery} from 'mongodb';
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

export type Projection<TSchema> = SchemaMember<TSchema, ProjectionOperators | number | boolean | any>;
export type SetUpdate<TSchema> = Writeable<MatchKeysAndValues<TSchema>>;
// export type WriteableNonNullable<T> = {-readonly [P in keyof T]-?: T[P]};
export type WriteableUpdateQuery<TSchema> = Omit<UpdateQuery<TSchema>, '$set' | '$inc' | '$push' | '$pull'> & {
  $set?: SetUpdate<TSchema>;
  $inc?: SchemaMember<TSchema, number>;
  $push?: Writeable<PushOperator<TSchema>>;
  $pull?: Writeable<PushOperator<TSchema>>;
};

// $inc issue#1
/*
const {value: user} = await userModel.findOneAndUpdate(
  {username},
  {$inc: {verificationAttempts: 1}}
);
*/
