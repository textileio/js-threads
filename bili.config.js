const path = require("path");

module.exports = {
  input: "./src/index.ts",
  output: {
    moduleName: "ThreadDB",
    minify: true,
    format: ["umd", "esm", "commonjs"],
    dir: "./dist"
  },
  plugins: {
    typescript2: {}
  }
};

