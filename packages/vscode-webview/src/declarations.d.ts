declare module '*.svg' {
  const content: string;
  // biome-ignore lint/style/noDefaultExport: Declared in webpack.base.ts, which requires a default export for asset modules
  export default content;
}
