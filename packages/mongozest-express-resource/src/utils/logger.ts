import chalk from 'chalk';
import {inspect as defaultInspect} from 'util';

export const inspect = (maybeObject: object) =>
  defaultInspect(maybeObject, {compact: true, colors: true, depth: Infinity, breakLength: Infinity});

export const log = (maybeString: string) =>
  console.log(`${chalk.gray(new Date().toISOString())} - 🏢 resource: ${maybeString}`);
