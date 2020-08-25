import chalk from 'chalk';
import {inspect as defaultInspect} from 'util';
import {toString} from 'lodash';

export {chalk};

export const chalkString = (s: string): string => chalk.green(`'${s}'`);
export const chalkStringArray = (a: Array<string>): string => `[ ${a.map(chalkString).join(', ')} ]`;
export const chalkNumber = (n: number | string): string => chalk.yellow(toString(n));
export const chalkBoolean = (b: boolean): string => chalk.yellow(b ? 'true' : 'false');
export const chalkDate = (d: Date): string => chalk.magenta(d.toISOString());

export const inspect = (maybeObject: unknown): string =>
  defaultInspect(maybeObject, {compact: true, colors: true, depth: Infinity, breakLength: Infinity});

export const log = (maybeString: string): void =>
  console.log(`${chalk.gray(new Date().toISOString())} - 🏛 mongodb: ${maybeString}`);
