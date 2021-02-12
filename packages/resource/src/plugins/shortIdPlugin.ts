import { DefaultSchema } from '@mongozest/core';
import { FilterQuery } from 'mongodb';
import { Resource } from '../resource';

const SID_REGEX = /^[a-z0-9\-\_]{7,14}$/i;

type ShortId = string;
export type ShortIdPluginSchema = {
  _sid: ShortId;
};

export const shortIdPlugin = <
  TSchema extends DefaultSchema & ShortIdPluginSchema = DefaultSchema & ShortIdPluginSchema
>(
  resource: Resource<TSchema>,
  { sidKey = '_sid' } = {}
): void => {
  resource.addIdentifierHandler(
    (_sid: ShortId) => SID_REGEX.test(_sid),
    (_sid: ShortId) => ({ [sidKey as '_sid']: _sid } as FilterQuery<TSchema>)
  );
  // resource.pre('id', (key: string, value: string, filter: {[s: string]: any}) => {
  //   const isMatch = key === '0' && SID_REGEX.test(value);
  //   return isMatch ? {[sidKey]: toString(value)} : null;
  // });
};
