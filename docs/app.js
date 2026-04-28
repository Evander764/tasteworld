(function () {
  const recipes = Array.isArray(window.RECIPES) ? window.RECIPES : [];
  const initialVisibleCount = 12;
  const loadMoreCount = 12;
  const state = {
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
    visibleCount: initialVisibleCount
  };
  const plannerState = {
    members: [
      { id: "member-1", name: "我", appetite: "正常", goal: "普通吃饭", avoids: [] },
      { id: "member-2", name: "家人", appetite: "正常", goal: "普通吃饭", avoids: [] }
    ],
    menuIds: [],
    result: null
  };

  const filterGroups = document.querySelector("#filterGroups");
  const recipeGrid = document.querySelector("#recipeGrid");
  const featuredRecipes = document.querySelector("#featuredRecipes");
  const resultCount = document.querySelector("#resultCount");
  const activeSummary = document.querySelector("#activeSummary");
  const activeCountText = document.querySelector("#activeCountText");
  const activeCountBadge = document.querySelector("#activeCountBadge");
  const emptyState = document.querySelector("#emptyState");
  const loadMoreBar = document.querySelector("#loadMoreBar");
  const visibleCountText = document.querySelector("#visibleCountText");
  const loadMoreButton = document.querySelector("#loadMoreButton");
  const keywordInput = document.querySelector("#keywordInput");
  const dialog = document.querySelector("#recipeDialog");
  const dialogContent = document.querySelector("#dialogContent");
  const filterPanel = document.querySelector("#filterPanel");
  const filterBackdrop = document.querySelector("#filterBackdrop");
  const openFiltersButton = document.querySelector("#openFiltersButton");
  const closeFiltersButton = document.querySelector("#closeFiltersButton");
  const toast = document.querySelector("#toast");
  const plannerMembers = document.querySelector("#plannerMembers");
  const plannerResult = document.querySelector("#plannerResult");
  const addMemberButton = document.querySelector("#addMemberButton");
  const generateMealButton = document.querySelector("#generateMealButton");

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
    prep: { fitnessGoals: [], macroFocus: [], mealPrep: true }
  };

  const filterKeys = filterMeta.map(([key]) => key);

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function uniqueValues(key) {
    return Array.from(
      new Set(
        recipes.flatMap((recipe) => {
          const value = recipe[key];
          return Array.isArray(value) ? value : [value].filter(Boolean);
        })
      )
    ).sort((a, b) => String(a).localeCompare(String(b), "zh-CN"));
  }

  function getAllergenValues() {
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
    return `${recipe.time} 分钟 · ${tools} · 可做度 ${score}/5 · ${recovery}`;
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

  function getFilterValues(key) {
    if (key === "duration") {
      return durationBuckets.map((bucket) => bucket.label);
    }
    if (key === "allergens") {
      return getAllergenValues();
    }
    return uniqueValues(key);
  }

  function getSelectedCount() {
    return filterKeys.reduce((total, key) => total + state[key].size, 0) + (state.mealPrep ? 1 : 0);
  }

  function renderFilters() {
    filterGroups.innerHTML = filterMeta
      .map(([key, title]) => {
        const chips = getFilterValues(key)
          .map((item) => {
            const active = state[key].has(item) ? " is-active" : "";
            return `<button class="chip${active}" type="button" data-filter="${key}" data-value="${escapeHtml(item)}">${escapeHtml(item)}</button>`;
          })
          .join("");

        return `
          <section class="filter-group">
            <h3>${escapeHtml(title)}</h3>
            <div class="chip-list">${chips}</div>
          </section>
        `;
      })
      .join("");
  }

  function matchesScalar(recipe, key) {
    if (!state[key].size) {
      return true;
    }
    return state[key].has(recipe[key]);
  }

  function matchesArray(recipe, key) {
    if (!state[key].size) {
      return true;
    }
    const values = recipe[key] || [];
    return Array.from(state[key]).every((item) => values.includes(item));
  }

  function matchesDuration(recipe) {
    if (!state.duration.size) {
      return true;
    }
    return Array.from(state.duration).some((label) => {
      const bucket = durationBuckets.find((item) => item.label === label);
      return bucket ? bucket.match(recipe) : true;
    });
  }

  function hasBlockedAllergen(recipe) {
    if (!state.allergens.size) {
      return false;
    }

    const searchable = [
      ...(recipe.allergens || []),
      ...(recipe.avoidIngredients || []),
      ...(recipe.mainIngredients || []),
      ...(recipe.ingredients || [])
    ].join(" ");

    return Array.from(state.allergens).some((blocked) => searchable.includes(blocked));
  }

  function matchesKeyword(recipe) {
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

  function getFilteredRecipes() {
    return recipes
      .filter((recipe) => !hasBlockedAllergen(recipe))
      .filter((recipe) => matchesScalar(recipe, "category"))
      .filter((recipe) => matchesScalar(recipe, "cuisine"))
      .filter((recipe) => matchesArray(recipe, "mealType"))
      .filter((recipe) => matchesArray(recipe, "tags"))
      .filter((recipe) => matchesDuration(recipe))
      .filter((recipe) => matchesScalar(recipe, "difficulty"))
      .filter((recipe) => matchesArray(recipe, "fitnessGoals"))
      .filter((recipe) => matchesArray(recipe, "macroFocus"))
      .filter((recipe) => !state.mealPrep || recipe.mealPrepFriendly)
      .filter(matchesKeyword);
  }

  function getActiveSummary() {
    const active = [];
    filterMeta.forEach(([key, title]) => {
      if (state[key].size) {
        active.push(`${title}: ${Array.from(state[key]).join(" / ")}`);
      }
    });
    if (state.keyword.trim()) {
      active.unshift(`关键词: ${state.keyword.trim()}`);
    }
    if (state.mealPrep) {
      active.push("备餐: 只看适合备餐");
    }
    return active.length ? active.join(" · ") : "未选择筛选条件";
  }

  function getCardTone(index) {
    return ["tone-green", "tone-red", "tone-blue", "tone-gold", "tone-ink"][index % 5];
  }

  function getAllergenText(recipe) {
    return recipe.allergens && recipe.allergens.length ? recipe.allergens.join(" / ") : "无常见过敏源";
  }

  function renderRecipeCard(recipe, index, compact) {
    const fitnessBadges = [...(recipe.fitnessGoals || []), ...(recipe.macroFocus || [])].slice(0, 2);
    const roleBadges = (recipe.mealRoles || []).slice(0, 1);
    const tags = [recipe.category, ...roleBadges, ...fitnessBadges, `${recipe.time} 分钟`].filter(Boolean);
    const nutrition = recipe.nutrition || {};
    return `
      <article class="recipe-card ${compact ? "recipe-card-compact" : ""} ${getCardTone(index)}" data-id="${recipe.id}">
        <div class="recipe-visual" aria-hidden="true">
          <span>${escapeHtml(recipe.emoji || recipe.name.slice(0, 1))}</span>
        </div>
        <div class="recipe-body">
          <div class="recipe-topline">
            <span>${escapeHtml(recipe.cuisine)}</span>
            <span>${escapeHtml((recipe.mealType || []).join(" / "))}</span>
          </div>
          <h3>${escapeHtml(recipe.name)}</h3>
          <p>${escapeHtml(compact ? recipe.recommendReason : recipe.description)}</p>
          <p class="recipe-fit">${escapeHtml(getCookabilityText(recipe))}</p>
          <div class="recipe-tags">
            ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
          </div>
          <small>${escapeHtml(nutrition.caloriesKcal ? `约 ${nutrition.caloriesKcal} kcal/份 · ${getAllergenText(recipe)}` : getAllergenText(recipe))}</small>
        </div>
      </article>
    `;
  }

  function pickFeaturedRecipes() {
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

  function renderFeaturedRecipes() {
    featuredRecipes.innerHTML = pickFeaturedRecipes()
      .map((recipe, index) => renderRecipeCard(recipe, index + 1, true))
      .join("");
  }

  function getMemberName(member, index) {
    return member.name.trim() || `成员 ${index + 1}`;
  }

  function renderPlannerMembers() {
    if (!plannerMembers) {
      return;
    }

    plannerMembers.innerHTML = plannerState.members
      .map(
        (member, index) => `
          <article class="member-card">
            <div class="member-card-head">
              <strong>成员 ${index + 1}</strong>
              ${
                plannerState.members.length > 1
                  ? `<button class="icon-button" type="button" data-action="remove-member" data-member-index="${index}" aria-label="删除成员">x</button>`
                  : ""
              }
            </div>
            <label>
              <span>姓名</span>
              <input type="text" value="${escapeHtml(member.name)}" data-member-index="${index}" data-member-field="name" maxlength="12" />
            </label>
            <label>
              <span>食量</span>
              <select data-member-index="${index}" data-member-field="appetite">
                ${Object.keys(appetiteWeights)
                  .map((item) => `<option value="${escapeHtml(item)}" ${member.appetite === item ? "selected" : ""}>${escapeHtml(item)}</option>`)
                  .join("")}
              </select>
            </label>
            <label>
              <span>目标</span>
              <select data-member-index="${index}" data-member-field="goal">
                ${memberGoals
                  .map((item) => `<option value="${escapeHtml(item)}" ${member.goal === item ? "selected" : ""}>${escapeHtml(item)}</option>`)
                  .join("")}
              </select>
            </label>
            <label class="member-avoid-field">
              <span>忌口/过敏</span>
              <input type="text" value="${escapeHtml(formatAvoids(member.avoids))}" data-member-index="${index}" data-member-field="avoids" placeholder="如：鸡蛋、海鲜、猪肉" />
            </label>
          </article>
        `
      )
      .join("");
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

  function getEligibleMembers(recipe) {
    return plannerState.members.filter((member) => canMemberEat(recipe, member));
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

  function scoreRecipeForSlot(recipe, slot, selectedIds) {
    if (selectedIds.has(recipe.id) || !recipeMatchesSlot(recipe, slot)) {
      return -Infinity;
    }
    const eligible = getEligibleMembers(recipe);
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

  function pickRecipeForSlot(slot, selectedIds) {
    return recipes
      .map((recipe) => ({ recipe, score: scoreRecipeForSlot(recipe, slot, selectedIds) }))
      .filter((item) => Number.isFinite(item.score))
      .sort((a, b) => b.score - a.score)[0]?.recipe;
  }

  function makeFailure(message, reasons) {
    return { ok: false, message, reasons: reasons || [] };
  }

  function calculateMeal(menuItems) {
    const totalsByMember = plannerState.members.map(() => emptyNutrition());
    const safeCounts = plannerState.members.map(() => 0);
    const allocations = menuItems.map((item) => {
      const eligible = plannerState.members
        .map((member, index) => ({ member, index, conflict: getRecipeConflict(item.recipe, member), weight: appetiteWeights[member.appetite] || 1 }))
        .filter((entry) => !entry.conflict);
      const totalWeight = eligible.reduce((total, entry) => total + entry.weight, 0);
      const people = plannerState.members.map((member, index) => {
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

  function buildMenuFromIds(ids) {
    return ids
      .map((id, index) => {
        const recipe = recipes.find((item) => item.id === id);
        if (!recipe) {
          return null;
        }
        return { recipe, slot: getDesiredSlots(plannerState.members.length)[index] || "support" };
      })
      .filter(Boolean);
  }

  function generateMenuItems() {
    const slots = getDesiredSlots(plannerState.members.length);
    const selectedIds = new Set();
    const items = [];
    for (const slot of slots) {
      const recipe = pickRecipeForSlot(slot, selectedIds);
      if (!recipe) {
        return makeFailure(`缺少可用的${slotName(slot)}。`, ["请减少忌口，或先选择更多能覆盖该角色的菜谱。"]);
      }
      selectedIds.add(recipe.id);
      items.push({ recipe, slot });
    }

    let meal = calculateMeal(items);
    plannerState.members.forEach((member, index) => {
      if (meal.safeCounts[index] >= 2 || items.length >= 4) {
        return;
      }
      const extra = recipes
        .filter((recipe) => !selectedIds.has(recipe.id) && canMemberEat(recipe, member))
        .map((recipe) => ({ recipe, score: scoreRecipeForSlot(recipe, "support", selectedIds) + scoreGoalFit(recipe, member) }))
        .filter((item) => Number.isFinite(item.score))
        .sort((a, b) => b.score - a.score)[0]?.recipe;
      if (extra) {
        selectedIds.add(extra.id);
        items.push({ recipe: extra, slot: "support" });
        meal = calculateMeal(items);
      }
    });

    const lacking = plannerState.members
      .map((member, index) => ({ member, index, safeCount: meal.safeCounts[index] }))
      .filter((item) => item.safeCount < 2);
    if (lacking.length) {
      return makeFailure(
        "当前忌口组合下无法给所有人分配足够安全菜品。",
        lacking.map((item) => `${getMemberName(item.member, item.index)} 只有 ${item.safeCount} 道可吃菜，请减少忌口或增加可接受食材。`)
      );
    }

    return createMealResult(items);
  }

  function createMealResult(items) {
    const meal = calculateMeal(items);
    return {
      ok: true,
      items,
      allocations: meal.allocations,
      members: plannerState.members.map((member, index) => ({
        member,
        name: getMemberName(member, index),
        nutrition: meal.totalsByMember[index],
        safeCount: meal.safeCounts[index],
        notes: evaluateNutrition(member, meal.totalsByMember[index])
      }))
    };
  }

  function renderPlannerResult(result) {
    if (!plannerResult) {
      return;
    }
    if (!result) {
      plannerResult.innerHTML = `<strong>先填写一起吃饭的人</strong><span>每个人可以有不同忌口。生成后会显示谁能吃哪道菜、建议分多少、营养估算是否够。</span>`;
      return;
    }
    if (!result.ok) {
      plannerResult.innerHTML = `
        <div class="planner-empty">
          <strong>${escapeHtml(result.message)}</strong>
          ${(result.reasons || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
        </div>
      `;
      return;
    }

    plannerResult.innerHTML = `
      <div class="planner-summary">
        <strong>推荐 ${result.items.length} 道菜</strong>
        <span>按每份估算分配，营养数据不构成医学建议。</span>
      </div>
      <div class="planner-menu">
        ${result.allocations
          .map(
            (item) => `
              <article class="planner-dish">
                <div>
                  <small>${escapeHtml(slotName(item.slot))}</small>
                  <button class="link-button" type="button" data-action="open-planner-recipe" data-recipe-id="${escapeHtml(item.recipe.id)}">${escapeHtml(item.recipe.name)}</button>
                </div>
                <p>${escapeHtml(getCookabilityText(item.recipe))}</p>
                <div class="planner-allocation">
                  ${item.people
                    .map(
                      (person) => `
                        <span class="${person.amount > 0 ? "can-eat" : "cannot-eat"}">
                          ${escapeHtml(person.name)}：${person.amount > 0 ? `${person.amount.toFixed(1)} 份` : `不可吃（${person.conflict}）`}
                        </span>
                      `
                    )
                    .join("")}
                </div>
                <button class="ghost-button" type="button" data-action="replace-planner-recipe" data-recipe-id="${escapeHtml(item.recipe.id)}" data-slot="${escapeHtml(item.slot)}">换一道${escapeHtml(slotName(item.slot))}</button>
              </article>
            `
          )
          .join("")}
      </div>
      <div class="member-nutrition-list">
        ${result.members
          .map(
            (item) => `
              <article class="member-nutrition">
                <strong>${escapeHtml(item.name)} · 可吃 ${item.safeCount} 道</strong>
                <div class="nutrition-mini">
                  <span>${roundNutrition(item.nutrition.caloriesKcal)} kcal</span>
                  <span>蛋白 ${roundNutrition(item.nutrition.proteinG)}g</span>
                  <span>脂肪 ${roundNutrition(item.nutrition.fatG)}g</span>
                  <span>碳水 ${roundNutrition(item.nutrition.carbsG)}g</span>
                  <span>纤维 ${roundNutrition(item.nutrition.fiberG)}g</span>
                  <span>钠 ${roundNutrition(item.nutrition.sodiumMg)}mg</span>
                </div>
                <p>${item.notes.map(escapeHtml).join(" · ")}</p>
              </article>
            `
          )
          .join("")}
      </div>
    `;
  }

  function syncPlannerResultFromIds() {
    const items = buildMenuFromIds(plannerState.menuIds);
    plannerState.result = items.length ? createMealResult(items) : null;
    renderPlannerResult(plannerState.result);
  }

  function generateMealPlan() {
    plannerState.result = generateMenuItems();
    plannerState.menuIds = plannerState.result.ok ? plannerState.result.items.map((item) => item.recipe.id) : [];
    renderPlannerResult(plannerState.result);
    syncStateToUrl();
  }

  function replacePlannerRecipe(recipeId, slot) {
    const currentItems = plannerState.result && plannerState.result.ok ? plannerState.result.items : buildMenuFromIds(plannerState.menuIds);
    const selectedIds = new Set(currentItems.map((item) => item.recipe.id).filter((id) => id !== recipeId));
    const replacement = recipes
      .map((recipe) => ({ recipe, score: scoreRecipeForSlot(recipe, slot, selectedIds) }))
      .filter((item) => item.recipe.id !== recipeId && Number.isFinite(item.score))
      .sort((a, b) => b.score - a.score)[0]?.recipe;
    if (!replacement) {
      showToast("没有找到同类可替换菜");
      return;
    }
    const nextItems = currentItems.map((item) => (item.recipe.id === recipeId ? { recipe: replacement, slot } : item));
    plannerState.result = createMealResult(nextItems);
    plannerState.menuIds = nextItems.map((item) => item.recipe.id);
    renderPlannerResult(plannerState.result);
    syncStateToUrl();
  }

  function renderRecipes() {
    const filtered = getFilteredRecipes();
    const visibleRecipes = filtered.slice(0, state.visibleCount);
    const selectedCount = getSelectedCount();
    resultCount.textContent = filtered.length;
    activeSummary.textContent = getActiveSummary();
    activeCountText.textContent = `已选 ${selectedCount} 项`;
    activeCountBadge.textContent = selectedCount;
    emptyState.hidden = filtered.length !== 0;
    recipeGrid.innerHTML = visibleRecipes.map((recipe, index) => renderRecipeCard(recipe, index, false)).join("");

    const hasMore = visibleRecipes.length < filtered.length;
    loadMoreBar.hidden = filtered.length === 0;
    visibleCountText.textContent = `已显示 ${visibleRecipes.length} / ${filtered.length} 道`;
    loadMoreButton.hidden = !hasMore;
  }

  function renderNutrition(recipe) {
    const nutrition = recipe.nutrition || {};
    const items = [
      ["热量", nutrition.caloriesKcal, "kcal"],
      ["蛋白质", nutrition.proteinG, "g"],
      ["脂肪", nutrition.fatG, "g"],
      ["碳水", nutrition.carbsG, "g"],
      ["膳食纤维", nutrition.fiberG, "g"],
      ["钠", nutrition.sodiumMg, "mg"]
    ];
    return `
      <section class="nutrition-panel">
        <div>
          <h3>每份营养估算</h3>
          <p>营养为每份估算，健身目标仅作日常选餐参考。</p>
        </div>
        <div class="nutrition-grid">
          ${items
            .map(([label, value, unit]) => `<span><strong>${escapeHtml(value ?? "-")}</strong>${escapeHtml(unit)}<small>${escapeHtml(label)}</small></span>`)
            .join("")}
        </div>
      </section>
    `;
  }

  function renderGuideList(items) {
    return `<ul>${(items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function renderBeginnerGuide(recipe) {
    const guide = recipe.beginnerGuide;
    if (!guide) {
      return "";
    }

    return `
      <section id="beginnerGuidePanel" class="beginner-guide" hidden>
        <div class="section-head">
          <div>
            <p class="eyebrow">Beginner Mode</p>
            <h3>新手做饭指南</h3>
          </div>
          <span>火候 / 时间 / 状态判断</span>
        </div>
        <div class="guide-grid">
          <section>
            <h4>下锅前检查</h4>
            ${renderGuideList(guide.prepChecklist)}
          </section>
          <section>
            <h4>需要工具</h4>
            ${renderGuideList(guide.toolChecklist)}
          </section>
        </div>
        <ol class="guide-steps">
          ${(guide.detailedSteps || [])
            .map(
              (item, index) => `
                <li class="guide-step">
                  <strong>${index + 1}. ${escapeHtml(item.title || "步骤")}</strong>
                  <p>${escapeHtml(item.detail || "")}</p>
                  <div class="guide-meta">
                    <span>火候：${escapeHtml(item.heatLevel || "-")}</span>
                    <span>时间：${escapeHtml(item.timeHint || "-")}</span>
                    <span>状态：${escapeHtml(item.visualCue || "-")}</span>
                  </div>
                  <small>避免：${escapeHtml(item.mistakeToAvoid || "-")}</small>
                </li>
              `
            )
            .join("")}
        </ol>
        <div class="guide-lists">
          <section>
            <h4>熟没熟怎么看</h4>
            <p>${escapeHtml(guide.donenessCheck || "")}</p>
          </section>
          <section>
            <h4>常见错误</h4>
            ${renderGuideList(guide.commonMistakes)}
          </section>
          <section>
            <h4>补救办法</h4>
            ${renderGuideList(guide.rescueTips)}
          </section>
        </div>
      </section>
    `;
  }

  function showRecipe(recipe) {
    const meta = [
      `${recipe.time} 分钟`,
      recipe.difficulty,
      `${recipe.servings} 人份`,
      `${recipe.cost}成本`,
      `辣度 ${recipe.spiceLevel}`
    ];

    dialogContent.innerHTML = `
      <div class="dialog-layout">
        <div class="dialog-visual ${getCardTone(recipes.indexOf(recipe))}">
          <span>${escapeHtml(recipe.emoji || recipe.name.slice(0, 1))}</span>
        </div>
        <div>
          <p class="eyebrow">${escapeHtml(recipe.cuisine)} · ${escapeHtml(recipe.category)}</p>
          <h2 id="dialogTitle">${escapeHtml(recipe.name)}</h2>
          <p class="dialog-summary">${escapeHtml(recipe.description)}</p>
          <p class="dialog-reason">${escapeHtml(recipe.recommendReason)}</p>
          <div class="recipe-tags dialog-tags">
            ${meta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
            ${(recipe.nutritionTags || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
          </div>
        </div>
      </div>
      <div class="dialog-meta">
        <span>餐次：${escapeHtml((recipe.mealType || []).join(" / "))}</span>
        <span>工具：${escapeHtml((recipe.tools || []).join(" / "))}</span>
        <span>主要食材：${escapeHtml((recipe.mainIngredients || []).join(" / "))}</span>
        <span>忌口：${escapeHtml((recipe.avoidIngredients || []).join(" / ") || "无")}</span>
        <span>适合：${escapeHtml((recipe.needScenes || []).join(" / ") || "日常吃饭")}</span>
        <span>一餐角色：${escapeHtml((recipe.mealRoles || []).join(" / ") || "菜品")}</span>
        <span>${escapeHtml(getCookabilityText(recipe))}</span>
      </div>
      ${renderNutrition(recipe)}
      ${
        recipe.beginnerGuide
          ? `<div class="beginner-actions"><button class="primary-button" type="button" data-action="toggle-beginner" aria-expanded="false">新手模式</button><span>展开火候、时间、状态判断和失败补救。</span></div>`
          : ""
      }
      ${renderBeginnerGuide(recipe)}
      <div class="dialog-columns">
        <section>
          <h3>食材</h3>
          <ul>${(recipe.ingredients || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </section>
        <section>
          <h3>步骤</h3>
          <ol>${(recipe.steps || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
        </section>
      </div>
      <p class="dialog-tip"><strong>小贴士：</strong>${escapeHtml(recipe.tips || "暂无")}</p>
    `;
    dialog.showModal();
  }

  function clearFilters() {
    state.keyword = "";
    keywordInput.value = "";
    filterKeys.forEach((key) => state[key].clear());
    state.mealPrep = false;
    state.visibleCount = initialVisibleCount;
    renderAll(true);
  }

  function encodeValues(values) {
    return Array.from(values).join(",");
  }

  function encodePlannerMembers() {
    const payload = plannerState.members.map((member) => ({
      name: member.name,
      appetite: member.appetite,
      goal: member.goal,
      avoids: member.avoids
    }));
    return encodeURIComponent(JSON.stringify(payload));
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

  function loadStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    state.keyword = params.get("q") || "";
    keywordInput.value = state.keyword;
    filterMeta.forEach(([key, , queryKey]) => {
      state[key].clear();
      const raw = params.get(queryKey);
      if (!raw) {
        return;
      }
      raw.split(",").filter(Boolean).forEach((value) => state[key].add(value));
    });
    state.mealPrep = params.get("prep") === "1";
    state.visibleCount = initialVisibleCount;
    const members = decodePlannerMembers(params.get("party"));
    if (members) {
      plannerState.members = members;
    }
    plannerState.menuIds = (params.get("menu") || "").split(",").filter(Boolean);
  }

  function syncStateToUrl() {
    const params = new URLSearchParams();
    if (state.keyword.trim()) {
      params.set("q", state.keyword.trim());
    }
    filterMeta.forEach(([key, , queryKey]) => {
      if (state[key].size) {
        params.set(queryKey, encodeValues(state[key]));
      }
    });
    if (state.mealPrep) {
      params.set("prep", "1");
    }
    if (plannerState.members.length) {
      params.set("party", encodePlannerMembers());
    }
    if (plannerState.menuIds.length) {
      params.set("menu", plannerState.menuIds.join(","));
    }
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
  }

  function renderAll(shouldSyncUrl) {
    if (shouldSyncUrl) {
      syncStateToUrl();
    }
    renderFilters();
    renderRecipes();
  }

  function openFilters() {
    document.body.classList.add("filters-open");
    filterBackdrop.hidden = false;
    filterPanel.setAttribute("aria-modal", "true");
  }

  function closeFilters() {
    document.body.classList.remove("filters-open");
    filterBackdrop.hidden = true;
    filterPanel.removeAttribute("aria-modal");
  }

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toast.hidden = true;
    }, 1800);
  }

  function fallbackCopy(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  async function copyShareLink() {
    syncStateToUrl();
    const url = window.location.href;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        fallbackCopy(url);
      }
      showToast("已复制当前筛选链接");
    } catch (error) {
      fallbackCopy(url);
      showToast("已复制当前筛选链接");
    }
  }

  function showRandomRecipe() {
    const filtered = getFilteredRecipes();
    if (!filtered.length) {
      showToast("当前筛选没有结果");
      return;
    }
    const recipe = filtered[Math.floor(Math.random() * filtered.length)];
    showRecipe(recipe);
  }

  function applyFitnessPreset(name) {
    const preset = fitnessPresets[name];
    if (!preset) {
      return;
    }

    state.keyword = "";
    keywordInput.value = "";
    filterKeys.forEach((key) => state[key].clear());
    state.mealPrep = Boolean(preset.mealPrep);
    (preset.fitnessGoals || []).forEach((value) => state.fitnessGoals.add(value));
    (preset.macroFocus || []).forEach((value) => state.macroFocus.add(value));
    state.visibleCount = initialVisibleCount;
    renderAll(true);
    recipeGrid.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  filterGroups.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) {
      return;
    }
    const key = button.dataset.filter;
    const value = button.dataset.value;
    if (state[key].has(value)) {
      state[key].delete(value);
    } else {
      state[key].add(value);
    }
    state.visibleCount = initialVisibleCount;
    renderAll(true);
  });

  if (plannerMembers) {
    plannerMembers.addEventListener("input", (event) => {
      const field = event.target.closest("[data-member-field]");
      if (!field) {
        return;
      }
      const member = plannerState.members[Number(field.dataset.memberIndex)];
      if (!member) {
        return;
      }
      if (field.dataset.memberField === "avoids") {
        member.avoids = splitAvoidText(field.value);
      } else {
        member[field.dataset.memberField] = field.value;
      }
      plannerState.menuIds = [];
      plannerState.result = null;
      renderPlannerResult(null);
      syncStateToUrl();
    });

    plannerMembers.addEventListener("change", (event) => {
      const field = event.target.closest("[data-member-field]");
      if (!field) {
        return;
      }
      const member = plannerState.members[Number(field.dataset.memberIndex)];
      if (!member) {
        return;
      }
      member[field.dataset.memberField] = field.dataset.memberField === "avoids" ? splitAvoidText(field.value) : field.value;
      plannerState.menuIds = [];
      plannerState.result = null;
      renderPlannerResult(null);
      syncStateToUrl();
    });
  }

  if (addMemberButton) {
    addMemberButton.addEventListener("click", () => {
      if (plannerState.members.length >= 8) {
        showToast("最多支持 8 人一起配餐");
        return;
      }
      plannerState.members.push({
        id: `member-${Date.now()}`,
        name: `成员 ${plannerState.members.length + 1}`,
        appetite: "正常",
        goal: "普通吃饭",
        avoids: []
      });
      plannerState.menuIds = [];
      plannerState.result = null;
      renderPlannerMembers();
      renderPlannerResult(null);
      syncStateToUrl();
    });
  }

  if (generateMealButton) {
    generateMealButton.addEventListener("click", generateMealPlan);
  }

  document.addEventListener("click", (event) => {
    const card = event.target.closest("[data-id]");
    if (card) {
      const recipe = recipes.find((item) => item.id === card.dataset.id);
      if (recipe) {
        showRecipe(recipe);
      }
      return;
    }

    const presetButton = event.target.closest("[data-fitness-preset]");
    if (presetButton) {
      applyFitnessPreset(presetButton.dataset.fitnessPreset);
      return;
    }

    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) {
      return;
    }
    if (actionButton.dataset.action === "toggle-beginner") {
      const panel = document.querySelector("#beginnerGuidePanel");
      if (!panel) {
        return;
      }
      const willOpen = panel.hidden;
      panel.hidden = !willOpen;
      actionButton.textContent = willOpen ? "收起新手模式" : "新手模式";
      actionButton.setAttribute("aria-expanded", String(willOpen));
      return;
    }
    if (actionButton.dataset.action === "remove-member") {
      const index = Number(actionButton.dataset.memberIndex);
      if (plannerState.members.length > 1 && Number.isInteger(index)) {
        plannerState.members.splice(index, 1);
        plannerState.menuIds = [];
        plannerState.result = null;
        renderPlannerMembers();
        renderPlannerResult(null);
        syncStateToUrl();
      }
      return;
    }
    if (actionButton.dataset.action === "open-planner-recipe") {
      const recipe = recipes.find((item) => item.id === actionButton.dataset.recipeId);
      if (recipe) {
        showRecipe(recipe);
      }
      return;
    }
    if (actionButton.dataset.action === "replace-planner-recipe") {
      replacePlannerRecipe(actionButton.dataset.recipeId, actionButton.dataset.slot);
      return;
    }
    if (actionButton.dataset.action === "random") {
      showRandomRecipe();
      return;
    }
    if (actionButton.dataset.action === "load-more") {
      state.visibleCount += loadMoreCount;
      renderRecipes();
      return;
    }
    if (actionButton.dataset.action === "share") {
      copyShareLink();
    }
  });

  keywordInput.addEventListener("input", (event) => {
    state.keyword = event.target.value;
    state.visibleCount = initialVisibleCount;
    renderAll(true);
  });

  document.querySelector("#clearButton").addEventListener("click", clearFilters);
  document.querySelector("#closeDialog").addEventListener("click", () => dialog.close());
  openFiltersButton.addEventListener("click", openFilters);
  closeFiltersButton.addEventListener("click", closeFilters);
  filterBackdrop.addEventListener("click", closeFilters);

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  window.addEventListener("popstate", () => {
    loadStateFromUrl();
    renderPlannerMembers();
    syncPlannerResultFromIds();
    renderAll(false);
  });

  loadStateFromUrl();
  renderFeaturedRecipes();
  renderPlannerMembers();
  syncPlannerResultFromIds();
  renderAll(false);
})();
