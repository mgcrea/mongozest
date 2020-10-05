// @docs https://docs.mongodb.com/manual/reference/operator/query/type/#document-type-available-types
import '@mongozest/core';
import {isString, toString, lowerCase, upperFirst, startCase, isUndefined} from 'lodash';
import {Model, mapPathValues, DefaultSchema} from '@mongozest/core';
import {OptionalId} from 'mongodb';

type CaseTransformOperation = 'toString' | 'lowerCase' | 'upperFirst' | 'startCase';

declare module '@mongozest/core' {
  interface JsonSchemaProperty<TProp = any> {
    caseTransform?: CaseTransformOperation[];
  }
}

const transformCase = (value: unknown, caseTransformConfig: CaseTransformOperation[]): any => {
  return caseTransformConfig.reduce<string>((valueSoFar, caseTransform) => {
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
  }, toString(value));
};

// Helper recursively parsing schema to find path where values should be casted
export const caseTransformPlugin = <TSchema extends DefaultSchema>(model: Model<TSchema>): void => {
  const caseTransformProperties = new Map<string, CaseTransformOperation[]>();
  model.post('initialize:property', (property, path) => {
    if (isString(property) || isUndefined(property.caseTransform)) {
      return;
    }
    caseTransformProperties.set(path, property.caseTransform);
  });
  model.pre('update', (_operation, _filter, update) => {
    caseTransformProperties.forEach((caseTransformConfig, path) => {
      if (update.$set) {
        mapPathValues(update.$set as OptionalId<TSchema>, path, (value) => transformCase(value, caseTransformConfig));
      }
      if (update.$push) {
        mapPathValues(update.$push as OptionalId<TSchema>, path, (value) => transformCase(value, caseTransformConfig));
      }
    });
  });
  // Handle insert
  model.pre('insert', (_operation, document) => {
    caseTransformProperties.forEach((caseTransformConfig, path) => {
      mapPathValues(document, path, (value: any) => transformCase(value, caseTransformConfig));
    });
  });
};
