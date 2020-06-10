export type HookCallback = (...args: unknown[]) => unknown;
export type HookMap = Map<string, Array<HookCallback>>;
export type AnyArgs = unknown[];

export interface State {
  preHooks: HookMap;
  postHooks: HookMap;
}

export default class Hooks {
  state: State = {
    preHooks: new Map(),
    postHooks: new Map()
  };

  register(hookMap: HookMap, hookName: string, callback: HookCallback): Hooks {
    if (!hookName) {
      return this;
    }
    if (!hookMap.has(hookName)) {
      hookMap.set(hookName, [callback]);
    } else {
      hookMap.set(hookName, (hookMap.get(hookName) as Array<HookCallback>).concat(callback));
    }
    return this;
  }

  pre(hookName: string, callback: HookCallback): Hooks {
    const {preHooks: hookMap} = this.state;
    return this.register(hookMap, hookName, callback);
  }

  post(hookName: string, callback: HookCallback): Hooks {
    const {postHooks: hookMap} = this.state;
    return this.register(hookMap, hookName, callback);
  }

  hasPre(hookName: string) {
    const {preHooks: hookMap} = this.state;
    return hookMap.has(hookName);
  }

  hasPost(hookName: string) {
    const {postHooks: hookMap} = this.state;
    return hookMap.has(hookName);
  }

  async exec<T extends AnyArgs>(hookMap: HookMap, hookName: string, args: T) {
    if (!hookMap.has(hookName)) {
      return [];
    }
    const hooks = hookMap.get(hookName);
    if (!Array.isArray(hooks)) {
      return [];
    }
    return await hooks.reduce<Promise<unknown[]>>(async (promiseSoFar, callback) => {
      const soFar = await promiseSoFar;
      const result = await callback(...args);
      return soFar.concat(result);
    }, Promise.resolve([]));
  }

  execSync<T extends AnyArgs>(hookMap: HookMap, hookName: string, args: T) {
    if (!hookMap.has(hookName)) {
      return [];
    }
    const hooks = hookMap.get(hookName);
    if (!Array.isArray(hooks)) {
      return [];
    }
    return hooks.reduce<unknown[]>((soFar, callback) => {
      const result = callback(...args);
      return soFar.concat(result);
    }, []);
  }

  async execMany<T extends AnyArgs>(hookMap: HookMap, hookNames: Array<string>, args: T) {
    return await hookNames.reduce<Promise<unknown[]>>(async (promiseSoFar, hookName) => {
      const soFar = await promiseSoFar;
      const result = await this.exec(hookMap, hookName, args);
      return soFar.concat(result);
    }, Promise.resolve([]));
  }

  async execEach<T extends AnyArgs[]>(hookMap: HookMap, hookName: string, arrayOfargs: T) {
    return await arrayOfargs.reduce<Promise<unknown[]>>(async (promiseSoFar, args) => {
      const soFar = await promiseSoFar;
      const result = await this.exec(hookMap, hookName, args);
      return soFar.concat(result);
    }, Promise.resolve([]));
  }

  async execPre<T extends AnyArgs>(hookName: string, args: T) {
    const {preHooks: hookMap} = this.state;
    return this.exec<T>(hookMap, hookName, args);
  }

  async execPreSync<T extends AnyArgs>(hookName: string, args: T) {
    const {preHooks: hookMap} = this.state;
    return this.execSync<T>(hookMap, hookName, args);
  }

  async execManyPre<T extends AnyArgs>(hookNames: Array<string>, args: T) {
    const {preHooks: hookMap} = this.state;
    return await this.execMany<T>(hookMap, hookNames, args);
  }

  async execEachPre<T extends AnyArgs[]>(hookName: string, arrayOfargs: T) {
    const {preHooks: hookMap} = this.state;
    return await this.execEach<T>(hookMap, hookName, arrayOfargs);
  }

  async execPost<T extends AnyArgs>(hookName: string, args: T) {
    const {postHooks: hookMap} = this.state;
    return this.exec<T>(hookMap, hookName, args);
  }

  async execPostSync<T extends AnyArgs>(hookName: string, args: T) {
    const {postHooks: hookMap} = this.state;
    return this.execSync<T>(hookMap, hookName, args);
  }

  async execManyPost<T extends AnyArgs>(hookNames: Array<string>, args: T) {
    const {postHooks: hookMap} = this.state;
    return await this.execMany<T>(hookMap, hookNames, args);
  }

  async execEachPost<T extends AnyArgs[]>(hookName: string, arrayOfargs: T) {
    const {postHooks: hookMap} = this.state;
    return await this.execEach<T>(hookMap, hookName, arrayOfargs);
  }
}
