/* ============================================================
   Bella Napoli Pizzeria – main.js
   Cart management, order-page menu loader, and UI helpers
   ============================================================ */

// ---------------------------------------------------------------------------
// Cart store (persisted in sessionStorage)
// ---------------------------------------------------------------------------
const CART_KEY = 'bellanapoli_cart';

function loadCart() {
  try {
    return JSON.parse(sessionStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
}

let cart = loadCart();

// ---------------------------------------------------------------------------
// Cart helpers
// ---------------------------------------------------------------------------
function cartAdd(id, name, price, qty = 1) {
  id = parseInt(id, 10);
  price = parseFloat(price);
  qty = parseInt(qty, 10);
  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ id, name, price, qty });
  }
  saveCart(cart);
  renderCart();
  showCartToast(name);
}

function cartRemove(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart(cart);
  renderCart();
}

function cartClear() {
  cart = [];
  saveCart(cart);
  renderCart();
}

function cartTotal() {
  return cart.reduce((sum, i) => sum + i.price * i.qty, 0);
}

// ---------------------------------------------------------------------------
// Cart render (sidebar)
// ---------------------------------------------------------------------------
function renderCart() {
  const countEl = document.getElementById('cartCount');
  const itemsEl = document.getElementById('cartItems');
  const totalEl = document.getElementById('cartTotal');

  const totalQty = cart.reduce((s, i) => s + i.qty, 0);
  if (countEl) countEl.textContent = totalQty;

  if (!itemsEl) return;

  if (cart.length === 0) {
    itemsEl.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
  } else {
    itemsEl.innerHTML = cart.map(item => `
      <div class="cart-item">
        <span class="ci-name">${escapeHtml(item.name)}</span>
        <span class="ci-qty">×${item.qty}</span>
        <span class="ci-price">$${(item.price * item.qty).toFixed(2)}</span>
        <button class="ci-remove" onclick="cartRemove(${item.id})" aria-label="Remove">✕</button>
      </div>
    `).join('');
  }

  if (totalEl) totalEl.textContent = `$${cartTotal().toFixed(2)}`;

  // Also refresh order-page cart if present
  renderOrderCart();
}

// ---------------------------------------------------------------------------
// Order-page cart render (inline summary)
// ---------------------------------------------------------------------------
function renderOrderCart() {
  const el = document.getElementById('orderCartItems');
  const subtotalEl = document.getElementById('orderSubtotal');
  if (!el) return;

  if (cart.length === 0) {
    el.innerHTML = '<p class="cart-empty">No items yet. Add from the menu.</p>';
  } else {
    el.innerHTML = cart.map(item => `
      <div class="order-cart-item">
        <span class="oci-name">${escapeHtml(item.name)}</span>
        <span class="oci-qty">×${item.qty}</span>
        <span class="oci-price">$${(item.price * item.qty).toFixed(2)}</span>
        <button class="oci-remove" onclick="cartRemove(${item.id})" aria-label="Remove">✕</button>
      </div>
    `).join('');
  }

  if (subtotalEl) subtotalEl.textContent = `$${cartTotal().toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Cart sidebar toggle
// ---------------------------------------------------------------------------
function openCart() {
  document.getElementById('cartSidebar')?.classList.add('open');
  document.getElementById('cartOverlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cartSidebar')?.classList.remove('open');
  document.getElementById('cartOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

// ---------------------------------------------------------------------------
// Mini toast notification
// ---------------------------------------------------------------------------
function showCartToast(name) {
  const toast = document.createElement('div');
  toast.className = 'cart-toast';
  toast.textContent = `✓ ${name} added to cart`;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '1.5rem',
    left: '50%',
    transform: 'translateX(-50%) translateY(60px)',
    background: '#1a1a1a',
    color: '#fff',
    padding: '.65rem 1.5rem',
    borderRadius: '50px',
    fontWeight: '600',
    fontSize: '.9rem',
    zIndex: '999',
    transition: 'transform .35s ease, opacity .35s ease',
    opacity: '0',
    whiteSpace: 'nowrap',
  });
  document.body.appendChild(toast);
  // Animate in
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(-50%) translateY(0)';
    toast.style.opacity = '1';
  });
  // Animate out after 2.5s
  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(60px)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 2500);
}

// ---------------------------------------------------------------------------
// Qty input helper (menu page)
// ---------------------------------------------------------------------------
function changeQty(btn, delta) {
  const control = btn.closest('.qty-control');
  const input = control.querySelector('.qty-input');
  const newVal = Math.max(1, Math.min(20, parseInt(input.value, 10) + delta));
  input.value = newVal;
}

// ---------------------------------------------------------------------------
// Attach "Add to Cart" buttons (any page)
// ---------------------------------------------------------------------------
function attachAddToCartButtons(container = document) {
  container.querySelectorAll('.add-to-cart').forEach(btn => {
    btn.addEventListener('click', () => {
      const id    = btn.dataset.id;
      const name  = btn.dataset.name;
      const price = btn.dataset.price;

      // Check for a qty input sibling (menu page card)
      const card = btn.closest('.menu-card');
      const qtyInput = card ? card.querySelector('.qty-input') : null;
      const qty = qtyInput ? parseInt(qtyInput.value, 10) || 1 : 1;

      cartAdd(id, name, price, qty);

      // Brief visual feedback on button
      btn.textContent = '✓ Added';
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = 'Add';
        btn.disabled = false;
      }, 1200);
    });
  });
}

// ---------------------------------------------------------------------------
// Order page – load menu via API and render
// ---------------------------------------------------------------------------
async function loadOrderPageMenu() {
  const grid = document.getElementById('orderMenuGrid');
  if (!grid) return;

  try {
    const resp = await fetch('/api/menu');
    if (!resp.ok) throw new Error('Failed to load menu');
    const items = await resp.json();
    grid.innerHTML = '';

    if (items.length === 0) {
      grid.innerHTML = '<p class="empty-state">No menu items available.</p>';
      return;
    }

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'menu-card';
      card.dataset.category = item.category;

      const emojiMap = { pizza: '🍕', side: '🥗', drink: '🥤', dessert: '🍮' };

      card.innerHTML = `
        <div class="menu-card-img cat-${escapeHtml(item.category)}">
          <span class="pizza-emoji">${emojiMap[item.category] || '🍽️'}</span>
        </div>
        <div class="menu-card-body">
          <span class="badge badge-${escapeHtml(item.category)}">${escapeHtml(item.category)}</span>
          <h3>${escapeHtml(item.name)}</h3>
          <p class="menu-desc">${escapeHtml(item.description || '')}</p>
          <div class="menu-card-footer">
            <span class="price">$${parseFloat(item.price).toFixed(2)}</span>
            <div class="qty-control">
              <button class="qty-btn" type="button" onclick="changeQty(this,-1)">−</button>
              <input class="qty-input" type="number" value="1" min="1" max="20" aria-label="Quantity" />
              <button class="qty-btn" type="button" onclick="changeQty(this,1)">+</button>
            </div>
            <button class="btn btn-sm btn-primary add-to-cart"
                    data-id="${item.id}"
                    data-name="${escapeHtml(item.name)}"
                    data-price="${item.price}">
              Add
            </button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });

    attachAddToCartButtons(grid);
    setupOrderCategoryFilter();

  } catch (err) {
    grid.innerHTML = '<p class="empty-state">Unable to load menu. Please refresh.</p>';
  }
}

