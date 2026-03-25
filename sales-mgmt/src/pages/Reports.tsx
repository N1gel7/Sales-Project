import { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Heart, 
  MessageCircle, 
  Share2,
  Download,
  Eye,
  Calendar,
  User,
  Tag,
  Image,
  File,
  Video,
  Music,
  X
} from 'lucide-react';

interface User {
  _id: string;
  name: string;
  role: string;
}

interface Attachment {
  filename: string;
  url: string;
  type: string;
  size: number;
  thumbnail?: string;
}

interface Comment {
  _id: string;
  author: {
    id: string;
    name: string;
  };
  content: string;
  createdAt: string;
}

interface Report {
  _id: string;
  title: string;
  description: string;
  type: 'mood_board' | 'summary_report' | 'sales_report' | 'client_feedback';
  author: {
    id: string;
    name: string;
    role: string;
  };
  attachments: Attachment[];
  tags: string[];
  location?: {
    lat: number;
    lng: number;
    address: string;
  };
  client?: {
    name: string;
    contact: string;
    email: string;
  };
  project?: {
    name: string;
    description: string;
    status: 'ongoing' | 'completed' | 'on_hold';
  };
  visibility: 'public' | 'team' | 'private';
  status: 'draft' | 'published' | 'archived';
  comments: Comment[];
  likes: Array<{
    user: string;
    likedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('published');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showAuthorDetails, setShowAuthorDetails] = useState(false);
  const [selectedAuthor, setSelectedAuthor] = useState<any>(null);

  // New report form state
  const [newReport, setNewReport] = useState({
    title: '',
    description: '',
    type: 'mood_board' as const,
    tags: [] as string[],
    visibility: 'team' as const,
    location: { lat: 0, lng: 0, address: '' },
    client: { name: '', contact: '', email: '' },
    project: { name: '', description: '', status: 'ongoing' as const }
  });

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
    
