(function () {
  const data = window.SHISHI_DATA;
  const state = {
    keyword: "",
    cuisine: new Set(),
    flavor: new Set(),
    scene: new Set(),
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

  const filterMeta = [
    ["cuisine", "菜系"],
    ["flavor", "口味"],
    ["scene", "场景"],
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

  function renderFilters() {
    filterGroups.innerHTML = filterMeta
      .map(([key, title]) => {
        const chips = data.filters[key]
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

  function hasAllSelected(recipe, key) {
    if (!state[key].size) {
      return true;
    }
    return state[key].has(recipe[key]);
  }

  function hasBlockedAllergen(recipe) {
    if (!state.allergens.size) {
      return false;
    }
    return recipe.allergens.some((item) => state.allergens.has(item));
  }

  function matchesKeyword(recipe) {
    const keyword = state.keyword.trim().toLowerCase();
    if (!keyword) {
      return true;
    }

    return [
      recipe.title,
      recipe.summary,
      recipe.cuisine,
      recipe.flavor,
      recipe.scene,
      recipe.ingredients.join(" "),
      recipe.steps.join(" ")
    ]
      .join(" ")
      .toLowerCase()
      .includes(keyword);
  }

  function getFilteredRecipes() {
    return data.recipes
      .filter((recipe) => !hasBlockedAllergen(recipe))
      .filter((recipe) => hasAllSelected(recipe, "cuisine"))
      .filter((recipe) => hasAllSelected(recipe, "flavor"))
      .filter((recipe) => hasAllSelected(recipe, "scene"))
      .filter((recipe) => hasAllSelected(recipe, "duration"))
      .filter((recipe) => hasAllSelected(recipe, "difficulty"))
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

  function renderRecipes() {
    const recipes = getFilteredRecipes();
    resultCount.textContent = recipes.length;
    activeSummary.textContent = getActiveSummary();
    emptyState.hidden = recipes.length !== 0;

    recipeGrid.innerHTML = recipes
      .map((recipe, index) => {
        const allergenText = recipe.allergens.length ? recipe.allergens.join(" / ") : "无常见忌口标签";
        return `
          <article class="recipe-card ${getCardTone(index)}" data-id="${recipe.id}">
            <div class="recipe-visual" aria-hidden="true">
              <span>${escapeHtml(recipe.title.slice(0, 1))}</span>
            </div>
            <div class="recipe-body">
              <div class="recipe-topline">
                <span>${escapeHtml(recipe.cuisine)}</span>
                <span>${escapeHtml(recipe.duration)}</span>
              </div>
              <h3>${escapeHtml(recipe.title)}</h3>
              <p>${escapeHtml(recipe.summary)}</p>
              <div class="recipe-tags">
                <span>${escapeHtml(recipe.flavor)}</span>
                <span>${escapeHtml(recipe.scene)}</span>
                <span>${escapeHtml(recipe.difficulty)}</span>
              </div>
              <small>${escapeHtml(allergenText)}</small>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function showRecipe(recipe) {
    dialogContent.innerHTML = `
      <div class="dialog-layout">
        <div class="dialog-visual ${getCardTone(data.recipes.indexOf(recipe))}">
          <span>${escapeHtml(recipe.title.slice(0, 1))}</span>
        </div>
        <div>
          <p class="eyebrow">${escapeHtml(recipe.cuisine)} · ${escapeHtml(recipe.duration)}</p>
          <h2 id="dialogTitle">${escapeHtml(recipe.title)}</h2>
          <p class="dialog-summary">${escapeHtml(recipe.summary)}</p>
          <div class="recipe-tags dialog-tags">
            <span>${escapeHtml(recipe.flavor)}</span>
            <span>${escapeHtml(recipe.scene)}</span>
            <span>${escapeHtml(recipe.difficulty)}</span>
          </div>
        </div>
      </div>
      <div class="dialog-columns">
        <section>
          <h3>食材</h3>
          <ul>${recipe.ingredients.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </section>
        <section>
          <h3>步骤</h3>
          <ol>${recipe.steps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
        </section>
      </div>
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
    const recipe = data.recipes.find((item) => item.id === card.dataset.id);
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
    const recipes = getFilteredRecipes();
    if (!recipes.length) {
      return;
    }
    const recipe = recipes[Math.floor(Math.random() * recipes.length)];
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
