import { DefaultSchema } from '@mongozest/core';
import { Request } from 'express';
import createError from 'http-errors';
import JSON5 from 'json5';
import { isString, mapValues, pick } from 'lodash';
import 'mongodb';
import { FilterQuery, FindOneOptions, SchemaMember } from 'mongodb';
import { OperationMap } from '../operation';
import { Resource } from '../resource';

export type Population<T> = SchemaMember<T, number | boolean | any>;

declare module 'mongodb' {
  interface FindOneOptions<T> {
    population?: Population<T>;
  }
}

export const populatePlugin = <TSchema extends DefaultSchema = DefaultSchema>(
  resource: Resource<TSchema>,
  { strictJSON = false, optionName = 'population' } = {}
): void => {
  const parseQueryParam = (value: any, key: string) => {
    if (!isString(value) || !/^[\[\{]/.test(value)) {
      return value;
    }
    try {
      return (strictJSON ? JSON : JSON5).parse(value);
    } catch (err) {
      throw createError(400, `Failed to parse query field=\`${key}\``);
    }
  };
  const preparePopulation = (
    operation: OperationMap<TSchema>,
    _filter: FilterQuery<TSchema>,
    options: FindOneOptions<TSchema>
  ) => {
    const req: Request = operation.get('request');
    const whitelist = [optionName];
    const queryOptions = mapValues(pick(req.query, whitelist), parseQueryParam);
    if (queryOptions[optionName]) {
      options[optionName as 'population'] = queryOptions[optionName];
    }
  };
  resource.pre('getCollection', preparePopulation);
  resource.pre('getDocument', preparePopulation);
  resource.pre('patchDocument', (operation, filter, _update, options) => preparePopulation(operation, filter, options));
};
