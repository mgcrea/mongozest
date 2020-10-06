import 'mongodb';

declare module 'mongodb' {
  export interface CollectionCreateOptions {
    validator: {
      $jsonSchema?: MongoJsonSchemaProperty;
    };
  }
  // export type MatchKeysAndValues<TSchema> = ReadonlyPartial<TSchema> & DotAndArrayNotation<any>;
  // export type MatchKeysAndValues<TSchema> = string;
}
