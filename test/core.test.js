const assert = require("node:assert/strict");
const test = require("node:test");

const Core = require("../docs/core.js");

function loadRecipes() {
  global.window = {};
  delete require.cache[require.resolve("../docs/recipes.js")];
  require("../docs/recipes.js");
  return global.window.RECIPES;
}

function recipeById(recipes, id) {
  return recipes.find((recipe) => recipe.id === id);
}

const recipes = loadRecipes();

test("keyword search matches names, ingredients, steps, and tags", () => {
  const nameState = Core.createInitialFilterState();
  nameState.keyword = "番茄炒蛋";
  assert.equal(Core.getFilteredRecipes(recipes, nameState)[0].id, "tomato-egg");

  const ingredientState = Core.createInitialFilterState();
  ingredientState.keyword = "淀粉";
  assert.ok(Core.getFilteredRecipes(recipes, ingredientState).some((recipe) => recipe.ingredients.join(" ").includes("淀粉") || recipe.steps.join(" ").includes("淀粉")));

  const tagState = Core.createInitialFilterState();
  tagState.keyword = "零基础";
  assert.ok(Core.getFilteredRecipes(recipes, tagState).every((recipe) => (recipe.tags || []).includes("零基础") || (recipe.nutritionTags || []).includes("零基础")));
});

test("combined filters narrow recipes by category, cuisine, meal type, tag, duration, and difficulty", () => {
  const state = Core.createInitialFilterState();
  state.category.add("家常菜");
  state.cuisine.add("中式");
  state.mealType.add("晚餐");
  state.tags.add("快手");
  state.duration.add("30 分钟内");
  state.difficulty.add("简单");

  const filtered = Core.getFilteredRecipes(recipes, state);
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((recipe) => recipe.category === "家常菜"));
  assert.ok(filtered.every((recipe) => recipe.cuisine === "中式"));
  assert.ok(filtered.every((recipe) => recipe.mealType.includes("晚餐")));
  assert.ok(filtered.every((recipe) => recipe.tags.includes("快手")));
  assert.ok(filtered.every((recipe) => recipe.time <= 30));
  assert.ok(filtered.every((recipe) => recipe.difficulty === "简单"));
});

test("allergen filters strongly exclude blocked ingredients", () => {
  const state = Core.createInitialFilterState();
  state.allergens.add("鸡蛋");

  const filtered = Core.getFilteredRecipes(recipes, state);
  assert.equal(filtered.some((recipe) => recipe.id === "tomato-egg"), false);
  assert.ok(filtered.every((recipe) => !Core.hasBlockedAllergen(state, recipe)));
});

test("fitness and beginner presets map to expected recipe sets", () => {
  const fitnessState = Core.createInitialFilterState();
  Core.fitnessPresets.cut.fitnessGoals.forEach((value) => fitnessState.fitnessGoals.add(value));
  Core.fitnessPresets.cut.macroFocus.forEach((value) => fitnessState.macroFocus.add(value));
  const fitnessRecipes = Core.getFilteredRecipes(recipes, fitnessState);
  assert.ok(fitnessRecipes.length > 0);
  assert.ok(fitnessRecipes.every((recipe) => recipe.fitnessGoals.includes("减脂") && recipe.macroFocus.includes("高蛋白")));

  const beginnerState = Core.createInitialFilterState();
  Core.fitnessPresets.beginner.tags.forEach((value) => beginnerState.tags.add(value));
  const beginnerRecipes = Core.getFilteredRecipes(recipes, beginnerState);
  assert.ok(beginnerRecipes.length > 0);
  assert.ok(beginnerRecipes.every((recipe) => recipe.tags.includes("零基础")));
  assert.ok(beginnerRecipes.some((recipe) => recipe.id === "boiled-corn"));
  assert.ok(beginnerRecipes.some((recipe) => recipe.id === "blanched-greens"));
});

test("default planner generates a non-duplicated successful menu", () => {
  const members = Core.createDefaultPlannerState().members;
  const result = Core.generateMenuItems(recipes, members);

  assert.equal(result.ok, true);
  assert.ok(result.items.length >= 3);
  assert.equal(new Set(result.items.map((item) => item.recipe.id)).size, result.items.length);
  assert.ok(result.members.every((member) => member.safeCount >= 2));
});

test("member avoid rules affect meal allocation", () => {
  const tomatoEgg = recipeById(recipes, "tomato-egg");
  const members = [
    { id: "a", name: "甲", appetite: "正常", goal: "普通吃饭", avoids: ["鸡蛋"] },
    { id: "b", name: "乙", appetite: "正常", goal: "普通吃饭", avoids: [] }
  ];

  const meal = Core.calculateMeal([{ recipe: tomatoEgg, slot: "protein" }], members);
  assert.equal(meal.allocations[0].people[0].amount, 0);
  assert.equal(meal.allocations[0].people[0].conflict, "鸡蛋");
  assert.ok(meal.allocations[0].people[1].amount > 0);
});

test("planner reports a clear failure when all known avoid ingredients are blocked", () => {
  const members = Core.createDefaultPlannerState().members.map((member) => ({
    ...member,
    avoids: Core.getAllergenValues(recipes)
  }));
  const result = Core.generateMenuItems(recipes, members);

  assert.equal(result.ok, false);
  assert.match(result.message, /缺少可用|无法给所有人分配/);
  assert.ok(result.reasons.length > 0);
});

test("planner replacement keeps menu size and recipe ids unique", () => {
  const members = Core.createDefaultPlannerState().members;
  const result = Core.generateMenuItems(recipes, members);
  assert.equal(result.ok, true);

  const target = result.items[0];
  const nextItems = Core.replaceMenuRecipe(recipes, members, result.items, target.recipe.id, target.slot);
  assert.ok(Array.isArray(nextItems));
  assert.equal(nextItems.length, result.items.length);
  assert.notEqual(nextItems[0].recipe.id, target.recipe.id);
  assert.equal(new Set(nextItems.map((item) => item.recipe.id)).size, nextItems.length);

  const nextResult = Core.createMealResult(members, nextItems);
  assert.equal(nextResult.ok, true);
});

test("planner member URL payloads round-trip and invalid payloads are ignored", () => {
  const members = [
    { id: "member-1", name: "我", appetite: "少", goal: "减脂", avoids: ["鸡蛋", "海鲜"] },
    { id: "member-2", name: "家人", appetite: "多", goal: "增肌", avoids: ["猪肉"] }
  ];

  const decoded = Core.decodePlannerMembers(Core.encodePlannerMembers(members));
  assert.deepEqual(
    decoded.map(({ name, appetite, goal, avoids }) => ({ name, appetite, goal, avoids })),
    members.map(({ name, appetite, goal, avoids }) => ({ name, appetite, goal, avoids }))
  );
  assert.equal(Core.decodePlannerMembers("%E0%A4%A"), null);
});
