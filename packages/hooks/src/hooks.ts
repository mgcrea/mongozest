export type HookCallback = (...args: unknown[]) => unknown;
export type HookMap = Map<string, Array<HookCallback>>;

interface State {
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

  async exec(hookMap: HookMap, hookName: string, args: Array<unknown>) {
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

  execSync(hookMap: HookMap, hookName: string, args: Array<unknown>) {
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

  async execMany(hookMap: HookMap, hookNames: Array<string>, args: Array<unknown>) {
    return await hookNames.reduce<Promise<unknown[]>>(async (promiseSoFar, hookName) => {
      const soFar = await promiseSoFar;
      const result = await this.exec(hookMap, hookName, args);
      return soFar.concat(result);
    }, Promise.resolve([]));
  }

  async execEach(hookMap: HookMap, hookName: string, arrayOfargs: Array<Array<unknown>>) {
    return await arrayOfargs.reduce<Promise<unknown[]>>(async (promiseSoFar, args) => {
      const soFar = await promiseSoFar;
      const result = await this.exec(hookMap, hookName, args);
      return soFar.concat(result);
    }, Promise.resolve([]));
  }

  async execPre(hookName: string, args: Array<unknown>) {
    const {preHooks: hookMap} = this.state;
    return this.exec(hookMap, hookName, args);
  }

  async execPreSync(hookName: string, args: Array<unknown>) {
    const {preHooks: hookMap} = this.state;
    return this.execSync(hookMap, hookName, args);
  }

  async execManyPre(hookNames: Array<string>, args: Array<unknown>) {
    const {preHooks: hookMap} = this.state;
    return await this.execMany(hookMap, hookNames, args);
  }

  async execEachPre(hookName: string, arrayOfargs: Array<Array<unknown>>) {
    const {preHooks: hookMap} = this.state;
    return await this.execEach(hookMap, hookName, arrayOfargs);
  }

  async execPost(hookName: string, args: Array<unknown>) {
    const {postHooks: hookMap} = this.state;
    return this.exec(hookMap, hookName, args);
  }

  async execPostSync(hookName: string, args: Array<unknown>) {
    const {postHooks: hookMap} = this.state;
    return this.execSync(hookMap, hookName, args);
  }

  async execManyPost(hookNames: Array<string>, args: Array<unknown>) {
    const {postHooks: hookMap} = this.state;
    return await this.execMany(hookMap, hookNames, args);
  }

  async execEachPost(hookName: string, arrayOfargs: Array<Array<unknown>>) {
    const {postHooks: hookMap} = this.state;
    return await this.execEach(hookMap, hookName, arrayOfargs);
  }
}