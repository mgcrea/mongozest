export type HookCallback = (...args: any[]) => void | Promise<void>;
export type HookMap<TName extends string> = Map<TName, HookCallback[]>;
export type AnyArgs = unknown[];

export default class Hooks<TName extends string = string> {
  state: {preHooks: HookMap<TName>; postHooks: HookMap<TName>} = {
    preHooks: new Map(),
    postHooks: new Map()
  };

  register(hookMap: HookMap<TName>, hookName: TName, callback: HookCallback): Hooks {
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

  pre(hookName: TName, callback: HookCallback): Hooks {
    const {preHooks: hookMap} = this.state;
    return this.register(hookMap, hookName, callback);
  }

  post(hookName: TName, callback: HookCallback): Hooks {
    const {postHooks: hookMap} = this.state;
    return this.register(hookMap, hookName, callback);
  }

  hasPre(hookName: TName): boolean {
    const {preHooks: hookMap} = this.state;
    return hookMap.has(hookName);
  }

  hasPost(hookName: TName): boolean {
    const {postHooks: hookMap} = this.state;
    return hookMap.has(hookName);
  }

  async exec<T extends AnyArgs>(hookMap: HookMap<TName>, hookName: TName, args: T): Promise<unknown[]> {
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

  execSync<T extends AnyArgs>(hookMap: HookMap<TName>, hookName: TName, args: T): unknown[] {
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

  async execMany<T extends AnyArgs>(hookMap: HookMap<TName>, hookNames: TName[], args: T): Promise<unknown[]> {
    return await hookNames.reduce<Promise<unknown[]>>(async (promiseSoFar, hookName) => {
      const soFar = await promiseSoFar;
      const result = await this.exec(hookMap, hookName, args);
      return soFar.concat(result);
    }, Promise.resolve([]));
  }

  async execEach<T extends AnyArgs[]>(hookMap: HookMap<TName>, hookName: TName, arrayOfargs: T): Promise<unknown[]> {
    return await arrayOfargs.reduce<Promise<unknown[]>>(async (promiseSoFar, args) => {
      const soFar = await promiseSoFar;
      const result = await this.exec(hookMap, hookName, args);
      return soFar.concat(result);
    }, Promise.resolve([]));
  }

  async execPre<T extends AnyArgs>(hookName: TName, args: T): Promise<unknown[]> {
    const {preHooks: hookMap} = this.state;
    return this.exec<T>(hookMap, hookName, args);
  }

  execPreSync<T extends AnyArgs>(hookName: TName, args: T): unknown[] {
    const {preHooks: hookMap} = this.state;
    return this.execSync<T>(hookMap, hookName, args);
  }

  async execManyPre<T extends AnyArgs>(hookNames: TName[], args: T): Promise<unknown[]> {
    const {preHooks: hookMap} = this.state;
    return await this.execMany<T>(hookMap, hookNames, args);
  }

  async execEachPre<T extends AnyArgs[]>(hookName: TName, arrayOfargs: T): Promise<unknown[]> {
    const {preHooks: hookMap} = this.state;
    return await this.execEach<T>(hookMap, hookName, arrayOfargs);
  }

  async execPost<T extends AnyArgs>(hookName: TName, args: T): Promise<unknown[]> {
    const {postHooks: hookMap} = this.state;
    return this.exec<T>(hookMap, hookName, args);
  }

  execPostSync<T extends AnyArgs>(hookName: TName, args: T): unknown[] {
    const {postHooks: hookMap} = this.state;
    return this.execSync<T>(hookMap, hookName, args);
  }

  async execManyPost<T extends AnyArgs>(hookNames: TName[], args: T): Promise<unknown[]> {
    const {postHooks: hookMap} = this.state;
    return await this.execMany<T>(hookMap, hookNames, args);
  }

  async execEachPost<T extends AnyArgs[]>(hookName: TName, arrayOfargs: T): Promise<unknown[]> {
    const {postHooks: hookMap} = this.state;
    return await this.execEach<T>(hookMap, hookName, arrayOfargs);
  }
}
