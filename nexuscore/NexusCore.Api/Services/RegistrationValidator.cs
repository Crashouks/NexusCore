using System.Text.RegularExpressions;

namespace NexusCore.Api.Services;

public static partial class RegistrationValidator
{
    public static string? ValidateRegister(string? username, string? email, string? password)
    {
        if (string.IsNullOrWhiteSpace(username))
            return "Username is required";
        username = username.Trim();
        if (username.Length < 3 || username.Length > 50)
            return "Username must be 3–50 characters";
        if (!UsernameRegex().IsMatch(username))
            return "Username may only contain letters, numbers, and underscores";

        if (string.IsNullOrWhiteSpace(email))
            return "Email is required";
        email = email.Trim();
        if (!EmailRegex().IsMatch(email))
            return "Invalid email format";

        if (string.IsNullOrWhiteSpace(password))
            return "Password is required";
        if (password.Length < 8)
            return "Password must be at least 8 characters";
        if (!password.Any(char.IsLetter) || !password.Any(char.IsDigit))
            return "Password must contain at least one letter and one number";

        return null;
    }

    public static string? ValidateLogin(string? email, string? password)
    {
        if (string.IsNullOrWhiteSpace(email))
            return "Email is required";
        if (!EmailRegex().IsMatch(email.Trim()))
            return "Invalid email format";
        if (string.IsNullOrWhiteSpace(password))
            return "Password is required";
        return null;
    }

    [GeneratedRegex(@"^[a-zA-Z0-9_]+$")]
    private static partial Regex UsernameRegex();

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailRegex();
}
