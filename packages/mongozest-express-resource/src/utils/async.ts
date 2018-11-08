export const asyncHandler = (wrappedFunction: Function) =>
  function asyncWrap(...args: any[]) {
    const next = args[args.length - 1];
    return new Promise(function(resolve) {
      resolve(wrappedFunction(...args));
    }).catch(next);
  };
