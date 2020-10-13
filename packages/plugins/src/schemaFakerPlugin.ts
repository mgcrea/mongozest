import '@mongozest/core';
import {isUndefined, get, set, isString, shuffle} from 'lodash';
import faker from 'faker';
import {CollectionInsertOneOptions, InsertOneWriteOpResult, OptionalId, WithId} from 'mongodb';
import {AnySchema, DefaultSchema, JsonSchemaProperty, Model} from '@mongozest/core';

faker.locale = 'fr';

declare module '@mongozest/core' {
  interface Model<TSchema extends AnySchema = DefaultSchema> {
    fakeOne: (document: OptionalId<TSchema>) => OptionalId<TSchema>;
    insertFakeOne: (
      document: OptionalId<TSchema>,
      options?: CollectionInsertOneOptions
    ) => Promise<InsertOneWriteOpResult<WithId<TSchema>>>;
  }
  interface JsonSchemaProperty<TProp = any> {
    faker?: string;
  }
}

export const schemaFakerPlugin = <TSchema extends DefaultSchema>(model: Model<TSchema>): void => {
  const propsWithFaker: Map<string, any> = new Map();
  model.post('initialize:property', (prop: JsonSchemaProperty, path: string) => {
    if (isString(prop) || isUndefined(prop.faker)) {
      return;
    }
    propsWithFaker.set(path, prop.faker);
  });
  model.addStatics({
    fakeOne: (document: OptionalId<TSchema>): OptionalId<TSchema> => {
      const fake = {};
      propsWithFaker.forEach((fakerOption, path) => {
        // if (isString(fakerOption)) {
        if (fakerOption === 'enum') {
          const pathEnumValue = get(model.schema, path).enum;
          set(fake, path, shuffle(pathEnumValue)[0]);
        } else {
          const fakeFunction = get(faker, fakerOption);
          set(fake, path, fakeFunction());
        }
      });
      return {...fake, ...document} as OptionalId<TSchema>;
    },
    insertFakeOne: async (
      document: OptionalId<TSchema>,
      options?: CollectionInsertOneOptions
    ): Promise<InsertOneWriteOpResult<WithId<TSchema>>> => {
      const fake = model.fakeOne(document);
      return await model.insertOne(fake as OptionalId<TSchema>, options);
    }
  });
};