    loadReports();
  }, [filterType, filterStatus]);

  async function loadReports() {
    try {
      const params = new URLSearchParams();
      if (filterType) params.append('type', filterType);
      if (filterStatus) params.append('status', filterStatus);
      
      const response = await fetch(`/api/reports?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      const data = await response.json();
      setReports(data);
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createReport() {
    if (!newReport.title.trim()) {
      alert('Please enter a report title');
      return;
    }

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(newReport)
      });

      if (response.ok) {
        const report = await response.json();
        setReports(prev => [report, ...prev]);
        setShowCreateForm(false);
        setNewReport({
          title: '',
          description: '',
          type: 'mood_board',
          tags: [],
          visibility: 'team',
          location: { lat: 0, lng: 0, address: '' },
          client: { name: '', contact: '', email: '' },
          project: { name: '', description: '', status: 'ongoing' }
        });
      } else {
        const errorData = await response.json();
        alert('Failed to create report: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to create report:', error);
      alert('Failed to create report: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }


  async function toggleLike(reportId: string) {
    try {
      const response = await fetch(`/api/reports/${reportId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (response.ok) {
        const { liked } = await response.json();
        setReports(prev => prev.map(report => 
          report._id === reportId 
            ? { 
                ...report, 
                likes: liked 
                  ? [...report.likes, { user: currentUserId || '', likedAt: new Date().toISOString() }]
                  : report.likes.filter(like => like.user !== currentUserId)
              }
            : report
        ));
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  }

  function getAttachmentIcon(type: string) {
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (type.startsWith('video/')) return <Video className="h-4 w-4" />;
    if (type.startsWith('audio/')) return <Music className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  }


  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  const filteredReports = reports.filter(report =>
    report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Mood Boards</h1>
          <p className="text-gray-600">Share insights, mood boards, and team reports</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          Create Report
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-64">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          <option value="mood_board">Mood Board</option>
          <option value="summary_report">Summary Report</option>
          <option value="sales_report">Sales Report</option>
          <option value="client_feedback">Client Feedback</option>
        </select>
        
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredReports.map((report) => (
          <div key={report._id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Report Header */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {report.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">
                    {report.description}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <User className="h-3 w-3" />
                    <span 
                      className="cursor-pointer hover:text-blue-600 hover:underline"
                      onClick={() => {
                        setSelectedAuthor(report.author);
                        setShowAuthorDetails(true);
                      }}
                    >
                      {report.author.name}
                    </span>
                    <Calendar className="h-3 w-3 ml-2" />
                    <span>{formatDate(report.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleLike(report._id)}
                    className={`p-1 rounded ${
                      report.likes.some(like => like.user === currentUserId)
                        ? 'text-red-500' 
                        : 'text-gray-400 hover:text-red-500'
                    }`}
                  >
                    <Heart className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-gray-500">{report.likes.length}</span>
                </div>
              </div>
            </div>

            {/* Attachments Preview */}
            {report.attachments.length > 0 && (
              <div className="p-4">
                <div className="grid grid-cols-2 gap-2">
                  {report.attachments.slice(0, 4).map((attachment, index) => (
                    <div key={index} className="relative group">
                      {attachment.type.startsWith('image/') ? (
                        <img
                          src={attachment.thumbnail || attachment.url}
                          alt={attachment.filename}
                          className="w-full h-20 object-cover rounded border border-gray-200"
                        />
                      ) : (
                        <div className="w-full h-20 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                          {getAttachmentIcon(attachment.type)}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  ))}
                  {report.attachments.length > 4 && (
                    <div className="w-full h-20 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                      <span className="text-sm text-gray-500">
                        +{report.attachments.length - 4} more
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tags */}
            {report.tags.length > 0 && (
              <div className="px-4 pb-2">
                <div className="flex flex-wrap gap-1">
                  {report.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                    >
                      <Tag className="h-3 w-3 mr-1" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-4 w-4" />
                    {report.comments.length}
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="h-4 w-4" />
                    {report.likes.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-1 text-gray-400 hover:text-gray-600">
                    <Share2 className="h-4 w-4" />
                  </button>
                  <button className="p-1 text-gray-400 hover:text-gray-600">
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredReports.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No reports found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm ? 'Try adjusting your search terms' : 'Create your first report to get started'}
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Report
          </button>
        </div>
      )}

      {/* Create Report Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Create New Report</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={newReport.title}
                    onChange={(e) => setNewReport(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter report title"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newReport.description}
                    onChange={(e) => setNewReport(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Describe your report..."
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type *
                    </label>
                    <select
                      value={newReport.type}
                      onChange={(e) => setNewReport(prev => ({ ...prev, type: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="mood_board">Mood Board</option>
                      <option value="summary_report">Summary Report</option>
                      <option value="sales_report">Sales Report</option>
                      <option value="client_feedback">Client Feedback</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Visibility
                    </label>
                    <select
                      value={newReport.visibility}
                      onChange={(e) => setNewReport(prev => ({ ...prev, visibility: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="team">Team</option>
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags
                  </label>
                  <input
                    type="text"
                    placeholder="Enter tags separated by commas"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const tags = e.currentTarget.value.split(',').map(tag => tag.trim()).filter(tag => tag);
                        setNewReport(prev => ({ ...prev, tags: [...prev.tags, ...tags] }));
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  {newReport.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {newReport.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                        >
                          {tag}
                          <button
                            onClick={() => setNewReport(prev => ({ 
                              ...prev, 
                              tags: prev.tags.filter((_, i) => i !== index) 
                            }))}
                            className="ml-1 text-blue-600 hover:text-blue-800"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createReport}
                  disabled={!newReport.title.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Author Details Modal */}
      {showAuthorDetails && selectedAuthor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Author Details</h3>
              <button
                onClick={() => setShowAuthorDetails(false)}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-lg font-medium text-blue-600">
                    {selectedAuthor.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-lg">
                    {selectedAuthor.name || 'Unknown User'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {selectedAuthor.role || 'Member'}
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Role:</span>
                  <span className="text-sm font-medium">{selectedAuthor.role || 'Member'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">User ID:</span>
                  <span className="text-sm font-mono text-gray-500">{selectedAuthor.id || 'N/A'}</span>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowAuthorDetails(false)}
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
