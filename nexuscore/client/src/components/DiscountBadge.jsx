export default function DiscountBadge({ percent, small }) {
  if (!percent || percent <= 0) return null;
  return (
    <span className="discount-badge" style={{
      fontSize: small ? 10 : 12,
      padding: small ? '2px 6px' : '4px 8px',
    }}>
      -{percent}%
    </span>
  );
}

export function formatGamePrice(game) {
  if (game.is_free) return { label: 'Free', hasSale: false };
  const hasSale = game.discount_active > 0 && game.sale_price != null;
  const base = parseFloat(game.price) || 0;
  return {
    hasSale,
    base,
    sale: hasSale ? game.sale_price : base,
    label: hasSale ? `$${game.sale_price.toFixed(2)}` : `$${base.toFixed(2)}`,
  };
}
