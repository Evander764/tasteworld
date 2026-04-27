(function () {
  const recipes = Array.isArray(window.RECIPES) ? window.RECIPES : [];
  const state = {
    keyword: "",
    category: new Set(),
    cuisine: new Set(),
    mealType: new Set(),
    tags: new Set(),
    duration: new Set(),
    difficulty: new Set(),
    allergens: new Set()
  };

  const filterGroups = document.querySelector("#filterGroups");
  const recipeGrid = document.querySelector("#recipeGrid");
  const resultCount = document.querySelector("#resultCount");
  const activeSummary = document.querySelector("#activeSummary");
  const emptyState = document.querySelector("#emptyState");
  const keywordInput = document.querySelector("#keywordInput");
  const dialog = document.querySelector("#recipeDialog");
  const dialogContent = document.querySelector("#dialogContent");

  const durationBuckets = [
    { label: "15 分钟内", match: (recipe) => recipe.time <= 15 },
    { label: "30 分钟内", match: (recipe) => recipe.time <= 30 },
    { label: "1 小时内", match: (recipe) => recipe.time <= 60 },
    { label: "慢炖慢煮", match: (recipe) => recipe.time > 60 }
  ];

  const filterMeta = [
    ["category", "分类"],
    ["cuisine", "菜系"],
    ["mealType", "餐次"],
    ["tags", "标签"],
    ["duration", "烹饪时长"],
    ["difficulty", "难度"],
    ["allergens", "忌口/过敏"]
  ];

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
    return Array.from(state.duration).every((label) => {
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
      ...(recipe.mealType || []),
      ...(recipe.tags || []),
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
    return active.length ? active.join(" · ") : "未选择筛选条件";
  }

  function getCardTone(index) {
    return ["tone-green", "tone-red", "tone-blue", "tone-gold", "tone-ink"][index % 5];
  }

  function getAllergenText(recipe) {
    return recipe.allergens && recipe.allergens.length ? recipe.allergens.join(" / ") : "无常见过敏源";
  }

  function renderRecipes() {
    const filtered = getFilteredRecipes();
    resultCount.textContent = filtered.length;
    activeSummary.textContent = getActiveSummary();
    emptyState.hidden = filtered.length !== 0;

    recipeGrid.innerHTML = filtered
      .map((recipe, index) => {
        const tags = [recipe.category, recipe.difficulty, `${recipe.time} 分钟`].filter(Boolean);
        return `
          <article class="recipe-card ${getCardTone(index)}" data-id="${recipe.id}">
            <div class="recipe-visual" aria-hidden="true">
              <span>${escapeHtml(recipe.emoji || recipe.name.slice(0, 1))}</span>
            </div>
            <div class="recipe-body">
              <div class="recipe-topline">
                <span>${escapeHtml(recipe.cuisine)}</span>
                <span>${escapeHtml((recipe.mealType || []).join(" / "))}</span>
              </div>
              <h3>${escapeHtml(recipe.name)}</h3>
              <p>${escapeHtml(recipe.description)}</p>
              <div class="recipe-tags">
                ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
              </div>
              <small>${escapeHtml(getAllergenText(recipe))}</small>
            </div>
          </article>
        `;
      })
      .join("");
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
          <div class="recipe-tags dialog-tags">
            ${meta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
          </div>
        </div>
      </div>
      <div class="dialog-meta">
        <span>餐次：${escapeHtml((recipe.mealType || []).join(" / "))}</span>
        <span>工具：${escapeHtml((recipe.tools || []).join(" / "))}</span>
        <span>主要食材：${escapeHtml((recipe.mainIngredients || []).join(" / "))}</span>
        <span>忌口：${escapeHtml((recipe.avoidIngredients || []).join(" / ") || "无")}</span>
      </div>
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
    filterMeta.forEach(([key]) => state[key].clear());
    renderFilters();
    renderRecipes();
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
    renderFilters();
    renderRecipes();
  });

  recipeGrid.addEventListener("click", (event) => {
    const card = event.target.closest("[data-id]");
    if (!card) {
      return;
    }
    const recipe = recipes.find((item) => item.id === card.dataset.id);
    if (recipe) {
      showRecipe(recipe);
    }
  });

  keywordInput.addEventListener("input", (event) => {
    state.keyword = event.target.value;
    renderRecipes();
  });

  document.querySelector("#clearButton").addEventListener("click", clearFilters);

  document.querySelector("#randomButton").addEventListener("click", () => {
    const filtered = getFilteredRecipes();
    if (!filtered.length) {
      return;
    }
    const recipe = filtered[Math.floor(Math.random() * filtered.length)];
    showRecipe(recipe);
  });

  document.querySelector("#closeDialog").addEventListener("click", () => dialog.close());

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  renderFilters();
  renderRecipes();
})();
