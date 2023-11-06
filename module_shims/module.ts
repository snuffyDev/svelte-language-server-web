export default {
  createRequire,
};
export function createRequire(...args: any[]) {
  return require.apply(require, args);
}
