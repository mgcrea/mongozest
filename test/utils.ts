import {basename, relative} from 'path';
import {kebabCase} from 'lodash';

export const getDbName = (fileName: string): string => {
  const baseName = basename(fileName, '.ts');
  const packageName = relative(__dirname, fileName)
    .replace('../packages/', '')
    .replace(/\/test\/.*\.ts$/, '');
  return kebabCase(`${packageName}-${baseName}`);
};
