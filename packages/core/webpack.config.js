// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path')

const extensions = ['.tsx', '.ts', '.js', 'json']

module.exports = {
  entry: './src/index.ts',
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.ts?$/,
        include: path.resolve(__dirname, 'src'),
        loader: 'ts-loader?configFile=../../../tsconfig.webpack.json',
      },
    ],
  },
  resolve: {
    modules: ['node_modules'],
    extensions,
    symlinks: true,
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    library: 'threads',
    libraryTarget: 'var',
  },
  optimization: {
    splitChunks: {
      name: true,
      chunks: 'all',
    },
  },
}
