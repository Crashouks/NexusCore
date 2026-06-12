namespace NexusCore.Api.Services;

public static class DbValue
{
    public static bool IsTrue(object? value)
    {
        if (value is null or DBNull) return false;
        return value switch
        {
            bool b => b,
            sbyte or byte or short or ushort or int or uint or long or ulong => Convert.ToInt64(value) != 0,
            decimal or double or float => Convert.ToDouble(value) != 0,
            string s => s is "1" or "true" or "True",
            _ => false
        };
    }

}
