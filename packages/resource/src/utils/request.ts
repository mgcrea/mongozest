export const parseBodyAsUpdate = (body: { [s: string]: any }) =>
  Object.keys(body).reduce(
    (soFar: { [s: string]: any }, key: string) => {
      if (!key.startsWith('$')) {
        soFar.$set[key] = body[key];
      } else {
        soFar[key] = body[key];
      }
      return soFar;
    },
    { $set: {} }
  );

export const asyncHandler = (wrappedFunction: Function) =>
  function asyncWrap(...args: any[]) {
    const next = args[args.length - 1];
    try {
      Promise.resolve(wrappedFunction(...args)).catch(next);
    } catch (err) {
      next(err);
    }
  };
