namespace NexusCore.Api.Services;

public static class PricingService
{
    private static bool IsFree(IDictionary<string, object?> game) =>
        game.TryGetValue("is_free", out var v) && DbValue.IsTrue(v);

    public static int GetActiveStoreDiscount(IDictionary<string, object?>? game)
    {
        if (game == null || IsFree(game)) return 0;
        if (!game.TryGetValue("discount_percent", out var pctObj) || pctObj == null) return 0;
        var pct = Convert.ToInt32(pctObj);
        if (pct <= 0 || pct >= 100) return 0;
        if (game.TryGetValue("discount_expires_at", out var exp) && exp != null &&
            Convert.ToDateTime(exp) < DateTime.UtcNow) return 0;
        return pct;
    }

    public static int GetActiveStoreDiscount(dynamic? game) =>
        game == null ? 0 : GetActiveStoreDiscount(RowToDict(game));

    public static decimal? GetSalePrice(IDictionary<string, object?>? game)
    {
        if (game == null || IsFree(game)) return null;
        var discount = GetActiveStoreDiscount(game);
        if (discount <= 0) return null;
        var basePrice = Convert.ToDecimal(game["price"]);
        return Math.Round(basePrice * (1 - discount / 100m), 2);
    }

    public static decimal GetPurchasePrice(IDictionary<string, object?>? game, bool applyTrialDiscount = false)
    {
        if (game == null || IsFree(game)) return 0;
        var sale = GetSalePrice(game);
        if (sale != null) return sale.Value;
        var price = Convert.ToDecimal(game["price"]);
        if (applyTrialDiscount)
        {
            var td = game.TryGetValue("trial_discount_percent", out var t) && t != null
                ? Convert.ToInt32(t) : 10;
            price = Math.Round(price * (1 - td / 100m), 2);
        }
        return price;
    }

    public static decimal GetPurchasePrice(dynamic? game, bool applyTrialDiscount = false) =>
        game == null ? 0 : GetPurchasePrice(RowToDict(game), applyTrialDiscount);

    public static IDictionary<string, object?> EnrichGame(IDictionary<string, object?> game)
    {
        game["discount_active"] = GetActiveStoreDiscount(game);
        game["sale_price"] = GetSalePrice(game);
        return game;
    }

    public static IDictionary<string, object?> RowToDict(dynamic row)
    {
        var dict = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (var kv in (IDictionary<string, object>)row)
            dict[kv.Key] = kv.Value is DBNull ? null : kv.Value;
        return dict;
    }

    public static List<IDictionary<string, object?>> EnrichGames(IEnumerable<dynamic> rows)
    {
        var list = new List<IDictionary<string, object?>>();
        foreach (var row in rows)
            list.Add(EnrichGame(RowToDict(row)));
        return list;
    }
}
