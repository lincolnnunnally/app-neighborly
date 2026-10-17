// Lets `node --experimental-strip-types` load the app's extensionless TS imports.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (/^\.{1,2}\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      return next(`${specifier}.ts`, context);
    }
    throw err;
  }
}
