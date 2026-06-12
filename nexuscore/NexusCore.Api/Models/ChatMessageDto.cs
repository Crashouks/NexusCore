namespace NexusCore.Api.Models;

public class ChatMessageDto
{
    public int MessageId { get; set; }
    public int ChatId { get; set; }
    public int UserId { get; set; }
    public string Text { get; set; } = "";
    public DateTime SentAt { get; set; }
    public bool IsRead { get; set; }
    public string Username { get; set; } = "";
    public string? AvatarUrl { get; set; }

    public static ChatMessageDto FromDynamic(dynamic row) => new()
    {
        MessageId = (int)row.message_id,
        ChatId = (int)row.chat_id,
        UserId = (int)row.user_id,
        Text = (string)row.text,
        SentAt = (DateTime)row.sent_at,
        IsRead = Services.DbValue.IsTrue(row.is_read),
        Username = (string)row.username,
        AvatarUrl = row.avatar_url as string,
    };
}