// ---------------------------------------------------------------------------
// Order page – category filter (JS-based, no page reload)
// ---------------------------------------------------------------------------
function setupOrderCategoryFilter() {
  const orderMenuSection = document.querySelector('.order-menu');
  if (!orderMenuSection) return;

  orderMenuSection.querySelectorAll('.tab-btn').forEach(tab => {
    tab.addEventListener('click', () => {
      orderMenuSection.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const filter = tab.dataset.filter;
      document.querySelectorAll('#orderMenuGrid .menu-card').forEach(card => {
        const show = filter === 'all' || card.dataset.category === filter;
        card.style.display = show ? '' : 'none';
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Order form submit
// ---------------------------------------------------------------------------
function setupOrderForm() {
  const form = document.getElementById('orderForm');
  if (!form) return;

  // Show/hide delivery address field based on order type
  const radioGroup = form.querySelectorAll('input[name="orderType"]');
  const addressGroup = document.getElementById('addressGroup');

  function toggleAddress() {
    const val = form.querySelector('input[name="orderType"]:checked')?.value;
    if (addressGroup) addressGroup.style.display = val === 'delivery' ? '' : 'none';
  }
  radioGroup.forEach(r => r.addEventListener('change', toggleAddress));
  toggleAddress();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('orderError');
    const btn = document.getElementById('placeOrderBtn');

    if (cart.length === 0) {
      showFormError(errorEl, 'Please add at least one item to your cart.');
      return;
    }

    const orderType = form.querySelector('input[name="orderType"]:checked')?.value;
    const deliveryAddress = document.getElementById('deliveryAddress')?.value.trim() || '';

    if (orderType === 'delivery' && !deliveryAddress) {
      showFormError(errorEl, 'Please enter a delivery address.');
      return;
    }

    const payload = {
      customer_name:    document.getElementById('customerName').value.trim(),
      customer_email:   document.getElementById('customerEmail').value.trim(),
      customer_phone:   document.getElementById('customerPhone').value.trim(),
      order_type:       orderType,
      delivery_address: deliveryAddress,
      notes:            document.getElementById('orderNotes')?.value.trim() || '',
      items: cart.map(i => ({ id: i.id, quantity: i.qty })),
    };

    if (!payload.customer_name || !payload.customer_email || !payload.customer_phone) {
      showFormError(errorEl, 'Please fill in all required fields.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Placing Order…';
    if (errorEl) errorEl.style.display = 'none';

    try {
      const resp = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await resp.json();

      if (!resp.ok) {
        throw new Error(json.error || 'Order failed');
      }

      cartClear();
      // Redirect to confirmation page
      const base = window.CONFIRMATION_URL_BASE || '/confirmation/';
      window.location.href = base + json.order_id;

    } catch (err) {
      showFormError(errorEl, err.message || 'Something went wrong. Please try again.');
      btn.disabled = false;
      btn.textContent = 'Place Order';
    }
  });
}

function showFormError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ---------------------------------------------------------------------------
// Utility – HTML-escape user data before inserting into innerHTML
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Mobile nav toggle
// ---------------------------------------------------------------------------
function setupNavToggle() {
  const toggle = document.getElementById('navToggle');
  const links  = document.getElementById('navLinks');
  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    links.classList.toggle('open');
  });

  // Close nav when a link is clicked
  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => links.classList.remove('open'));
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Cart sidebar
  document.getElementById('cartBtn')?.addEventListener('click', openCart);
  document.getElementById('cartClose')?.addEventListener('click', closeCart);
  document.getElementById('cartOverlay')?.addEventListener('click', closeCart);

  // Mobile nav
  setupNavToggle();

  // Initial render
  renderCart();

  // Static add-to-cart buttons (index / menu pages)
  attachAddToCartButtons();

  // Order page
  loadOrderPageMenu();
  setupOrderForm();
});
