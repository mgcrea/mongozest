// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types

import {isString, toString, lowerCase, upperFirst, startCase, isUndefined} from 'lodash';
import {Model, mapPathValues, BaseSchema} from '@mongozest/core';
import {FilterQuery, UpdateQuery} from 'mongodb';

// @docs https://docs.mongodb.com/manual/reference/bson-types/
const transformCase = (value: any, caseTransformConfig: string[]) => {
  return caseTransformConfig.reduce((valueSoFar, caseTransform) => {
    switch (caseTransform) {
      case 'toString':
        return toString(valueSoFar);
      case 'lowerCase':
        return lowerCase(valueSoFar);
      case 'upperFirst':
        return upperFirst(valueSoFar);
      case 'startCase':
        return startCase(valueSoFar);
      default:
        return valueSoFar;
    }
  }, value);
};

// Helper recursively parsing schema to find path where values should be casted
export default function caseTransformPlugin<TSchema extends BaseSchema>(model: Model): void {
  const caseTransformProperties = new Map<string, string[]>();
  model.post('initialize:property', (property: {[s: string]: any}, path: string) => {
    if (isString(property) || isUndefined(property.caseTransform)) {
      return;
    }
    caseTransformProperties.set(path, property.caseTransform);
  });
  // @TODO TEST-ME!
  model.pre('update', (_filter: FilterQuery<TSchema>, update: UpdateQuery<TSchema> | TSchema) => {
    caseTransformProperties.forEach((caseTransformConfig, path) => {
      if (update.$set) {
        mapPathValues(update.$set, path, (value: any) => transformCase(value, caseTransformConfig));
      }
      if (update.$push) {
        mapPathValues(update.$push, path, (value: any) => transformCase(value, caseTransformConfig));
      }
    });
  });
  // Handle insert
  model.pre('insert', (doc: TSchema) => {
    caseTransformProperties.forEach((caseTransformConfig, path) => {
      mapPathValues(doc, path, (value: any) => transformCase(value, caseTransformConfig));
    });
  });
}
