import babel from 'rollup-plugin-babel';

export default {
  entry: 'src/index.js',
  targets: [
    { dest: 'dist/structured-log-ai-sink.js', format: 'umd', moduleName: 'AiSink' },
    { dest: 'dist/structured-log-ai-sink.es6.js', format: 'es' }
  ],
  plugins: [babel({
    exclude: 'node_modules/**'
  })]
}
