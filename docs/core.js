(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.TasteworldCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const initialVisibleCount = 12;
  const loadMoreCount = 12;

  const memberGoals = ["普通吃饭", "减脂", "增肌", "清淡", "控碳水"];
  const appetiteWeights = { 少: 0.8, 正常: 1, 多: 1.25 };
  const targetByGoal = {
    普通吃饭: { caloriesKcal: 620, proteinG: 25, carbsG: 60, fiberG: 5 },
    减脂: { caloriesKcal: 520, proteinG: 32, carbsG: 45, fiberG: 6 },
    增肌: { caloriesKcal: 760, proteinG: 38, carbsG: 85, fiberG: 6 },
    清淡: { caloriesKcal: 560, proteinG: 25, carbsG: 55, fiberG: 6 },
    控碳水: { caloriesKcal: 560, proteinG: 30, carbsG: 38, fiberG: 6 }
  };
  const nutritionKeys = ["caloriesKcal", "proteinG", "fatG", "carbsG", "fiberG", "sodiumMg"];

  const durationBuckets = [
    { label: "15 分钟内", match: (recipe) => recipe.time <= 15 },
    { label: "30 分钟内", match: (recipe) => recipe.time <= 30 },
    { label: "1 小时内", match: (recipe) => recipe.time <= 60 },
    { label: "慢炖慢煮", match: (recipe) => recipe.time > 60 }
  ];

  const filterMeta = [
    ["category", "分类", "category"],
    ["cuisine", "菜系", "cuisine"],
    ["mealType", "餐次", "meal"],
    ["tags", "标签", "tag"],
    ["duration", "烹饪时长", "time"],
    ["difficulty", "难度", "difficulty"],
    ["fitnessGoals", "健身目标", "fitness"],
    ["macroFocus", "营养重点", "macro"],
    ["allergens", "忌口/过敏", "avoid"]
  ];

  const fitnessPresets = {
    cut: { fitnessGoals: ["减脂"], macroFocus: ["高蛋白"], mealPrep: false },
    bulk: { fitnessGoals: ["增肌"], macroFocus: ["高碳水"], mealPrep: false },
    recovery: { fitnessGoals: ["训练后"], macroFocus: ["高蛋白"], mealPrep: false },
    prep: { fitnessGoals: [], macroFocus: [], mealPrep: true },
    beginner: { fitnessGoals: [], macroFocus: [], tags: ["零基础"], mealPrep: false }
  };

  const starterPresets = {
    zero: {
      label: "完全不会做饭",
      summary: "零基础入门",
      match: (recipe) => (recipe.tags || []).includes("零基础")
    },
    quick: {
      label: "10 分钟先吃上",
      summary: "10 分钟内",
      match: (recipe) => recipe.time <= 10
    },
    guide: {
      label: "按新手步骤做",
      summary: "有新手模式",
      match: (recipe) => Boolean(recipe.beginnerGuide)
    }
  };

  const filterKeys = filterMeta.map(([key]) => key);

  const requiredRecipeFields = [
    "id",
    "name",
    "description",
    "category",
    "cuisine",
    "mealType",
    "tags",
    "mainIngredients",
    "ingredients",
    "avoidIngredients",
    "allergens",
    "time",
    "difficulty",
    "cost",
    "servings",
    "tools",
    "spiceLevel",
    "steps",
    "tips",
    "recommendReason",
    "nutrition"
  ];

  function createInitialFilterState() {
    return {
      keyword: "",
      category: new Set(),
      cuisine: new Set(),
      mealType: new Set(),
      tags: new Set(),
      duration: new Set(),
      difficulty: new Set(),
      fitnessGoals: new Set(),
      macroFocus: new Set(),
      allergens: new Set(),
      mealPrep: false,
      starter: "",
      visibleCount: initialVisibleCount
    };
  }

  function createDefaultPlannerState() {
    return {
      members: [
        { id: "member-1", name: "我", appetite: "正常", goal: "普通吃饭", avoids: [] },
        { id: "member-2", name: "家人", appetite: "正常", goal: "普通吃饭", avoids: [] }
      ],
      menuIds: [],
      result: null
    };
  }

  function uniqueValues(recipes, key) {
    return Array.from(
      new Set(
        recipes.flatMap((recipe) => {
          const value = recipe[key];
          return Array.isArray(value) ? value : [value].filter(Boolean);
        })
      )
    ).sort((a, b) => String(a).localeCompare(String(b), "zh-CN"));
  }

  function getAllergenValues(recipes) {
    const values = new Set();
    recipes.forEach((recipe) => {
      [...(recipe.allergens || []), ...(recipe.avoidIngredients || [])].forEach((item) => {
        if (item) {
          values.add(item);
        }
      });
    });
    return Array.from(values).sort((a, b) => String(a).localeCompare(String(b), "zh-CN"));
  }

  function splitAvoidText(value) {
    return String(value || "")
      .split(/[、,，\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function formatAvoids(items) {
    return (items || []).join("、");
  }

  function getRecipeSearchableText(recipe) {
    return [
      ...(recipe.allergens || []),
      ...(recipe.avoidIngredients || []),
      ...(recipe.mainIngredients || []),
      ...(recipe.ingredients || [])
    ].join(" ");
  }

  function getRecipeConflict(recipe, member) {
    const searchable = getRecipeSearchableText(recipe);
    const blocked = (member.avoids || []).find((item) => item && searchable.includes(item));
    return blocked || "";
  }

  function canMemberEat(recipe, member) {
    return !getRecipeConflict(recipe, member);
  }

  function getAverageCookability(recipe) {
    const values = Object.values(recipe.cookability || {});
    if (!values.length) {
      return 3;
    }
    return values.reduce((total, item) => total + Number(item || 0), 0) / values.length;
  }

  function getCookabilityText(recipe) {
    const score = getAverageCookability(recipe).toFixed(1);
    const tools = (recipe.tools || []).slice(0, 2).join(" / ") || "常见工具";
    const recovery = (recipe.cookability || {}).failureTolerance >= 4 ? "失败可补救" : "按步骤更稳";
    const guide = recipe.beginnerGuide ? " · 有新手模式" : "";
    return `${recipe.time} 分钟 · ${tools} · ${recipe.difficulty} · 可做度 ${score}/5 · ${recovery}${guide}`;
  }

  function addNutrition(target, nutrition, multiplier) {
    nutritionKeys.forEach((key) => {
      target[key] = (target[key] || 0) + (nutrition[key] || 0) * multiplier;
    });
  }

  function emptyNutrition() {
    return nutritionKeys.reduce((result, key) => {
      result[key] = 0;
      return result;
    }, {});
  }

  function roundNutrition(value) {
    return Math.round(Number(value || 0));
  }

  function getFilterValues(recipes, key) {
    if (key === "duration") {
      return durationBuckets.map((bucket) => bucket.label);
    }
    if (key === "allergens") {
      return getAllergenValues(recipes);
    }
    return uniqueValues(recipes, key);
  }

  function getSelectedCount(state) {
    return filterKeys.reduce((total, key) => total + state[key].size, 0) + (state.mealPrep ? 1 : 0) + (state.starter ? 1 : 0);
  }

  function matchesScalar(state, recipe, key) {
    if (!state[key].size) {
      return true;
    }
    return state[key].has(recipe[key]);
  }

  function matchesArray(state, recipe, key) {
    if (!state[key].size) {
      return true;
    }
    const values = recipe[key] || [];
    return Array.from(state[key]).every((item) => values.includes(item));
  }

  function matchesDuration(state, recipe) {
    if (!state.duration.size) {
      return true;
    }
    return Array.from(state.duration).some((label) => {
      const bucket = durationBuckets.find((item) => item.label === label);
      return bucket ? bucket.match(recipe) : true;
    });
  }

  function hasBlockedAllergen(state, recipe) {
    if (!state.allergens.size) {
      return false;
    }
    return Array.from(state.allergens).some((blocked) => getRecipeSearchableText(recipe).includes(blocked));
  }

  function matchesKeyword(state, recipe) {
    const keyword = state.keyword.trim().toLowerCase();
    if (!keyword) {
      return true;
    }

    return [
      recipe.name,
      recipe.description,
      recipe.category,
      recipe.cuisine,
      recipe.difficulty,
      recipe.cost,
      recipe.tips,
      recipe.recommendReason,
      ...(recipe.mealType || []),
      ...(recipe.tags || []),
      ...(recipe.nutritionTags || []),
      ...(recipe.fitnessGoals || []),
      ...(recipe.macroFocus || []),
      ...(recipe.needScenes || []),
      ...(recipe.mealRoles || []),
      ...(recipe.mainIngredients || []),
      ...(recipe.ingredients || []),
      ...(recipe.steps || []),
      ...(recipe.tools || [])
    ]
      .join(" ")
      .toLowerCase()
      .includes(keyword);
  }

  function matchesStarter(state, recipe) {
    if (!state.starter) {
      return true;
    }
    const preset = starterPresets[state.starter];
    return preset ? preset.match(recipe) : true;
  }

  function getStarterScore(state, recipe) {
    const tags = recipe.tags || [];
    const cookability = recipe.cookability || {};
    let score = 0;

    if (state.starter === "zero") {
      score += tags.includes("零基础") ? 45 : 0;
      score += tags.includes("新手友好") ? 18 : 0;
      score += tags.includes("懒人") ? 12 : 0;
      score += recipe.beginnerGuide ? 16 : 0;
    }

    if (state.starter === "quick") {
      score += recipe.time <= 10 ? 42 : 0;
      score += recipe.time <= 6 ? 8 : 0;
      score += tags.includes("快手") ? 14 : 0;
      score += tags.includes("懒人") ? 10 : 0;
    }

    if (state.starter === "guide") {
      score += recipe.beginnerGuide ? 50 : 0;
      score += tags.includes("新手友好") ? 10 : 0;
    }

    score += recipe.difficulty === "简单" ? 16 : 0;
    score += Number(cookability.skillEase || 0) * 5;
    score += Number(cookability.failureTolerance || 0) * 4;
    score += Number(cookability.toolEase || 0) * 3;
    score += Number(cookability.ingredientEase || 0) * 2;
    score -= Number(recipe.time || 0) * 0.45;
    return score;
  }

  function sortFilteredRecipes(state, items) {
    if (!state.starter) {
      return items;
    }
    return items
      .map((recipe, index) => ({ recipe, index, score: getStarterScore(state, recipe) }))
      .sort((a, b) => b.score - a.score || a.recipe.time - b.recipe.time || a.index - b.index)
      .map((item) => item.recipe);
  }

  function getFilteredRecipes(recipes, state) {
    const filtered = recipes
      .filter((recipe) => !hasBlockedAllergen(state, recipe))
      .filter((recipe) => matchesStarter(state, recipe))
      .filter((recipe) => matchesScalar(state, recipe, "category"))
      .filter((recipe) => matchesScalar(state, recipe, "cuisine"))
      .filter((recipe) => matchesArray(state, recipe, "mealType"))
      .filter((recipe) => matchesArray(state, recipe, "tags"))
      .filter((recipe) => matchesDuration(state, recipe))
      .filter((recipe) => matchesScalar(state, recipe, "difficulty"))
      .filter((recipe) => matchesArray(state, recipe, "fitnessGoals"))
      .filter((recipe) => matchesArray(state, recipe, "macroFocus"))
      .filter((recipe) => !state.mealPrep || recipe.mealPrepFriendly)
      .filter((recipe) => matchesKeyword(state, recipe));
    return sortFilteredRecipes(state, filtered);
  }

  function getActiveSummary(state) {
    const active = [];
    filterMeta.forEach(([key, title]) => {
      if (state[key].size) {
        active.push(`${title}: ${Array.from(state[key]).join(" / ")}`);
      }
    });
    if (state.keyword.trim()) {
      active.unshift(`关键词: ${state.keyword.trim()}`);
    }
    if (state.starter && starterPresets[state.starter]) {
      active.unshift(`新手入口: ${starterPresets[state.starter].summary}`);
    }
    if (state.mealPrep) {
      active.push("备餐: 只看适合备餐");
    }
    return active.length ? active.join(" · ") : "未选择筛选条件";
  }

  function getAllergenText(recipe) {
    return recipe.allergens && recipe.allergens.length ? recipe.allergens.join(" / ") : "无常见过敏源";
  }

  function pickFeaturedRecipes(recipes) {
    const rules = [
      (recipe) => recipe.tags.includes("快手"),
      (recipe) => recipe.nutritionTags.includes("清淡") || recipe.tags.includes("清淡"),
      (recipe) => recipe.nutritionTags.includes("高蛋白") || recipe.tags.includes("高蛋白")
    ];
    const picked = [];
    rules.forEach((rule) => {
      const match = recipes.find((recipe) => rule(recipe) && !picked.includes(recipe));
      if (match) {
        picked.push(match);
      }
    });
    return picked.length === 3 ? picked : recipes.slice(0, 3);
  }

  function getMemberName(member, index) {
    return member.name.trim() || `成员 ${index + 1}`;
  }

  function getDesiredSlots(memberCount) {
    return memberCount >= 4 ? ["protein", "vegetable", "stapleOrSoup", "support"] : ["protein", "vegetable", "stapleOrSoup"];
  }

  function slotName(slot) {
    return {
      protein: "高蛋白/荤菜",
      vegetable: "素菜",
      stapleOrSoup: "主食/汤",
      support: "补充搭配"
    }[slot];
  }

  function recipeMatchesSlot(recipe, slot) {
    const roles = recipe.mealRoles || [];
    if (slot === "protein") {
      return roles.includes("荤菜") || roles.includes("高蛋白补充") || (recipe.macroFocus || []).includes("高蛋白");
    }
    if (slot === "vegetable") {
      return roles.includes("素菜") || recipe.category === "素菜";
    }
    if (slot === "stapleOrSoup") {
      return roles.includes("主食") || roles.includes("汤");
    }
    return roles.includes("汤") || roles.includes("素菜") || roles.includes("轻食") || roles.includes("高蛋白补充");
  }

  function getEligibleMembers(recipe, members) {
    return members.filter((member) => canMemberEat(recipe, member));
  }

  function scoreGoalFit(recipe, member) {
    const macro = recipe.macroFocus || [];
    const nutrition = recipe.nutrition || {};
    if (member.goal === "减脂") {
      return (macro.includes("高蛋白") ? 8 : 0) + (macro.includes("低脂") || macro.includes("低油") ? 6 : 0) + (nutrition.caloriesKcal <= 430 ? 4 : 0);
    }
    if (member.goal === "增肌") {
      return (macro.includes("高蛋白") ? 8 : 0) + (macro.includes("高碳水") ? 6 : 0) + (nutrition.caloriesKcal >= 520 ? 4 : 0);
    }
    if (member.goal === "清淡") {
      return (macro.includes("低油") ? 8 : 0) + ((recipe.mealRoles || []).includes("汤") ? 4 : 0) + (recipe.spiceLevel <= 1 ? 3 : 0);
    }
    if (member.goal === "控碳水") {
      return (macro.includes("控碳水") ? 8 : 0) + (nutrition.carbsG <= 35 ? 5 : 0);
    }
    return (macro.includes("高饱腹") ? 4 : 0) + (recipe.time <= 30 ? 2 : 0);
  }

  function scoreRecipeForSlot(recipe, slot, selectedIds, members) {
    if (selectedIds.has(recipe.id) || !recipeMatchesSlot(recipe, slot)) {
      return -Infinity;
    }
    const eligible = getEligibleMembers(recipe, members);
    if (!eligible.length) {
      return -Infinity;
    }

    const nutrition = recipe.nutrition || {};
    const roles = recipe.mealRoles || [];
    const slotScore =
      slot === "protein"
        ? nutrition.proteinG * 2 + (roles.includes("荤菜") ? 16 : 0)
        : slot === "vegetable"
          ? nutrition.fiberG * 6 + (roles.includes("素菜") ? 20 : 0) - nutrition.caloriesKcal / 80
          : slot === "stapleOrSoup"
            ? nutrition.carbsG * 0.35 + (roles.includes("主食") ? 12 : 0) + (roles.includes("汤") ? 10 : 0)
            : nutrition.proteinG + nutrition.fiberG * 2;
    const goalScore = eligible.reduce((total, member) => total + scoreGoalFit(recipe, member), 0);
    const roleScore = slot === "support" ? 8 : 14;
    return eligible.length * 35 + goalScore + slotScore + roleScore + getAverageCookability(recipe) * 5 + Math.max(0, 45 - recipe.time) / 3;
  }

  function pickRecipeForSlot(recipes, members, slot, selectedIds) {
    return recipes
      .map((recipe) => ({ recipe, score: scoreRecipeForSlot(recipe, slot, selectedIds, members) }))
      .filter((item) => Number.isFinite(item.score))
      .sort((a, b) => b.score - a.score)[0]?.recipe;
  }

  function makeFailure(message, reasons) {
    return { ok: false, message, reasons: reasons || [] };
  }

  function calculateMeal(menuItems, members) {
    const totalsByMember = members.map(() => emptyNutrition());
    const safeCounts = members.map(() => 0);
    const allocations = menuItems.map((item) => {
      const eligible = members
        .map((member, index) => ({ member, index, conflict: getRecipeConflict(item.recipe, member), weight: appetiteWeights[member.appetite] || 1 }))
        .filter((entry) => !entry.conflict);
      const totalWeight = eligible.reduce((total, entry) => total + entry.weight, 0);
      const people = members.map((member, index) => {
        const eligibleEntry = eligible.find((entry) => entry.index === index);
        const amount = eligibleEntry && totalWeight ? (item.recipe.servings || 1) * eligibleEntry.weight / totalWeight : 0;
        if (amount > 0) {
          safeCounts[index] += 1;
          addNutrition(totalsByMember[index], item.recipe.nutrition || {}, amount);
        }
        return {
          name: getMemberName(member, index),
          amount,
          conflict: eligibleEntry ? "" : getRecipeConflict(item.recipe, member) || "忌口冲突"
        };
      });
      return { ...item, people };
    });

    return { allocations, totalsByMember, safeCounts };
  }

  function getMemberTarget(member) {
    const weight = appetiteWeights[member.appetite] || 1;
    const base = targetByGoal[member.goal] || targetByGoal["普通吃饭"];
    return {
      caloriesKcal: base.caloriesKcal * weight,
      proteinG: base.proteinG * weight,
      carbsG: base.carbsG * weight,
      fiberG: base.fiberG * weight
    };
  }

  function evaluateNutrition(member, total) {
    const target = getMemberTarget(member);
    const notes = [];
    notes.push(total.proteinG >= target.proteinG ? "蛋白基本够" : "蛋白偏低，优先换高蛋白菜");
    notes.push(total.fiberG >= target.fiberG ? "蔬菜纤维够" : "蔬菜偏少，建议补素菜或汤");
    if (member.goal === "控碳水") {
      notes.push(total.carbsG <= target.carbsG ? "碳水可控" : "碳水偏高，主食份量要少一些");
    } else {
      notes.push(total.carbsG >= target.carbsG * 0.6 ? "主食基本够" : "主食偏少，建议补主食");
    }
    if (total.caloriesKcal < target.caloriesKcal * 0.65) {
      notes.push("总量偏少");
    } else if (total.caloriesKcal > target.caloriesKcal * 1.35) {
      notes.push("总量偏高");
    } else {
      notes.push("总量适中");
    }
    return notes;
  }

  function buildMenuFromIds(recipes, members, ids) {
    return ids
      .map((id, index) => {
        const recipe = recipes.find((item) => item.id === id);
        if (!recipe) {
          return null;
        }
        return { recipe, slot: getDesiredSlots(members.length)[index] || "support" };
      })
      .filter(Boolean);
  }

  function createMealResult(members, items) {
    const meal = calculateMeal(items, members);
    return {
      ok: true,
      items,
      allocations: meal.allocations,
      members: members.map((member, index) => ({
        member,
        name: getMemberName(member, index),
        nutrition: meal.totalsByMember[index],
        safeCount: meal.safeCounts[index],
        notes: evaluateNutrition(member, meal.totalsByMember[index])
      }))
    };
  }

  function generateMenuItems(recipes, members) {
    const slots = getDesiredSlots(members.length);
    const selectedIds = new Set();
    const items = [];
    for (const slot of slots) {
      const recipe = pickRecipeForSlot(recipes, members, slot, selectedIds);
      if (!recipe) {
        return makeFailure(`缺少可用的${slotName(slot)}。`, ["请减少忌口，或先选择更多能覆盖该角色的菜谱。"]);
      }
      selectedIds.add(recipe.id);
      items.push({ recipe, slot });
    }

    let meal = calculateMeal(items, members);
    members.forEach((member, index) => {
      if (meal.safeCounts[index] >= 2 || items.length >= 4) {
        return;
      }
      const extra = recipes
        .filter((recipe) => !selectedIds.has(recipe.id) && canMemberEat(recipe, member))
        .map((recipe) => ({ recipe, score: scoreRecipeForSlot(recipe, "support", selectedIds, members) + scoreGoalFit(recipe, member) }))
        .filter((item) => Number.isFinite(item.score))
        .sort((a, b) => b.score - a.score)[0]?.recipe;
      if (extra) {
        selectedIds.add(extra.id);
        items.push({ recipe: extra, slot: "support" });
        meal = calculateMeal(items, members);
      }
    });

    const lacking = members
      .map((member, index) => ({ member, index, safeCount: meal.safeCounts[index] }))
      .filter((item) => item.safeCount < 2);
    if (lacking.length) {
      return makeFailure(
        "当前忌口组合下无法给所有人分配足够安全菜品。",
        lacking.map((item) => `${getMemberName(item.member, item.index)} 只有 ${item.safeCount} 道可吃菜，请减少忌口或增加可接受食材。`)
      );
    }

    return createMealResult(members, items);
  }

  function replaceMenuRecipe(recipes, members, currentItems, recipeId, slot) {
    const selectedIds = new Set(currentItems.map((item) => item.recipe.id).filter((id) => id !== recipeId));
    const replacement = recipes
      .map((recipe) => ({ recipe, score: scoreRecipeForSlot(recipe, slot, selectedIds, members) }))
      .filter((item) => item.recipe.id !== recipeId && Number.isFinite(item.score))
      .sort((a, b) => b.score - a.score)[0]?.recipe;
    if (!replacement) {
      return null;
    }
    return currentItems.map((item) => (item.recipe.id === recipeId ? { recipe: replacement, slot } : item));
  }

  function encodeValues(values) {
    return Array.from(values).join(",");
  }

  function encodePlannerMembers(members) {
    const payload = members.map((member) => ({
      name: member.name,
      appetite: member.appetite,
      goal: member.goal,
      avoids: member.avoids
    }));
    return encodeURIComponent(JSON.stringify(payload));
  }

  function isDefaultPlannerMembers(members) {
    if (!Array.isArray(members) || members.length !== 2) {
      return false;
    }
    return members.every((member, index) => {
      const defaultName = index === 0 ? "我" : "家人";
      return member.name === defaultName && member.appetite === "正常" && member.goal === "普通吃饭" && !(member.avoids || []).length;
    });
  }

  function decodePlannerMembers(raw) {
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (!Array.isArray(parsed) || !parsed.length) {
        return null;
      }
      return parsed.slice(0, 8).map((member, index) => ({
        id: `member-${index + 1}`,
        name: String(member.name || `成员 ${index + 1}`).slice(0, 12),
        appetite: appetiteWeights[member.appetite] ? member.appetite : "正常",
        goal: memberGoals.includes(member.goal) ? member.goal : "普通吃饭",
        avoids: Array.isArray(member.avoids) ? member.avoids.map((item) => String(item).trim()).filter(Boolean) : []
      }));
    } catch (error) {
      return null;
    }
  }

  function validateRecipes(recipes) {
    const errors = [];
    if (!Array.isArray(recipes)) {
      return { ok: false, errors: ["RECIPES must be an array"] };
    }

    const seenIds = new Set();
    recipes.forEach((recipe, index) => {
      const label = recipe && recipe.id ? recipe.id : `recipe-${index}`;
      if (!recipe || typeof recipe !== "object") {
        errors.push(`${label}: recipe must be an object`);
        return;
      }
      requiredRecipeFields.forEach((field) => {
        if (!(field in recipe)) {
          errors.push(`${label}: missing ${field}`);
        }
      });
      if (recipe.id) {
        if (seenIds.has(recipe.id)) {
          errors.push(`${label}: duplicate id`);
        }
        seenIds.add(recipe.id);
      }
      ["mealType", "tags", "mainIngredients", "ingredients", "avoidIngredients", "allergens", "tools", "steps"].forEach((field) => {
        if (!Array.isArray(recipe[field])) {
          errors.push(`${label}: ${field} must be an array`);
        }
      });
      nutritionKeys.forEach((field) => {
        if (!Number.isFinite(recipe.nutrition?.[field])) {
          errors.push(`${label}: nutrition.${field} must be a finite number`);
        }
      });
      if (recipe.beginnerGuide) {
        ["prepChecklist", "toolChecklist", "detailedSteps", "commonMistakes", "rescueTips"].forEach((field) => {
          if (!Array.isArray(recipe.beginnerGuide[field])) {
            errors.push(`${label}: beginnerGuide.${field} must be an array`);
          }
        });
        if (typeof recipe.beginnerGuide.donenessCheck !== "string") {
          errors.push(`${label}: beginnerGuide.donenessCheck must be a string`);
        }
      }
    });

    return { ok: errors.length === 0, errors };
  }

  return {
    initialVisibleCount,
    loadMoreCount,
    memberGoals,
    appetiteWeights,
    targetByGoal,
    nutritionKeys,
    durationBuckets,
    filterMeta,
    filterKeys,
    fitnessPresets,
    starterPresets,
    requiredRecipeFields,
    createInitialFilterState,
    createDefaultPlannerState,
    uniqueValues,
    getAllergenValues,
    splitAvoidText,
    formatAvoids,
    getRecipeSearchableText,
    getRecipeConflict,
    canMemberEat,
    getAverageCookability,
    getCookabilityText,
    addNutrition,
    emptyNutrition,
    roundNutrition,
    getFilterValues,
    getSelectedCount,
    matchesScalar,
    matchesArray,
    matchesDuration,
    hasBlockedAllergen,
    matchesKeyword,
    matchesStarter,
    getStarterScore,
    sortFilteredRecipes,
    getFilteredRecipes,
    getActiveSummary,
    getAllergenText,
    pickFeaturedRecipes,
    getMemberName,
    getDesiredSlots,
    slotName,
    recipeMatchesSlot,
    getEligibleMembers,
    scoreGoalFit,
    scoreRecipeForSlot,
    pickRecipeForSlot,
    makeFailure,
    calculateMeal,
    getMemberTarget,
    evaluateNutrition,
    buildMenuFromIds,
    createMealResult,
    generateMenuItems,
    replaceMenuRecipe,
    encodeValues,
    encodePlannerMembers,
    isDefaultPlannerMembers,
    decodePlannerMembers,
    validateRecipes
  };
});
