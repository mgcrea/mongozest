import {OptionalId} from 'mongodb';

export interface OperationMap<TSchema, TResult = any> extends Map<string | symbol, any> {
  get(key: 'method'): string; // @NOTE valid methods?
  get(key: 'result'): TResult;
  get(key: 'document'): OptionalId<TSchema>;
  get(key: 'documents'): OptionalId<TSchema>[];
  get(key: 'error'): Error | undefined;
  get(key: string | symbol): any | undefined;
}
export const createOperationMap = <TSchema>(method: string): OperationMap<TSchema> => {
  const map = new Map([['method', method]]);
  return map as OperationMap<TSchema>;
};
export const cloneOperationMap = <TSchema>(
  operation: OperationMap<TSchema>,
  ...overrides: [string | symbol, any][]
): OperationMap<TSchema> => {
  const map = new Map([...operation, ...overrides]);
  return map as OperationMap<TSchema>;
};
