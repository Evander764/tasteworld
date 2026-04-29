const assert = require("node:assert/strict");
const test = require("node:test");

const Core = require("../docs/core.js");

function makeElement() {
  return {
    hidden: false,
    value: "",
    textContent: "",
    innerHTML: "",
    dataset: {},
    style: {},
    classList: { add() {}, remove() {} },
    setAttribute() {},
    removeAttribute() {},
    addEventListener() {},
    scrollIntoView() {},
    showModal() {},
    close() {}
  };
}

test("browser app bootstraps with core and recipe globals", () => {
  const elements = new Map();
  global.window = {
    TasteworldCore: Core,
    location: { search: "", pathname: "/index.html", hash: "", href: "http://localhost:4173/" },
    history: { replaceState() {} },
    addEventListener() {},
    clearTimeout,
    setTimeout,
    isSecureContext: true
  };
  global.navigator = { clipboard: { writeText() {} } };
  global.document = {
    body: makeElement(),
    querySelector(selector) {
      if (!elements.has(selector)) {
        elements.set(selector, makeElement());
      }
      return elements.get(selector);
    },
    createElement() {
      return makeElement();
    },
    addEventListener() {},
    execCommand() {
      return true;
    }
  };

  delete require.cache[require.resolve("../docs/recipes.js")];
  delete require.cache[require.resolve("../docs/app.js")];
  require("../docs/recipes.js");
  require("../docs/app.js");

  assert.match(String(elements.get("#resultCount").textContent), /^\d+$/);
  assert.match(elements.get("#recipeGrid").innerHTML, /recipe-card/);
  assert.match(elements.get("#plannerMembers").innerHTML, /member-card/);
});
