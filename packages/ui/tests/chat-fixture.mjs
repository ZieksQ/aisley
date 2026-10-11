// Run from the repository root; CSS comes from the actual consumer.
// Transpiles actual React/UI code; transport and the outer brand bar are synthetic.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";

const root = process.cwd();
const require = createRequire(resolve(root, "src/webapp/package.json"));
const ts = require("typescript");
const base = resolve(root, "packages/ui/src/chat");
const artifacts = resolve(root, "node_modules/.cache/messages-ui");
mkdirSync(artifacts, { recursive: true });
function compile(path) {
  return ts.transpileModule(readFileSync(path, "utf8"), {
    fileName: path,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    },
  }).outputText;
}
const modules = {
  "next/link": 'exports.__esModule = true; exports.default = props => require("react").createElement("a", props, props.children);',
  shell: compile(resolve(root, "src/webapp/src/components/messages/message-page-shell.tsx")),
  compatibility: compile(resolve(root, "packages/chat-ui/src/index.ts")),
  fixture: compile(resolve(root, "packages/ui/tests/chat-fixture.tsx")),
};
for (const file of readdirSync(base)) {
  if (/\.tsx?$/.test(file)) modules[`./${file.replace(/\.tsx?$/, "")}`] = compile(resolve(base, file));
}
const dependencyRequire = createRequire(require.resolve("react-dom/client"));
for (const [name, file] of [
  ["react", "react.production.js"], ["react/jsx-runtime", "react-jsx-runtime.production.js"],
  ["react-dom", "react-dom.production.js"], ["react-dom/client", "react-dom-client.production.js"],
  ["scheduler", "scheduler.production.js"],
]) {
  const packageName = name.split("/")[0];
  modules[name] = readFileSync(resolve(dirname(dependencyRequire.resolve(`${packageName}/package.json`)), "cjs", file), "utf8");
}
for (const [name, source] of Object.entries(modules)) {
  try { new Function("require", "module", "exports", source); }
  catch (error) { throw new Error(`${name}: ${error.message}`); }
}
const script = `
const process = { env: { NODE_ENV: "production" } };
const sources = ${JSON.stringify(modules)};
const cache = {};
function require(name) {
  if (name === "@aisley/ui/chat") name = "./index";
  if (cache[name]) return cache[name].exports;
  if (!sources[name]) throw new Error("Missing module: " + name);
  const module = { exports: {} };
  cache[name] = module;
  new Function("require", "module", "exports", sources[name])(require, module, module.exports);
  return module.exports;
}
require("fixture");
`;
let css;
if (process.env.FIXTURE_CSS) css = readFileSync(process.env.FIXTURE_CSS, "utf8");
else {
  const tailwind = require("@tailwindcss/postcss");
  const postcss = createRequire(require.resolve("@tailwindcss/postcss"))("postcss");
  const filename = resolve(root, "src/webapp/src/app/globals.css");
  const result = await postcss([tailwind()]).process(readFileSync(filename, "utf8"), { from: filename });
  css = result.css;
  writeFileSync(resolve(artifacts, "candidate.css"), css);
}
writeFileSync(resolve(artifacts, "fixture.html"), `<!doctype html><html lang="en" data-fixture-role="${process.env.FIXTURE_ROLE ?? "customer"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${script.replaceAll("</script", "<\\/script")}</script></body></html>`);
