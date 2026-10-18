// react-dom ships a runtime 'server.browser' build (exports renderToReadableStream,
// used by app/entry.server.tsx on Node), but @types/react-dom doesn't declare that
// subpath. Reuse the 'react-dom/server' types so it typechecks.
declare module 'react-dom/server.browser' {
  export * from 'react-dom/server';
}
