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
  const variantId = widget.dataset.variantId;

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

  let selectedPlan = null;
  let mode = "onetime"; // "onetime" | "subscribe"

  // ── Row selection ─────────────────────────────────────────────────
  onetimeRow.addEventListener("click", () => selectMode("onetime"));
  subscribeRow.addEventListener("click", () => {
    if (selectedPlan) selectMode("subscribe");
  });

  function selectMode(newMode) {
    mode = newMode;

    onetimeRow.classList.toggle("active", mode === "onetime");
    subscribeRow.classList.toggle("active", mode === "subscribe");

    if (mode === "subscribe") {
      actionBtn.textContent = "Subscribe Now";
    } else {
      actionBtn.textContent = "Buy Now";
    }
  }

  // ── Main action button ────────────────────────────────────────────
  actionBtn.addEventListener("click", () => {
    if (mode === "onetime") {
      fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: variantId,
          quantity: 1
        })
      })
        .then(() => {
          window.location.href = '/checkout';
        });
    } else {
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

  // ── Fetch plan ────────────────────────────────────────────────────
  async function fetchPlans() {
    try {
      const res = await fetch(
        `${appUrl}/api/plans?shop=${shop}&productId=${productId}`
      );
      const data = await res.json();
      console.log(data)

      loadingEl.style.display = "none";
      optionsEl.style.display = "block";

      if (!data.plans || data.plans.length === 0) {
        // No subscription plan — hide subscribe row, only show one-time
        subscribeRow.style.display = "none";
        selectMode("onetime");
        return;
      }

      selectedPlan = data.plans[0];
      subscribeRow.querySelector(".sw-plan-name").textContent = selectedPlan.name;
      subscribeRow.querySelector(".sw-des").textContent = selectedPlan.description;
      subscribeRow.querySelector(".sw-plan-price").textContent =
        `from ${selectedPlan.currency} ${(selectedPlan.amount / 100).toLocaleString()} / ${selectedPlan.interval}`;

      // Default to one-time selected
      selectMode("onetime");
    } catch (err) {
      console.error("fetchPlans error:", err);
      loadingEl.innerHTML = "<span>Failed to load options.</span>";
    }
  }

  function showForm() {
    selectedPlanEl.innerHTML = `
      <div class="sw-summary">
        <span class="sw-summary-name">${selectedPlan.name}</span>
        <p>${selectedPlan.description}</p>
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
          onSuccess: (transaction) => handleSuccess({ firstName, lastName, email, transaction }),
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

  fetchPlans();
})();
