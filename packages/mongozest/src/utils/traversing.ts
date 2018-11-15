import {get, has, set} from 'lodash';

export const mapPathValues = (object: any, path: string, callback: any) => {
  const parts = path.split('[]');
  const currentPath = parts[0];
  if (has(object, currentPath)) {
    const valueAtPath = get(object, currentPath);
    if (parts.length === 1) {
      set(object, currentPath, callback(valueAtPath));
      return;
    }
    if (Array.isArray(valueAtPath)) {
      const remainingPath = parts
        .slice(1)
        .join('[]')
        .substr(1);
      if (!remainingPath) {
        set(object, currentPath, valueAtPath.map(itemValue => callback(itemValue)));
        return;
      }
      valueAtPath.forEach(itemValue => {
        mapPathValues(itemValue, remainingPath, callback);
      });
    }
  }
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
