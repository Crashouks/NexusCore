using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using NexusCore.Api.Extensions;
using NexusCore.Api.Services;

namespace NexusCore.Api.Hubs;

[Authorize]
public class ChatHub(ChatService chat) : Hub
{
    private static string GroupName(int chatId) => $"chat_{chatId}";

    public async Task JoinChat(int chatId)
    {
        var userId = Context.User!.GetUserId();
        try
        {
            await chat.EnsureChatAccessAsync(userId, chatId);
        }
        catch (UnauthorizedAccessException)
        {
            throw new HubException("Not allowed to join this chat");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(chatId));
        await Clients.Caller.SendAsync("JoinedChat", chatId);
    }

    public async Task LeaveChat(int chatId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(chatId));
        await Clients.Caller.SendAsync("LeftChat", chatId);
    }

    public async Task SendMessage(int chatId, string message)
    {
        var userId = Context.User!.GetUserId();
        if (!await chat.IsMemberAsync(userId, chatId))
            throw new HubException("You are not a member of this chat");

        var saved = await chat.SaveMessageAsync(chatId, userId, message);
        if (saved != null)
            await Clients.Group(GroupName(chatId)).SendAsync("ReceiveMessage", saved);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await base.OnDisconnectedAsync(exception);
    }
}
