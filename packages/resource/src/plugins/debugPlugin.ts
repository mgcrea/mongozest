import { DefaultSchema } from '@mongozest/core';
import { ResourceHookName } from '../typings';
import { OperationMap } from '../operation';
import { Resource } from '../resource';
import { inspect, log } from '../utils/logger';

export const debugPlugin = <TSchema extends DefaultSchema = DefaultSchema>(resource: Resource<TSchema>): void => {
  const logMethodOperation = (method: string, operation: OperationMap<TSchema>, ...args: any[]) => {
    if (operation.get('method') !== method) {
      return;
    }
    log(`resource.${method}(${args.map(inspect).join(', ')})`);
  };

  const loggedPreHooks: ResourceHookName[] = [
    'getCollection',
    'postCollection',
    'patchCollection',
    'deleteCollection',
    'getDocument',
    'patchDocument',
    'deleteDocument',
    'aggregateCollection',
  ];
  loggedPreHooks.forEach((name) => {
    resource.pre(name, (operation: OperationMap<TSchema>, ...args: unknown[]) => {
      logMethodOperation(name, operation, ...args);
    });
  });
};
