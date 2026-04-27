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
    const tags = [recipe.category, ...fitnessBadges, `${recipe.time} 分钟`].filter(Boolean);
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
    renderAll(false);
  });

  loadStateFromUrl();
  renderFeaturedRecipes();
  renderAll(false);
})();
