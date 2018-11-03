// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types

import {isUndefined, get, set, isString, isFunction} from 'lodash';
import faker from 'faker';
// @types
import {Model} from '..';
import {CollectionInsertOneOptions, InsertOneWriteOpResult} from 'mongodb';

faker.locale = 'fr';

// Handle schema defaults
export default function schemaFakerPlugin(model: Model, {ignoredKeys = ['_id']} = {}) {
  const propsWithFaker: Map<string, any> = new Map();
  model.post('initialize:property', (prop: {[s: string]: any} | string, path: string) => {
    if (isString(prop) || isUndefined(prop.faker)) {
      return;
    }
    propsWithFaker.set(path, prop.faker);
  });
  model.addStatics({
    fakeOne: (document: TSchema = {}) => {
      const fake = {};
      propsWithFaker.forEach((fakerOption, path) => {
        // if (isString(fakerOption)) {
        const fakeFunction = get(faker, fakerOption);
        set(fake, path, fakeFunction());
      });
      return {...fake, ...document};
    },
    insertFakeOne: async (
      document: TSchema,
      options: CollectionInsertOneOptions = {}
    ): Promise<InsertOneWriteOpResult> => {
      const fake = model.fakeOne(document);
      return await model.insertOne(fake, options);
    }
  });

  // Handle document insertion
  // model.pre('insert', (doc: T) => {
  //   propsWithFaker.forEach((defaultOption, path) => {
  //     if (!has(doc, path)) {
  //       const defaultValue = isFunction(defaultOption) ? defaultOption.call(null) : defaultOption;
  //       set(doc, path, defaultValue);
  //     }
  //   });
  // });
}
