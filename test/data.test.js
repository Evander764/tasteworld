const assert = require("node:assert/strict");
const test = require("node:test");

const Core = require("../docs/core.js");

function loadRecipes() {
  global.window = {};
  delete require.cache[require.resolve("../docs/recipes.js")];
  require("../docs/recipes.js");
  return global.window.RECIPES;
}

test("recipe data loads and passes structural validation", () => {
  const recipes = loadRecipes();
  assert.ok(Array.isArray(recipes));
  assert.ok(recipes.length >= 116);

  const validation = Core.validateRecipes(recipes);
  assert.deepEqual(validation.errors, []);
  assert.equal(validation.ok, true);
});

test("recipe ids are unique and nutrition values are finite", () => {
  const recipes = loadRecipes();
  const ids = recipes.map((recipe) => recipe.id);

  assert.equal(new Set(ids).size, ids.length);
  for (const recipe of recipes) {
    for (const key of Core.nutritionKeys) {
      assert.equal(Number.isFinite(recipe.nutrition[key]), true, `${recipe.id} nutrition.${key}`);
    }
  }
});

test("beginner guide recipes expose complete guide sections", () => {
  const recipes = loadRecipes();
  const beginnerRecipes = recipes.filter((recipe) => recipe.beginnerGuide);

  assert.ok(beginnerRecipes.length >= 22);
  for (const recipe of beginnerRecipes) {
    const guide = recipe.beginnerGuide;
    assert.ok(Array.isArray(guide.prepChecklist), `${recipe.id} prepChecklist`);
    assert.ok(Array.isArray(guide.toolChecklist), `${recipe.id} toolChecklist`);
    assert.ok(Array.isArray(guide.detailedSteps), `${recipe.id} detailedSteps`);
    assert.ok(guide.detailedSteps.length > 0, `${recipe.id} detailedSteps length`);
    assert.equal(typeof guide.donenessCheck, "string", `${recipe.id} donenessCheck`);
    assert.ok(Array.isArray(guide.commonMistakes), `${recipe.id} commonMistakes`);
    assert.ok(Array.isArray(guide.rescueTips), `${recipe.id} rescueTips`);
  }
});

test("starter dishes include useful avoid ingredient metadata", () => {
  const recipes = loadRecipes();
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));

  assert.deepEqual(byId.get("boiled-corn").avoidIngredients, ["玉米"]);
  assert.deepEqual(byId.get("blanched-greens").avoidIngredients, ["青菜"]);
  assert.deepEqual(byId.get("apple-snow-pear-soup").avoidIngredients, ["苹果", "雪梨"]);
});
