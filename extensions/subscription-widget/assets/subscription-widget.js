(function () {
  if (window.location.search.includes("thankyou=true")) {
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed; top: 20px; right: 20px;
      background: #008060; color: white;
      padding: 16px 24px; border-radius: 8px;
      font-size: 16px; font-weight: 500;
      z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    toast.textContent = "🎉 Thank you! Your subscription is now active.";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
    window.history.replaceState({}, "", window.location.pathname);
  }

  const widget = document.querySelector(".subscription-widget");
  if (!widget) return;

  const appUrl = widget.dataset.appUrl;
  const shop = widget.dataset.shop;
  const productId = widget.dataset.productId;

  const loadingEl = widget.querySelector(".subscription-widget__loading");
  const optionsEl = widget.querySelector(".subscription-widget__options");
  const subscribeRow = widget.querySelector(".subscription-widget__row--subscribe");
  const onetimeRow = widget.querySelector(".subscription-widget__row--onetime");
  const formEl = widget.querySelector(".subscription-widget__form");
  const errorEl = widget.querySelector(".subscription-widget__error");
  const backBtn = widget.querySelector(".subscription-widget__back-btn");
  const payBtn = widget.querySelector(".subscription-widget__pay-btn");
  const actionBtn = widget.querySelector(".subscription-widget__action-btn");
  const selectedPlanEl = widget.querySelector(".subscription-widget__selected-plan");
  const planListEl = widget.querySelector(".sw-plan-list");
  const variantBtns = widget.querySelectorAll(".sw-variant-btn");
  const priceEl = widget.querySelector(".sw-current-price");
  const comparePriceEl = widget.querySelector(".sw-compare-price");
  const saveBadgeEl = widget.querySelector(".sw-save-badge");

  let plans = [];
  let selectedPlan = null;
  let mode = "subscribe";
  let selectedVariantId = widget.dataset.variantId;

  // ── Variant buttons ───────────────────────────────────────────────
  variantBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      variantBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedVariantId = btn.dataset.variantId;

      // ── Update URL with selected variant ──────────────────────────
      const url = new URL(window.location.href);
      url.searchParams.set("variant", selectedVariantId);
      window.history.replaceState({}, "", url.toString());

      // ── Sync with Shopify native variant selector ─────────────────
      const nativeSelect = document.querySelector(
        'select[name="id"], input[name="id"]'
      );
      if (nativeSelect) {
        nativeSelect.value = selectedVariantId;
        nativeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }

      const productForm = document.querySelector("product-form, .product-form");
      if (productForm) {
        productForm.dispatchEvent(
          new CustomEvent("variant:changed", {
            bubbles: true,
            detail: { variant: { id: parseInt(selectedVariantId) } },
          })
        );
      }

      // ── Update widget price display ───────────────────────────────
      const price = parseFloat(btn.dataset.price);
      const comparePrice = parseFloat(btn.dataset.comparePrice);

      if (priceEl) priceEl.textContent = formatMoney(price);

      if (comparePriceEl) {
        if (comparePrice && comparePrice > price) {
          comparePriceEl.textContent = formatMoney(comparePrice);
          comparePriceEl.style.display = "inline";
        } else {
          comparePriceEl.style.display = "none";
        }
      }

      if (saveBadgeEl) {
        const pct =
          comparePrice && comparePrice > price
            ? Math.round((1 - price / comparePrice) * 100)
            : 0;
        if (pct > 0) {
          saveBadgeEl.textContent = `SAVE ${pct}%`;
          saveBadgeEl.style.display = "inline";
        } else {
          saveBadgeEl.style.display = "none";
        }
      }

      // no fetchPlans() here — plans are per product not per variant
    });
  });

  function formatMoney(cents) {
    return "$" + (cents / 100).toFixed(2);
  }

  // ── Row selection ─────────────────────────────────────────────────
  onetimeRow.addEventListener("click", () => selectMode("onetime"));
  subscribeRow.addEventListener("click", () => {
    if (plans.length > 0) selectMode("subscribe");
  });

  function selectMode(newMode) {
    mode = newMode;
    onetimeRow.classList.toggle("active", mode === "onetime");
    subscribeRow.classList.toggle("active", mode === "subscribe");
    actionBtn.textContent =
      mode === "subscribe" ? "SUBSCRIBE & SAVE 🔒" : "ADD TO CART 🔒";
    if (planListEl) {
      planListEl.style.display = mode === "subscribe" ? "flex" : "none";
    }
  }

  // ── Render plan options ───────────────────────────────────────────
  function renderPlans(plansData) {
    if (!planListEl) return;
    planListEl.innerHTML = "";

    plansData.forEach((plan, index) => {
      const item = document.createElement("div");
      item.className = "sw-plan-item" + (index === 0 ? " active" : "");
      item.dataset.planId = plan.id;
      item.innerHTML = `
        <div class="sw-plan-radio"></div>
        <div class="sw-plan-item-text">
          <span class="sw-plan-item-name">${plan.name}</span>
          ${plan.description ? `<span class="sw-plan-item-desc">${plan.description}</span>` : ""}
          <span class="sw-plan-item-price">
            ${plan.currency} ${(plan.amount / 100).toLocaleString()} / ${plan.interval}
          </span>
        </div>
      `;
      item.addEventListener("click", () => {
        planListEl.querySelectorAll(".sw-plan-item").forEach((el) =>
          el.classList.remove("active")
        );
        item.classList.add("active");
        selectedPlan = plan;
      });
      planListEl.appendChild(item);
    });

    selectedPlan = plansData[0];
  }

  // ── Main action button ────────────────────────────────────────────
  actionBtn.addEventListener("click", () => {
    if (mode === "onetime") {
      fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedVariantId, quantity: 1 }),
      }).then(() => {
        window.location.href = "/cart";
      });
    } else {
      if (!selectedPlan) {
        showError("Please select a subscription plan.");
        return;
      }
      showForm();
    }
  });

  // ── Back ──────────────────────────────────────────────────────────
  backBtn.addEventListener("click", () => {
    formEl.style.display = "none";
    optionsEl.style.display = "block";
    errorEl.style.display = "none";
  });

  // ── Pay ───────────────────────────────────────────────────────────
  payBtn.addEventListener("click", () => {
    const firstName = document.getElementById("sw-first-name").value.trim();
    const lastName = document.getElementById("sw-last-name").value.trim();
    const email = document.getElementById("sw-email").value.trim();

    if (!firstName || !lastName || !email) {
      showError("Please fill in all fields.");
      return;
    }
    if (!validateEmail(email)) {
      showError("Please enter a valid email address.");
      return;
    }
    initPaystack({ firstName, lastName, email });
  });

  // ── Fetch plans (runs once on page load) ──────────────────────────
  async function fetchPlans() {
    try {
      const res = await fetch(
        `${appUrl}/api/plans?shop=${shop}&productId=${productId}`
      );
      const data = await res.json();
      console.log(data);

      loadingEl.style.display = "none";
      optionsEl.style.display = "block";

      if (!data.plans || data.plans.length === 0) {
        subscribeRow.style.display = "none";
        if (planListEl) planListEl.style.display = "none";
        selectMode("onetime");
        plans = [];
        selectedPlan = null;
        return;
      }

      subscribeRow.style.display = "flex";
      plans = data.plans;
      renderPlans(plans);
      selectMode("subscribe");
    } catch (err) {
      console.error("fetchPlans error:", err);
      loadingEl.innerHTML = "<span>Failed to load options.</span>";
    }
  }

  function showForm() {
    selectedPlanEl.innerHTML = `
      <div class="sw-summary">
        <span class="sw-summary-name">${selectedPlan.name}</span>
        ${selectedPlan.description ? `<p>${selectedPlan.description}</p>` : ""}
        <span class="sw-summary-price">
          ${selectedPlan.currency} ${(selectedPlan.amount / 100).toLocaleString()} / ${selectedPlan.interval}
        </span>
      </div>
    `;
    optionsEl.style.display = "none";
    formEl.style.display = "block";
  }

  function initPaystack({ firstName, lastName, email }) {
    payBtn.disabled = true;
    payBtn.textContent = "Processing...";

    fetch(`${appUrl}/api/paystack-key?shop=${shop}`)
      .then((res) => res.json())
      .then(({ publicKey }) => {
        if (!publicKey) {
          showError("Missing Paystack public key.");
          resetPayBtn();
          return;
        }
        const handler = PaystackPop.setup({
          key: publicKey,
          email,
          amount: selectedPlan.amount,
          currency: selectedPlan.currency,
          plan: selectedPlan.paystackPlanCode,
          onSuccess: (transaction) =>
            handleSuccess({ firstName, lastName, email, transaction }),
          onCancel: () => resetPayBtn(),
        });
        handler.openIframe();
      })
      .catch((err) => {
        console.error("initPaystack error:", err);
        showError("Failed to initialize payment. Please try again.");
        resetPayBtn();
      });
  }

  async function handleSuccess({ firstName, lastName, email, transaction }) {
    try {
      const res = await fetch(`${appUrl}/api/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop,
          firstName,
          lastName,
          email,
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          planCode: selectedPlan.paystackPlanCode,
          reference: transaction.reference,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.error || "Failed to save subscription.");
        resetPayBtn();
        return;
      }
      window.location.href = "/?thankyou=true";
    } catch (err) {
      console.error("Subscribe error:", err);
      showError("Payment succeeded but failed to save. Please contact support.");
      resetPayBtn();
    }
  }

  function resetPayBtn() {
    payBtn.disabled = false;
    payBtn.textContent = "Subscribe Now";
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = "block";
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // runs once only
  fetchPlans();
})();
