/* eslint-disable @typescript-eslint/no-empty-interface */
import {ObjectId} from 'mongodb';

// @docs https://docs.mongodb.com/manual/reference/operator/query/jsonSchema/
// @docs https://www.typescriptlang.org/docs/handbook/advanced-types.html
// @docs https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/json-schema/index.d.ts

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
export interface DefaultSchema extends UnknownSchema {
  _id?: ObjectId;
}

export interface MongoJsonSchemaProperty<TProp = any> {
  bsonType: BsonType;
  pattern?: string;
  enum?: Array<TProp>;
  required?: (keyof TProp)[];
  minItems?: number;
  maxItems?: number;
  minProperties?: number;
  maxProperties?: number;
  minimum?: number;
  maximum?: number;
  items?: TProp extends Array<infer UProp> ? MongoJsonSchemaProperty<UProp> | MongoJsonSchemaProperty<UProp>[] : never;
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
  items?: TProp extends Array<infer UProp> ? JsonSchemaProperty<UProp> | JsonSchemaProperty<UProp>[] : never;
  // items?: JsonSchemaProperty<any>;
  // properties?: TProp extends Record<string, infer UProp> ? JsonSchemaProperties<UProp> : never;
  properties?: JsonSchemaProperties<any>;
  required?: boolean;
}
export type JsonSchemaProperties<TSchema> = {[s in keyof TSchema]: JsonSchemaProperty<TSchema[s]>};
export type JsonSchema<TSchema extends UnknownSchema = UnknownSchema> = JsonSchemaProperties<TSchema>;

// test plugin extension
export interface JsonSchemaProperty<TProp> {
  default?: TProp | string | (() => TProp | string);
}
export interface JsonSchemaProperty<TProp> {
  ref?: string;
}
