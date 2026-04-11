import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageCircle, 
  Send, 
  Plus, 
  Users, 
  Search, 
  MoreVertical,
  X
} from 'lucide-react';

interface User {
  _id: string;
  id?: string;
  name: string;
  email: string;
  role: string;
}

interface Message {
  _id: string;
  sender: {
    id: string;
    name: string;
    role: string;
  };
  content: string;
  type: 'text' | 'image' | 'file' | 'report';
  attachments?: Array<{
    filename: string;
    url: string;
    type: string;
    size: number;
  }>;
  readBy: Array<{
    user: string;
    readAt: string;
  }>;
  createdAt: string;
  edited?: boolean;
  editedAt?: string;
}

interface Chat {
  _id: string;
  name: string;
  type: 'group' | 'direct';
  participants: Array<{
    user: User;
    role: 'admin' | 'member';
    joinedAt: string;
  }>;
  lastMessage?: {
    content: string;
    sender: User;
    sentAt: string;
  };
  isActive: boolean;
  createdBy: User;
  messages?: Message[];
}

interface Typer {
  id: string;
  name: string;
}

// ─── Polling intervals ────────────────────────────────────────
const MESSAGE_POLL_MS = 3000;
const CHAT_LIST_POLL_MS = 10000;
const TYPING_POLL_MS = 2000;
const TYPING_DEBOUNCE_MS = 2000;

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ChatPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newChatName, setNewChatName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const [typers, setTypers] = useState<Typer[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAtBottomRef = useRef(true);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // ── Track whether user is scrolled to bottom ─────────────────
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

  // ── Current user from localStorage ───────────────────────────
  useEffect(() => {
    const userInfo = localStorage.getItem('user_info');
    if (userInfo) {
      try {
        const user = JSON.parse(userInfo);
        setCurrentUserId(user._id || user.id);
      } catch (error) {
        console.error('Failed to parse user info:', error);
      }
    }
    loadChats();
    loadUsers();
  }, []);

  // ── Scroll to bottom on new messages (only if user was at bottom) ──
  useEffect(() => {
    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // ── Load on chat selection ───────────────────────────────────
  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat._id);
      isAtBottomRef.current = true;
    }
    setTypers([]);
  }, [selectedChat]);

  // ── POLLING: Chat list (every 10s) ───────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      loadChats(true);
    }, CHAT_LIST_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  // ── POLLING: Messages (every 3s when chat is open) ───────────
  useEffect(() => {
    if (!selectedChat) return;
    const chatId = selectedChat._id;

    const interval = setInterval(() => {
      pollMessages(chatId);
    }, MESSAGE_POLL_MS);

    return () => clearInterval(interval);
  }, [selectedChat]);

  // ── POLLING: Typing indicators (every 2s when chat is open) ──
  useEffect(() => {
    if (!selectedChat) return;
    const chatId = selectedChat._id;

    const interval = setInterval(() => {
      pollTyping(chatId);
    }, TYPING_POLL_MS);

    return () => clearInterval(interval);
  }, [selectedChat]);

  // ── Cleanup typing timeout on unmount ────────────────────────
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // ── Data fetchers ────────────────────────────────────────────
  async function loadChats(silent = false) {
    try {
      const response = await fetch('/api/chats', { headers: getAuthHeaders() });
      const data = await response.json();
      setChats(data);
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const response = await fetch('/api/users', { headers: getAuthHeaders() });
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }

  async function loadMessages(chatId: string) {
    try {
      const response = await fetch(`/api/chats/${chatId}/messages`, { headers: getAuthHeaders() });
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }

  async function pollMessages(chatId: string) {
    try {
      const response = await fetch(`/api/chats/${chatId}/messages`, { headers: getAuthHeaders() });
      if (!response.ok) return;
      const data: Message[] = await response.json();

      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m._id));
        const newMsgs = data.filter((m) => !existingIds.has(m._id));
        if (newMsgs.length === 0) return prev;
        return [...prev, ...newMsgs];
      });
    } catch {
      // silent fail on poll
    }
  }

  async function pollTyping(chatId: string) {
    try {
      const response = await fetch(`/api/typing?chatId=${chatId}`, { headers: getAuthHeaders() });
      if (!response.ok) return;
      const data: Typer[] = await response.json();
      setTypers(data);
    } catch {
      // silent fail
    }
  }

  // ── Typing state management ──────────────────────────────────
  function notifyTyping(isTyping: boolean) {
    if (!selectedChat) return;
    fetch('/api/typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ chatId: selectedChat._id, isTyping }),
    }).catch(() => {});
  }

  function handleInputChange(value: string) {
    setMessageText(value);

    // Debounced typing indicator
    notifyTyping(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      notifyTyping(false);
    }, TYPING_DEBOUNCE_MS);
  }

  // ── Send message ─────────────────────────────────────────────
  async function sendMessage() {
    if (!messageText.trim() || !selectedChat || sendingMessage) return;

    // Clear typing indicator immediately
    notifyTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    setSendingMessage(true);
    try {
      const response = await fetch(`/api/chats/${selectedChat._id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ content: messageText, type: 'text' }),
      });

      if (response.ok) {
        const newMessage = await response.json();
        setMessages((prev) => [...prev, newMessage]);
        setMessageText('');
        isAtBottomRef.current = true;
        loadChats(true);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSendingMessage(false);
    }
  }

  async function createChat() {
    if (!newChatName.trim() || selectedUsers.length === 0) {
      alert('Please enter a chat name and select at least one participant');
      return;
    }

    try {
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          name: newChatName,
          type: selectedUsers.length === 1 ? 'direct' : 'group',
          participants: selectedUsers.map((userId) => ({ user: userId })),
        }),
      });

      if (response.ok) {
        const newChat = await response.json();
        setChats((prev) => [newChat, ...prev]);
        setShowNewChat(false);
        setNewChatName('');
        setSelectedUsers([]);
        setSelectedChat(newChat);
      } else {
        const errorData = await response.json();
        alert('Failed to create chat: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to create chat:', error);
      alert('Failed to create chat: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function getUnreadCount(_chat: Chat) {
    return 0; // Placeholder
  }

  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── Typing indicator text ────────────────────────────────────
  function typingText(): string | null {
    if (typers.length === 0) return null;
    if (typers.length === 1) return `${typers[0].name} is typing`;
    if (typers.length === 2) return `${typers[0].name} and ${typers[1].name} are typing`;
    return `${typers[0].name} and ${typers.length - 1} others are typing`;
  }

  // ── Render ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-[var(--color-border-tertiary)] bg-[var(--surface)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand-green)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-[min(720px,calc(100vh-7rem))] min-h-[420px] overflow-hidden rounded-xl border border-[var(--color-border-tertiary)] bg-[var(--surface)] shadow-sm">
      <div className="flex w-[240px] shrink-0 flex-col bg-[var(--brand-dark)] text-white">
        <div className="border-b border-white/10 p-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="page-title text-lg text-white">Messages</h2>
            <button
              type="button"
              onClick={() => setShowNewChat(true)}
              className="rounded-full bg-[var(--brand-green)] p-2 text-white hover:opacity-90"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-white/5 py-2 pl-10 pr-3 text-sm text-white placeholder:text-white/40 focus:border-[var(--brand-green)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-green)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredChats.map((chat) => (
            <div
              key={chat._id}
              onClick={() => setSelectedChat(chat)}
              className={`cursor-pointer border-b border-white/10 p-3 transition-colors hover:bg-white/5 ${
                selectedChat?._id === chat._id ? 'bg-white/10' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Users className="h-5 w-5 text-white/90" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-sm font-medium text-white">{chat.name}</h3>
                    {getUnreadCount(chat) > 0 && (
                      <span className="shrink-0 rounded-full bg-[var(--brand-green)] px-2 py-0.5 text-[10px] font-semibold text-white">
                        {getUnreadCount(chat)}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-white/55">{chat.lastMessage?.content || 'No messages yet'}</p>
                  <p className="text-[10px] text-white/40">
                    {chat.lastMessage?.sentAt ? formatTime(chat.lastMessage.sentAt) : ''}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col bg-[var(--surface)]">
        {selectedChat ? (
          <>
            <div className="border-b border-[var(--color-border-tertiary)] bg-[var(--surface)] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-2)]">
                    <Users className="h-5 w-5 text-[var(--brand-green)]" />
                  </div>
                  <div
                    className="-m-2 cursor-pointer rounded-lg p-2 hover:bg-[var(--surface-2)]"
                    onClick={() => setShowParticipants(true)}
                  >
                    <h2 className="text-base font-semibold text-foreground">{selectedChat.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {selectedChat.participants.length} member{selectedChat.participants.length !== 1 ? 's' : ''} · online
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowParticipants(true)}
                  className="rounded-full p-2 hover:bg-[var(--surface-2)]"
                >
                  <MoreVertical className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 space-y-4 overflow-y-auto p-4"
            >
              {messages.map((message) => (
                <div
                  key={message._id}
                  className={`flex ${message.sender?.id === currentUserId ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs rounded-2xl px-4 py-3 lg:max-w-md ${
                      message.sender?.id === currentUserId
                        ? 'rounded-br-sm bg-[var(--brand-dark)] text-white shadow-sm'
                        : 'rounded-bl-sm border border-[var(--color-border-tertiary)] bg-[var(--surface-2)] text-foreground shadow-sm'
                    }`}
                  >
                    {message.sender?.id !== currentUserId && (
                      <div className="mb-1.5 flex items-center space-x-2">
                        <span className="text-xs font-semibold text-[var(--accent-blue)]">
                          {message.sender?.name || 'Unknown'}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatTime(message.createdAt)}
                        </span>
                      </div>
                    )}
                    
                    {/* Attachments rendering */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mb-2 grid gap-1 grid-cols-2">
                        {message.attachments.map((att, i) => (
                          <div key={i} className="relative group rounded-xl overflow-hidden border border-black/10">
                            {att.type.startsWith('image/') ? (
                              <img src={att.url} alt="attachment" className="w-full h-32 object-cover hover:scale-105 transition-transform" />
                            ) : (
                              <div className="w-full h-32 bg-gray-50 flex flex-col items-center justify-center text-gray-500">
                                <Plus className="h-6 w-6 mb-1" />
                                <span className="text-[10px] truncate px-2">{att.filename}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-[15px] leading-relaxed">{message.content}</p>
                    
                    {message.sender?.id === currentUserId && (
                      <div className="mt-1 flex justify-end text-[10px] text-white/70">
                        {formatTime(message.createdAt)}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {typingText() && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-border-tertiary)] bg-[var(--surface-2)] px-4 py-2.5 shadow-sm">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '0ms' }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '150ms' }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="ml-1 text-xs italic text-muted-foreground">{typingText()}…</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="sticky bottom-0 border-t border-[var(--color-border-tertiary)] bg-[var(--surface)] p-4">
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  className="shrink-0 rounded-full border border-[var(--color-border-tertiary)] bg-[var(--surface-2)] p-2.5 text-muted-foreground hover:border-[var(--brand-green)] hover:text-[var(--brand-green)]"
                >
                  <Plus className="h-5 w-5" />
                </button>
                <div className="flex-1 rounded-3xl border border-[var(--color-border-tertiary)] bg-[var(--surface-2)] px-4 py-2 transition-all focus-within:border-[var(--brand-green)] focus-within:ring-1 focus-within:ring-[var(--brand-green)]/30">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Message…"
                    className="w-full bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={!messageText.trim() || sendingMessage}
                  className="shrink-0 rounded-full bg-[var(--brand-green)] p-2.5 text-white hover:bg-[var(--brand-green-dark)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sendingMessage ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center bg-[var(--surface)]">
            <div className="text-center">
              <MessageCircle className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
              <h3 className="mb-2 text-lg font-medium text-foreground">Select a conversation</h3>
              <p className="text-sm text-muted-foreground">Choose a thread from the list to start messaging.</p>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create New Chat</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Chat Name
                </label>
                <input
                  type="text"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter chat name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Add Members
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md">
                  {users.map((user) => (
                    <label key={user._id} className="flex items-center p-2 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsers([...selectedUsers, user._id]);
                          } else {
                            setSelectedUsers(selectedUsers.filter(id => id !== user._id));
                          }
                        }}
                        className="mr-3"
                      />
                      <div>
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.role}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowNewChat(false)}
                className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createChat}
                disabled={!newChatName.trim() || selectedUsers.length === 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Participants Modal */}
      {showParticipants && selectedChat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Group Members</h3>
              <button
                onClick={() => setShowParticipants(false)}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="text-sm text-gray-600 mb-4">
                {selectedChat.participants.length} member{selectedChat.participants.length !== 1 ? 's' : ''} in this chat
              </div>
              
              {selectedChat.participants.map((participant, index) => {
                const uid = typeof participant.user === 'object' ? (participant.user?._id || participant.user?.id) : participant.user;
                const matchedUser = users.find(u => u._id === uid) || participant.user;
                const participantName = matchedUser?.name || 'Unknown User';
                const participantRole = matchedUser?.role || 'Member';
                
                return (
                <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600">
                      {participantName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {participantName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {participantRole} • {participant.role}
                    </p>
                  </div>
                  {participant.role === 'admin' && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      Admin
                    </span>
                  )}
                </div>
              )})}
            </div>

            {/* Add Members Section */}
            {(() => {
              const currentParticipantIds = new Set(
                selectedChat.participants.map((p: any) => {
                  const u = p.user;
                  return typeof u === 'object' ? (u?._id || u?.id) : u;
                })
              );
              const availableUsers = users.filter((u) => !currentParticipantIds.has(u._id));

              if (availableUsers.length === 0) return null;

              return (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">➕ Add Members</h4>
                  <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-lg">
                    {availableUsers.map((user) => (
                      <label key={user._id} className="flex items-center p-2.5 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUsers((prev) => [...prev, user._id]);
                            } else {
                              setSelectedUsers((prev) => prev.filter((id) => id !== user._id));
                            }
                          }}
                          className="mr-3 h-4 w-4 rounded border-gray-300"
                        />
                        <div>
                          <p className="text-sm font-medium">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.role}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {selectedUsers.length > 0 && (
                    <button
                      onClick={async () => {
                        try {
                          const response = await fetch(`/api/chats/${selectedChat._id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                            body: JSON.stringify({
                              addParticipants: selectedUsers.map((uid) => ({
                                user: uid,
                                role: 'member',
                                joinedAt: new Date().toISOString(),
                              })),
                            }),
                          });
                          if (response.ok) {
                            const updated = await response.json();
                            setSelectedChat({ ...selectedChat, participants: updated.participants || [] });
                            setChats((prev) =>
                              prev.map((c) => (c._id === selectedChat._id ? { ...c, participants: updated.participants || [] } : c))
                            );
                            setSelectedUsers([]);
                          } else {
                            const err = await response.json();
                            alert('Failed: ' + (err.error || 'Unknown error'));
                          }
                        } catch (error) {
                          alert('Failed to add members');
                        }
                      }}
                      className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                    >
                      Add {selectedUsers.length} member{selectedUsers.length !== 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              );
            })()}
            
            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => { setShowParticipants(false); setSelectedUsers([]); }}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
