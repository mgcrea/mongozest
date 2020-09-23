import {ObjectId} from 'mongodb';
import Model from './model';

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

export interface BaseSchema extends Record<string, unknown> {
  _id: ObjectId;
}
// export type BaseSchema extends object = {_id: ObjectId};
export interface JsonSchemaProperty<TProp = unknown> {
  bsonType: BsonType;
  pattern?: string;
  enum?: Array<TProp>;
  required?: boolean;
  minItems?: number;
  maxItems?: number;
  minProperties?: number;
  maxProperties?: number;
  minimum?: number;
  maximum?: number;
  items?: TProp extends Array<infer UProp>
    ? JsonSchemaProperty<UProp> | Array<JsonSchemaProperty<UProp>>
    : JsonSchemaProperty<TProp> | Array<JsonSchemaProperty<TProp>>;
  additionalProperties?: boolean;
  properties?: JsonSchemaProperties<TProp>;
}
// test plugin extension
export interface JsonSchemaProperty<TProp> {
  default?: TProp | string | (() => TProp | any);
}
export interface JsonSchemaProperty<TProp> {
  ref?: string;
}
export type JsonSchemaProperties<TSchema> = {[s in keyof TSchema]: JsonSchemaProperty<TSchema[s]>};
// export type Schema<TSchema> = JsonSchemaProperties<Partial<TSchema>>;
// export type UnknownSchema = JsonSchemaProperties<Record<string, unknown>>;

export type SchemaPlugin<TSchema extends BaseSchema = BaseSchema> = (
  model: Model<TSchema>,
  options?: Record<string, unknown>
) => void;
