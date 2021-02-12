import { AnySchema, JsonSchemaProperty, Model } from '@mongozest/core';
import faker from 'faker';
import { get, isString, isUndefined, set, shuffle } from 'lodash';
import { CollectionInsertOneOptions, InsertOneWriteOpResult, OptionalId, WithId } from 'mongodb';

faker.locale = 'fr';

export const schemaFakerPlugin = <TSchema extends AnySchema>(model: Model<TSchema>): void => {
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
      return { ...fake, ...document } as OptionalId<TSchema>;
    },
    insertFakeOne: async (
      document: OptionalId<TSchema>,
      options?: CollectionInsertOneOptions
    ): Promise<InsertOneWriteOpResult<WithId<TSchema>>> => {
      const fake = model.fakeOne(document) as OptionalId<TSchema>;
      return await model.insertOne(fake, options);
    },
  });
};

declare module '@mongozest/core' {
  interface Model<TSchema extends AnySchema = DefaultSchema> {
    fakeOne: (document: OptionalId<TSchema>) => OptionalId<TSchema>;
    insertFakeOne: (
      document: OptionalId<TSchema>,
      options?: CollectionInsertOneOptions
    ) => Promise<InsertOneWriteOpResult<WithId<TSchema>>>;
  }
  interface JsonSchemaProperty<TProp> {
    faker?: string;
  }
}
