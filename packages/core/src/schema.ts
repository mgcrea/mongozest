/* eslint-disable @typescript-eslint/no-empty-interface */
import {IndexOptions, ObjectId, OptionalId, WithId} from 'mongodb';

// @docs https://docs.mongodb.com/manual/reference/operator/query/jsonSchema/
// @docs https://www.typescriptlang.org/docs/handbook/advanced-types.html
// @docs https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/json-schema/index.d.ts
// export {DefaultSchema} from 'mongodb';

export type BsonType =
  | 'double'
  | 'string'
  | 'object'
  | 'array'
  | 'binData'
  | 'objectId'
  | 'bool'
  | 'date'
  | 'null'
  | 'regex'
  | 'javascript'
  | 'javascriptWithScope'
  | 'int'
  | 'timestamp'
  | 'long'
  | 'decimal'
  | 'minKey'
  | 'maxKey';

export type UnknownSchema = Record<string, unknown>;
export type AnySchema = {[key: string]: any};
export interface DefaultSchema extends AnySchema {
  _id?: ObjectId;
}
export type ForeignRef<T extends DefaultSchema> = ObjectId | T;

export type Vacated<T extends DefaultSchema> = {
  [K in keyof T]: T[K] extends ForeignRef<infer U> ? ObjectId : T[K];
};
export type Populated<T extends DefaultSchema> = {
  [K in Exclude<keyof T, '_id'>]: T[K] extends ForeignRef<infer U> | undefined ? U : T[K];
} & {_id: ObjectId};
// export type WithId<TSchema> = EnhancedOmit<TSchema, '_id'> & { _id: ExtractIdType<TSchema> };

export type Input<T extends DefaultSchema> = Vacated<T>;

export type PopulatedKeys<T extends DefaultSchema, K extends keyof T> = Omit<T, K> &
  {
    [k in K]-?: T[K] extends ForeignRef<infer U> ? U : T[K];
  };

export interface MongoJsonSchemaProperty<UProp = any, TProp = NonNullable<UProp>> {
  bsonType: BsonType;
  pattern?: string;
  enum?: Array<TProp>;
  required?: (keyof TProp)[];
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  minProperties?: number;
  maxProperties?: number;
  minimum?: number;
  maximum?: number;
  items?: TProp extends Array<infer UProp>
    ? MongoJsonSchemaProperty<UProp> | MongoJsonSchemaProperty<UProp>[] | {oneOf: MongoJsonSchemaProperty<UProp>[]}
    : never;
  // items?: MongoJsonSchemaProperty<any>;
  additionalProperties?: boolean;
  // properties?: TProp extends Record<infer KProp, infer UProp> ? {[s in KProp]: MongoJsonSchemaProperty<UProp>} : never;
  properties?: MongoJsonSchemaProperties<any>;
}
export type MongoJsonSchemaProperties<TSchema> = {[s in keyof TSchema]: MongoJsonSchemaProperty<TSchema[s]>};
export interface CollectionCreateOptions {
  $jsonSchema?: MongoJsonSchemaProperty<Record<string, any>>;
}

export interface JsonSchemaProperty<TProp = any>
  extends Omit<MongoJsonSchemaProperty<TProp>, 'items' | 'properties' | 'required'> {
  items?: TProp extends Array<infer UProp>
    ? JsonSchemaProperty<UProp> | JsonSchemaProperty<UProp>[] | {oneOf: JsonSchemaProperty<UProp>[]}
    : never;
  // items?: JsonSchemaProperty<any>;
  // properties?: TProp extends Record<string, infer UProp> ? JsonSchemaProperties<UProp> : never;
  properties?: JsonSchemaProperties<any>;
  required?: boolean;
}
export type JsonSchemaProperties<TSchema> = {[s in keyof TSchema]: JsonSchemaProperty<TSchema[s]>};

// @NOTE Exposed typings-API for model sub-schema object (requ)
export type JsonSchema<TProp = any> = JsonSchemaProperty<TProp>;
// @NOTE Exposed typings-API for model schema object
// @NOTE OptionalId<> allows to specify {_id: ObjectId} without having to set the key in the schema
export type Schema<TSchema extends DefaultSchema = DefaultSchema> = JsonSchemaProperties<OptionalId<TSchema>>;

// Extend JsonSchema
export interface JsonSchemaProperty<TProp = any> {
  ref?: string;
}
export interface JsonSchemaProperty<TProp = any> {
  select?: boolean;
}
export interface JsonSchemaProperty<TProp = any> {
  default?: TProp | (() => TProp) | string;
}
export interface JsonSchemaProperty<TProp = any> {
  index?: IndexOptions;
}
export interface JsonSchemaProperty<TProp = any> {
  faker?: string;
}
export interface JsonSchemaProperty<TProp = any> {
  trim?: boolean;
}
export interface JsonSchemaProperty<TProp = any> {
  validate?: [(...anyArgs: any[]) => boolean, string];
}
export interface JsonSchemaProperty<TProp = any> {
  file?: boolean;
}
