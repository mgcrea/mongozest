import {get, has, set} from 'lodash';

// @NOTE wtf about $ positional operator? and items.1 operator?
export const mapPathValues = (object: any, path: string, callback: any) => {
  const parts = path.split('[]');
  const currentPath = parts[0];
  const hasCurrentPath = has(object, currentPath);
  const remainingPath = parts
    .slice(1)
    .join('[]')
    .substr(1);
  if (hasCurrentPath) {
    const valueAtPath = get(object, currentPath);
    if (parts.length === 1) {
      set(object, currentPath, callback(valueAtPath));
      return;
    }
    if (Array.isArray(valueAtPath)) {
      if (!remainingPath) {
        set(object, currentPath, valueAtPath.map(itemValue => callback(itemValue)));
        return;
      }
      valueAtPath.forEach(itemValue => {
        mapPathValues(itemValue, remainingPath, callback);
      });
    } else {
      if (!remainingPath) {
        set(object, currentPath, callback(valueAtPath));
        return;
      }
      // Support non-array operators (eg. $push)
      mapPathValues(valueAtPath, remainingPath, callback);
    }
  }
  // @NOTE try to handle positional operators (eg. items.1.bar)
  Object.keys(object).forEach(key => {
    const positionalMatches = key.match(/(.+)\.([\d]+)(.*)/);
    const startsWithCurrentPath = positionalMatches && key.startsWith(`${currentPath}.`);
    if (!startsWithCurrentPath) {
      return;
    }
    const valueAtPath = object[key];
    if (!remainingPath) {
      object[key] = callback(valueAtPath);
    } else {
      mapPathValues(valueAtPath, remainingPath, callback);
    }
  });
};

export const defaultPathValues = (object: any, path: string, callback: any) => {
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
    const remainingPath = parts
      .slice(1)
      .join('[]')
      .substr(1);
    if (!remainingPath) {
      return;
    }
    valueAtPath.forEach(itemValue => {
      defaultPathValues(itemValue, remainingPath, callback);
    });
  }
};
