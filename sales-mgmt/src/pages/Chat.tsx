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
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold">Messages</h1>
            <button
              onClick={() => setShowNewChat(true)}
              className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {filteredChats.map((chat) => (
            <div
              key={chat._id}
              onClick={() => setSelectedChat(chat)}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                selectedChat?._id === chat._id ? 'bg-blue-50 border-blue-200' : ''
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {chat.name}
                    </h3>
                    {getUnreadCount(chat) > 0 && (
                      <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-1">
                        {getUnreadCount(chat)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    {chat.lastMessage?.content || 'No messages yet'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {chat.lastMessage?.sentAt ? formatTime(chat.lastMessage.sentAt) : ''}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div 
                    className="cursor-pointer hover:bg-gray-50 p-2 rounded-lg -m-2"
                    onClick={() => setShowParticipants(true)}
                  >
                    <h2 className="text-lg font-semibold">{selectedChat.name}</h2>
                    <p className="text-sm text-gray-500">
                      {selectedChat.participants.length} member{selectedChat.participants.length !== 1 ? 's' : ''} • Click to view
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => setShowParticipants(true)}
                    className="p-2 rounded-full hover:bg-gray-100"
                  >
                    <MoreVertical className="h-5 w-5 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {messages.map((message) => (
                <div
                  key={message._id}
                  className={`flex ${message.sender?.id === currentUserId ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                      message.sender?.id === currentUserId 
                        ? 'bg-blue-600 text-white rounded-br-sm shadow-sm' 
                        : 'bg-white text-gray-900 rounded-bl-sm border border-gray-200 shadow-sm'
                    }`}
                  >
                    {message.sender?.id !== currentUserId && (
                      <div className="flex items-center space-x-2 mb-1.5">
                        <span className="text-xs font-semibold text-blue-600">
                          {message.sender?.name || 'Unknown'}
                        </span>
                        <span className="text-[10px] text-gray-400">
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
                      <div className="flex justify-end mt-1 text-[10px] text-blue-200">
                        {formatTime(message.createdAt)}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing Indicator */}
              {typingText() && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 border border-gray-200 rounded-2xl px-4 py-2.5 flex items-center gap-2 shadow-sm">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                    <span className="text-xs text-gray-500 italic ml-1">{typingText()}…</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex items-end space-x-2">
                <button className="p-2.5 bg-gray-50 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors border border-gray-200 flex-shrink-0">
                  <Plus className="h-5 w-5" />
                </button>
                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-3xl pb-2 pt-2 px-4 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Message..."
                    className="w-full bg-transparent focus:outline-none text-[15px]"
                  />
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!messageText.trim() || sendingMessage}
                  className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingMessage ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
              <p className="text-gray-500">Choose a chat from the sidebar to start messaging</p>
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
