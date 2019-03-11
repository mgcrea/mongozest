import {ObjectId} from 'mongodb';

// @docs https://docs.mongodb.com/manual/reference/operator/query/jsonSchema/
// @docs https://www.typescriptlang.org/docs/handbook/advanced-types.html

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

export interface JsonSchema<TProp> {
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
    ? JsonSchema<UProp> | Array<JsonSchema<UProp>>
    : JsonSchema<TProp> | Array<JsonSchema<TProp>>;
  additionalProperties?: boolean;
  properties?: SchemaProperties<TProp>;
}
export interface JsonSchema<TProp> {
  default?: TProp | string | (() => TProp | any);
}
export interface JsonSchema<TProp> {
  ref?: string;
}

export type SchemaProperties<TSchema> = {[s in keyof TSchema]: JsonSchema<TSchema[s]>};
export type Schema<TSchema> = SchemaProperties<Partial<TSchema>>;
