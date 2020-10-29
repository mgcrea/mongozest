import chalk from 'chalk';
import {inspect as defaultInspect} from 'util';
import {toString} from 'lodash';

export {chalk};

export const chalkString = (s: unknown): string => chalk.green(`'${s}'`);
export const chalkStringArray = (a: Array<unknown>): string => `[ ${a.map(chalkString).join(', ')} ]`;
export const chalkNumber = (n: unknown): string => chalk.yellow(toString(n));
export const chalkJson = (s: unknown): string => chalk.grey(JSON.stringify(s));
export const chalkBoolean = (b: unknown): string => chalk.yellow(b ? 'true' : 'false');
export const chalkDate = (d: Date): string => chalk.magenta(d.toISOString());

export const inspect = (maybeObject: unknown): string =>
  defaultInspect(maybeObject, {compact: true, colors: true, depth: Infinity, breakLength: Infinity});

export const log = (maybeString: string): void =>
  console.log(`${chalk.gray(new Date().toISOString())} - 🏛 mongodb: ${maybeString}`);
