const path = require("path");

module.exports = {
  input: "./src/index.ts",
  output: {
    moduleName: "ThreadDB",
    minify: true,
    format: ["esm", "cjs", "umd"],
    dir: "./dist"
  },
  plugins: {
    typescript2: {}
  }
};

