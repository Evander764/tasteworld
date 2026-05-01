(function () {
  const Core = window.TasteworldCore;
  const recipes = Array.isArray(window.RECIPES) ? window.RECIPES : [];
  const initialVisibleCount = Core.initialVisibleCount;
  const loadMoreCount = Core.loadMoreCount;
  const state = Core.createInitialFilterState();
  const plannerState = Core.createDefaultPlannerState();

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
  const plannerDisclosure = document.querySelector("#plannerDisclosure");
  const addMemberButton = document.querySelector("#addMemberButton");
  const generateMealButton = document.querySelector("#generateMealButton");

  const memberGoals = Core.memberGoals;
  const appetiteWeights = Core.appetiteWeights;
  const filterMeta = Core.filterMeta;
  const filterKeys = Core.filterKeys;
  const fitnessPresets = Core.fitnessPresets;
  const starterPresets = Core.starterPresets;
  const splitAvoidText = Core.splitAvoidText;
  const formatAvoids = Core.formatAvoids;
  const getCookabilityText = Core.getCookabilityText;
  const roundNutrition = Core.roundNutrition;
  const getAllergenText = Core.getAllergenText;
  const getMemberName = Core.getMemberName;
  const slotName = Core.slotName;
  const encodeValues = Core.encodeValues;
  const decodePlannerMembers = Core.decodePlannerMembers;
  const getFilterValues = (key) => Core.getFilterValues(recipes, key);
  const getSelectedCount = () => Core.getSelectedCount(state);
  const getFilteredRecipes = () => Core.getFilteredRecipes(recipes, state);
  const getActiveSummary = () => Core.getActiveSummary(state);
  const pickFeaturedRecipes = () => Core.pickFeaturedRecipes(recipes);
  const buildMenuFromIds = (ids) => Core.buildMenuFromIds(recipes, plannerState.members, ids);
  const createMealResult = (items) => Core.createMealResult(plannerState.members, items);
  const generateMenuItems = () => Core.generateMenuItems(recipes, plannerState.members);
  const scoreRecipeForSlot = (recipe, slot, selectedIds) => Core.scoreRecipeForSlot(recipe, slot, selectedIds, plannerState.members);
  const encodePlannerMembers = () => Core.encodePlannerMembers(plannerState.members);
  const isDefaultPlannerMembers = () => Core.isDefaultPlannerMembers(plannerState.members);

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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

  function renderStarterCards() {
    const buttons = typeof document.querySelectorAll === "function" ? document.querySelectorAll("[data-starter-preset]") : [];
    buttons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.starterPreset === state.starter);
    });
  }

  function getCardTone(index) {
    return ["tone-green", "tone-red", "tone-blue", "tone-gold", "tone-ink"][index % 5];
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

  function renderFeaturedRecipes() {
    featuredRecipes.innerHTML = pickFeaturedRecipes()
      .map((recipe, index) => renderRecipeCard(recipe, index + 1, true))
      .join("");
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
    state.starter = "";
    state.visibleCount = initialVisibleCount;
    renderAll(true);
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
    state.starter = starterPresets[params.get("starter")] ? params.get("starter") : "";
    state.visibleCount = initialVisibleCount;
    const members = decodePlannerMembers(params.get("party"));
    if (members) {
      plannerState.members = members;
    }
    plannerState.menuIds = (params.get("menu") || "").split(",").filter(Boolean);
    if (plannerDisclosure && (params.has("party") || plannerState.menuIds.length)) {
      plannerDisclosure.open = true;
    }
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
    if (state.starter) {
      params.set("starter", state.starter);
    }
    if (plannerState.members.length && (!isDefaultPlannerMembers() || plannerState.menuIds.length)) {
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
    renderStarterCards();
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
    state.starter = "";
    (preset.fitnessGoals || []).forEach((value) => state.fitnessGoals.add(value));
    (preset.macroFocus || []).forEach((value) => state.macroFocus.add(value));
    (preset.tags || []).forEach((value) => state.tags.add(value));
    state.visibleCount = initialVisibleCount;
    renderAll(true);
    recipeGrid.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function applyStarterPreset(name) {
    if (!starterPresets[name]) {
      return;
    }
    state.keyword = "";
    keywordInput.value = "";
    filterKeys.forEach((key) => state[key].clear());
    state.mealPrep = false;
    state.starter = state.starter === name ? "" : name;
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

    const starterButton = event.target.closest("[data-starter-preset]");
    if (starterButton) {
      applyStarterPreset(starterButton.dataset.starterPreset);
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
