import { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, 
  Send, 
  Plus, 
  Users, 
  Search, 
  MoreVertical,
  Paperclip,
  Phone,
  Video,
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Get current user ID from token
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setCurrentUserId(payload.uid);
      } catch (error) {
        console.error('Failed to decode token:', error);
      }
    }
    
    loadChats();
    loadUsers();
  }, []);

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat._id);
    }
  }, [selectedChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function loadChats() {
    try {
      const response = await fetch('/api/chats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      const data = await response.json();
      setChats(data);
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }

  async function loadMessages(chatId: string) {
    try {
      const response = await fetch(`/api/chats/${chatId}/messages`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }

  async function sendMessage() {
    if (!messageText.trim() || !selectedChat || sendingMessage) return;

    setSendingMessage(true);
    try {
      const response = await fetch(`/api/chats/${selectedChat._id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          content: messageText,
          type: 'text'
        })
      });

      if (response.ok) {
        const newMessage = await response.json();
        setMessages(prev => [...prev, newMessage]);
        setMessageText('');
        loadChats(); // Refresh chat list to update last message
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          name: newChatName,
          type: selectedUsers.length === 1 ? 'direct' : 'group',
          participants: selectedUsers.map(userId => ({ user: userId }))
        })
      });

      if (response.ok) {
        const newChat = await response.json();
        setChats(prev => [newChat, ...prev]);
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

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  function getUnreadCount(_chat: Chat) {
    // This would need to be calculated based on readBy status
    return 0; // Placeholder
  }

  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                  <button className="p-2 rounded-full hover:bg-gray-100">
                    <Phone className="h-5 w-5 text-gray-600" />
                  </button>
                  <button className="p-2 rounded-full hover:bg-gray-100">
                    <Video className="h-5 w-5 text-gray-600" />
                  </button>
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
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message._id}
                  className={`flex ${message.sender.id === currentUserId ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.sender.id === currentUserId ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs font-medium">
                        {message.sender.name}
                      </span>
                      <span className="text-xs opacity-75">
                        {formatTime(message.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm">{message.content}</p>
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {message.attachments.map((attachment, index) => (
                          <div key={index} className="flex items-center space-x-2 text-xs">
                            <Paperclip className="h-3 w-3" />
                            <span>{attachment.filename}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-full hover:bg-gray-100"
                >
                  <Paperclip className="h-5 w-5 text-gray-600" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  multiple
                />
                <div className="flex-1">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
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
              
              {selectedChat.participants.map((participant, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600">
                      {participant.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {participant.user?.name || 'Unknown User'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {participant.user?.role || 'Member'} • {participant.role}
                    </p>
                  </div>
                  {participant.role === 'admin' && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      Admin
                    </span>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowParticipants(false)}
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
