// mod.ts
import { win32, posix } from 'https://deno.land/std@0.193.0/path/mod.ts'

export { win32, posix }

export const {
  basename,
  delimiter,
  dirname,
  extname,
  format,
  fromFileUrl,
  isAbsolute,
  join,
  normalize,
  parse,
  relative,
  resolve,
  sep,
  toFileUrl,
  toNamespacedPath
} = posix
