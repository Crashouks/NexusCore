function getActiveStoreDiscount(game) {
  if (!game || game.is_free) return 0;
  const pct = parseInt(game.discount_percent, 10);
  if (!pct || pct <= 0 || pct >= 100) return 0;
  if (game.discount_expires_at && new Date(game.discount_expires_at) < new Date()) return 0;
  return pct;
}

function getSalePrice(game) {
  if (!game || game.is_free) return null;
  const discount = getActiveStoreDiscount(game);
  if (discount <= 0) return null;
  const base = parseFloat(game.price) || 0;
  return Math.round(base * (1 - discount / 100) * 100) / 100;
}

function getPurchasePrice(game, { applyTrialDiscount = false } = {}) {
  if (!game || game.is_free) return 0;
  const sale = getSalePrice(game);
  if (sale != null) return sale;
  let price = parseFloat(game.price) || 0;
  if (applyTrialDiscount) {
    const td = game.trial_discount_percent || 10;
    price = Math.round(price * (1 - td / 100) * 100) / 100;
  }
  return price;
}

function enrichGame(game) {
  const discount_active = getActiveStoreDiscount(game);
  const sale_price = getSalePrice(game);
  return { ...game, discount_active, sale_price };
}

module.exports = { getActiveStoreDiscount, getSalePrice, getPurchasePrice, enrichGame };
