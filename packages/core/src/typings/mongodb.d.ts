import 'mongodb';

declare module 'mongodb' {
  export interface CollectionCreateOptions {
    validator: {
      $jsonSchema?: MongoJsonSchemaProperty;
    };
  }
}
