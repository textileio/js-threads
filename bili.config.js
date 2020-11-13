const path = require("path");

module.exports = {
  input: "./src/index.ts",
  output: {
    moduleName: "ThreadDB",
    minify: true,
    format: ["esm", "cjs"],
    dir: "./dist"
  },
  plugins: {
    typescript2: {}
  }
};

