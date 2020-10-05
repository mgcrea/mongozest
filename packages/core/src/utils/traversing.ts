import {get, has, set} from 'lodash';
import {OptionalId} from 'mongodb';
import {DefaultSchema} from '../schema';

// Check a leaf path (eg. `{foo.bar: {baz: 1}}`)
export const hasLeafPath = (object: Record<string, unknown>, path: string): boolean => {
  const dottedParts = path.split('.');
  // Only relevent for deep paths (n > 2)
  if (dottedParts.length <= 2) {
    return false;
  }
  const leafPath = [dottedParts.slice(0, -1).join('.'), dottedParts.slice(-1)[0]];
  return has(object, leafPath);
};
// Check a leaf path (eg. `{foo.bar: {baz: 1}}`)
export const resolveLeafPath = (object: Record<string, unknown>, path: string): Array<string> | false => {
  const dottedParts = path.split('.');
  // Only relevent for deep paths (n > 2)
  if (dottedParts.length <= 2) {
    return false;
  }
  const leafPath = [dottedParts.slice(0, -1).join('.'), dottedParts.slice(-1)[0]];
  return has(object, leafPath) ? leafPath : false;
};
export const getPath = (object: Record<string, unknown>, path: string): string | Array<string> | false => {
  const hasDirectPath = has(object, path);
  if (hasDirectPath) {
    return path;
  }
  const leafPath = resolveLeafPath(object, path);
  if (leafPath) {
    return leafPath;
  }
  return false;
};

// @NOTE wtf about $ positional operator? and items.1 operator?
export const mapPathValues = <TSchema extends DefaultSchema>(
  object: TSchema,
  path: string,
  callback: <K extends keyof TSchema = keyof TSchema>(value: TSchema[K]) => TSchema[K]
): void => {
  const arrayParts = path.split('[]');
  const isArrayPath = arrayParts.length === 1;
  // Get path before array as lodash won't handle it
  const pathBeforeArray = arrayParts[0];
  const foundPath = getPath(object, pathBeforeArray);
  // @NOTE recursive?
  const remainingArrayPath = arrayParts.slice(1).join('[]').substr(1);
  if (foundPath) {
    const valueAtPath = get(object, foundPath);
    if (isArrayPath) {
      set(object, foundPath, callback(valueAtPath));
      return;
    }
    if (Array.isArray(valueAtPath)) {
      if (!remainingArrayPath) {
        set(
          object,
          foundPath,
          valueAtPath.map((itemValue) => callback(itemValue))
        );
        return;
      }
      valueAtPath.forEach((itemValue) => {
        mapPathValues(itemValue, remainingArrayPath, callback);
      });
    } else {
      if (!remainingArrayPath) {
        set(object, foundPath, callback(valueAtPath));
        return;
      }
      // Support non-array operators (eg. $push)
      mapPathValues(valueAtPath, remainingArrayPath, callback);
    }
  }
  // @NOTE try to handle positional operators (eg. items.1.bar)
  Object.keys(object).forEach((key) => {
    const positionalMatches = key.match(/(.+)\.([\d]+)(.*)/);
    const startsWithCurrentPath = positionalMatches && key.startsWith(`${pathBeforeArray}.`);
    if (!startsWithCurrentPath) {
      return;
    }
    const valueAtPath = object[key];
    if (!remainingArrayPath) {
      object[key as keyof TSchema] = callback(valueAtPath as TSchema[keyof TSchema]);
    } else {
      mapPathValues(valueAtPath as TSchema, remainingArrayPath, callback);
    }
  });
};

export const defaultPathValues = <TSchema extends DefaultSchema>(
  object: OptionalId<TSchema> | TSchema,
  path: string,
  callback: <K extends keyof TSchema = keyof TSchema>() => TSchema[K]
): void => {
  const parts = path.split('[]');
  const currentPath = parts[0];
  if (!has(object, currentPath)) {
    if (parts.length === 1) {
      set(object, currentPath, callback());
      return;
    }
    set(object, currentPath, []);
  }
  const valueAtPath = get(object, currentPath);
  if (Array.isArray(valueAtPath)) {
    const remainingPath = parts.slice(1).join('[]').substr(1);
    if (!remainingPath) {
      return;
    }
    valueAtPath.forEach((itemValue) => {
      defaultPathValues(itemValue, remainingPath, callback);
    });
  }
};
