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
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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

interface UploadOption {
  _id: string;
  filename: string;
  type: string;
  fileUrl: string | null;
  createdAt: string;
}

type NewReportForm = {
  title: string;
  description: string;
  type: Report['type'];
  status: Report['status'];
  attachments: Attachment[];
  tags: string[];
  visibility: Report['visibility'];
  location: { lat: number; lng: number; address: string };
  client: { name: string; contact: string; email: string };
  project: { name: string; description: string; status: 'ongoing' | 'completed' | 'on_hold' };
};

const emptyReportForm = (): NewReportForm => ({
  title: '',
  description: '',
  type: 'mood_board',
  status: 'published',
  attachments: [],
  tags: [],
  visibility: 'team',
  location: { lat: 0, lng: 0, address: '' },
  client: { name: '', contact: '', email: '' },
  project: { name: '', description: '', status: 'ongoing' },
});

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('published');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [detailReport, setDetailReport] = useState<Report | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showAuthorDetails, setShowAuthorDetails] = useState(false);
  const [selectedAuthor, setSelectedAuthor] = useState<any>(null);
  const [availableUploads, setAvailableUploads] = useState<UploadOption[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(false);
  const [uploadSearchTerm, setUploadSearchTerm] = useState('');

  const [newReport, setNewReport] = useState<NewReportForm>(emptyReportForm);

  useEffect(() => {
    // Get current user ID from localStorage
    const userInfo = localStorage.getItem('user_info');
    if (userInfo) {
      try {
        const user = JSON.parse(userInfo);
        setCurrentUserId(user._id || user.id);
      } catch (error) {
        console.error('Failed to parse user info:', error);
      }
    }
    
    loadReports();
  }, [filterType, filterStatus]);

  useEffect(() => {
    if (showCreateForm && availableUploads.length === 0 && !loadingUploads) {
      loadUploadsForMoodBoard();
    }
  }, [showCreateForm]);

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
      const normalized = (Array.isArray(data) ? data : []).map((report: Report) => ({
        ...report,
        comments: Array.isArray(report.comments) ? report.comments : [],
        likes: Array.isArray(report.likes) ? report.likes : [],
        attachments: Array.isArray(report.attachments) ? report.attachments : [],
        tags: Array.isArray(report.tags) ? report.tags : []
      }));
      setReports(normalized);
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createReport() {
    if (!newReport.title.trim()) {
      toast.error('Enter a report title.');
      return;
    }
    if (newReport.type === 'mood_board' && newReport.attachments.length === 0) {
      toast.error('Add at least one media item for a mood board.');
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
        setNewReport(emptyReportForm());
        toast.success('Report created.');
      } else {
        const errorData = await response.json();
        toast.error(typeof errorData.error === 'string' ? errorData.error : 'Could not create report.');
      }
    } catch (error) {
      console.error('Failed to create report:', error);
      toast.error(error instanceof Error ? error.message : 'Could not create report.');
    }
  }


  async function toggleLike(reportId: string) {
    try {
      const response = await fetch('/api/reports', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ reportId })
      });

      if (response.ok) {
        const { likes } = await response.json();
        setReports(prev => prev.map(report =>
          report._id === reportId
            ? { ...report, likes: Array.isArray(likes) ? likes : [] }
            : report
        ));
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  }

  async function loadUploadsForMoodBoard() {
    setLoadingUploads(true);
    try {
      const response = await fetch('/api/uploads', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch uploads');
      const data = await response.json();
      const uploads = (Array.isArray(data) ? data : []).map((item: any) => ({
        _id: item._id,
        filename: item.filename || 'Untitled',
        type: item.type || 'application/octet-stream',
        fileUrl: item.fileUrl || null,
        createdAt: item.createdAt || new Date().toISOString(),
      }));
      setAvailableUploads(uploads.filter((u: UploadOption) => !!u.fileUrl));
    } catch (error) {
      console.error('Failed to load uploads:', error);
    } finally {
      setLoadingUploads(false);
    }
  }

  function isAttachmentSelected(fileUrl: string | null) {
    if (!fileUrl) return false;
    return newReport.attachments.some((a) => a.url === fileUrl);
  }

  function toggleMoodBoardAttachment(upload: UploadOption) {
    if (!upload.fileUrl) return;
    const exists = isAttachmentSelected(upload.fileUrl);
    if (exists) {
      setNewReport(prev => ({
        ...prev,
        attachments: prev.attachments.filter((a) => a.url !== upload.fileUrl)
      }));
      return;
    }
    setNewReport(prev => ({
      ...prev,
      attachments: [
        ...prev.attachments,
        {
          filename: upload.filename,
          url: upload.fileUrl!,
          type: upload.type,
          size: 0
        }
      ]
    }));
  }

  function getAttachmentIcon(type: string) {
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (type.startsWith('video/')) return <Video className="h-4 w-4" />;
    if (type.startsWith('audio/')) return <Music className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  }

  function typeLabel(t: Report['type']) {
    const labels: Record<Report['type'], string> = {
      mood_board: 'Mood board',
      summary_report: 'Summary',
      sales_report: 'Sales report',
      client_feedback: 'Client feedback',
    };
    return labels[t] ?? t;
  }

  function typeBadgeClass(t: Report['type']) {
    const map: Record<Report['type'], string> = {
      mood_board: 'bg-[var(--accent-amber-light)] text-[var(--accent-amber)] border-[var(--accent-amber)]/25',
      summary_report: 'bg-[var(--accent-blue-light)] text-[var(--accent-blue)] border-[var(--accent-blue)]/25',
      sales_report: 'bg-[var(--brand-green-light)] text-[var(--brand-green-dark)] border-[var(--brand-green)]/30',
      client_feedback: 'bg-violet-100 text-violet-800 border-violet-200/80',
    };
    return map[t] ?? map.summary_report;
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--color-border-tertiary)] bg-[var(--surface)] p-4">
            <Skeleton className="mb-2 h-4 w-24" />
            <Skeleton className="mb-3 h-6 w-full max-w-md" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Share insights, mood boards, and client feedback.</p>
        <Button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className="bg-[var(--brand-green)] text-white hover:bg-[var(--brand-green-dark)]"
        >
          <Plus className="mr-2 h-4 w-4" />
          New report
        </Button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative min-w-0 flex-1 lg:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search title, description, tags…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {(['', 'mood_board', 'summary_report', 'sales_report', 'client_feedback'] as const).map((val) => {
            const label =
              val === ''
                ? 'All types'
                : val === 'mood_board'
                  ? 'Mood board'
                  : val === 'summary_report'
                    ? 'Summary'
                    : val === 'sales_report'
                      ? 'Sales'
                      : 'Feedback';
            return (
              <button
                key={val || 'all'}
                type="button"
                onClick={() => setFilterType(val)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  filterType === val
                    ? 'bg-[var(--brand-dark)] text-white'
                    : 'bg-[var(--surface)] text-muted-foreground shadow-sm border border-[var(--color-border-tertiary)]'
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1">
          {(['published', 'draft', 'archived'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterStatus(s)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium capitalize',
                filterStatus === s
                  ? 'bg-[var(--brand-dark)] text-white'
                  : 'bg-[var(--surface-2)] text-muted-foreground'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredReports.map((report) => (
          <div
            key={report._id}
            role="button"
            tabIndex={0}
            onClick={() => setDetailReport(report)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setDetailReport(report);
              }
            }}
            className="cursor-pointer overflow-hidden rounded-xl border border-[var(--color-border-tertiary)] bg-[var(--surface)] shadow-sm transition-all hover:border-[var(--color-border-primary)] hover:shadow-md"
          >
            <div className="border-b border-[var(--color-border-tertiary)] p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'mb-2 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      typeBadgeClass(report.type)
                    )}
                  >
                    {typeLabel(report.type)}
                  </span>
                  <h3 className="mb-1 text-[15px] font-semibold leading-snug text-foreground">{report.title}</h3>
                  <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">{report.description}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3 shrink-0" />
                    <span
                      className="cursor-pointer hover:text-[var(--brand-green)] hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAuthor(report.author);
                        setShowAuthorDetails(true);
                      }}
                    >
                      {report.author.name}
                    </span>
                    <Calendar className="ml-1 h-3 w-3 shrink-0" />
                    <span>{formatDate(report.createdAt)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggleLike(report._id);
                    }}
                    className={cn(
                      'rounded p-1 transition-colors',
                      report.likes.some((like) => like.user === currentUserId)
                        ? 'text-red-600'
                        : 'text-muted-foreground hover:text-red-600'
                    )}
                  >
                    <Heart
                      className={cn(
                        'h-4 w-4',
                        report.likes.some((like) => like.user === currentUserId) && 'fill-current'
                      )}
                    />
                  </button>
                  <span className="text-xs text-muted-foreground">{report.likes.length}</span>
                </div>
              </div>
            </div>

            {/* Attachments Preview */}
            {report.attachments.length > 0 && (
              <div className={report.type === 'mood_board' ? '' : 'p-4'}>
                <div className={
                  report.type === 'mood_board' 
                    ? `grid ${report.attachments.length === 1 ? 'grid-cols-1' : report.attachments.length === 2 ? 'grid-cols-2' : 'grid-cols-2'} gap-0.5`
                    : 'grid grid-cols-2 gap-2'
                }>
                  {report.attachments.slice(0, 4).map((attachment, index) => (
                    <div key={index} className={`relative group ${report.type === 'mood_board' && index === 0 && report.attachments.length === 3 ? 'col-span-2' : ''}`}>
                      {attachment.type.startsWith('image/') || attachment.type.startsWith('video/') ? (
                        <img
                          src={attachment.thumbnail || attachment.url}
                          alt={attachment.filename}
                          className={
                            report.type === 'mood_board'
                              ? `w-full object-cover transition-transform duration-500 group-hover:scale-105 ${report.attachments.length === 1 ? 'h-64' : 'h-32'}`
                              : 'w-full h-20 object-cover rounded border border-gray-200'
                          }
                        />
                      ) : (
                        <div className={`w-full bg-gray-100 flex items-center justify-center ${report.type === 'mood_board' ? 'h-32' : 'h-20 rounded border border-gray-200'}`}>
                          {getAttachmentIcon(attachment.type)}
                        </div>
                      )}
                      <div className={`absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${report.type !== 'mood_board' ? 'rounded' : ''}`}>
                        <Eye className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  ))}
                  {report.attachments.length > 4 && (
                    <div className={`w-full bg-gray-100 flex items-center justify-center relative group overflow-hidden ${report.type === 'mood_board' ? 'h-32' : 'h-20 rounded border border-gray-200'}`}>
                      {report.type === 'mood_board' && report.attachments[4]?.type.startsWith('image/') && (
                        <img src={report.attachments[4].thumbnail || report.attachments[4].url} className="absolute inset-0 w-full h-full object-cover opacity-40 blur-sm" />
                      )}
                      <span className="text-sm font-semibold text-gray-700 relative z-10 bg-white/80 px-2 py-1 rounded">
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
                      className="inline-flex items-center rounded-full border border-[var(--brand-green)]/25 bg-[var(--brand-green-light)] px-2 py-1 text-xs text-[var(--brand-green-dark)]"
                    >
                      <Tag className="mr-1 h-3 w-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-[var(--color-border-tertiary)] bg-[var(--surface-2)]/60 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-4 w-4" />
                    {report.comments.length}
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="h-4 w-4" />
                    {report.likes.length}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="p-1 text-muted-foreground hover:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="p-1 text-muted-foreground hover:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredReports.length === 0 && (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-[var(--color-border-tertiary)] bg-[var(--surface)] py-14 text-center">
          <FileText className="mx-auto mb-4 h-14 w-14 text-muted-foreground/35" />
          <h3 className="mb-2 text-lg font-medium text-foreground">No reports found</h3>
          <p className="mb-4 max-w-sm text-sm text-muted-foreground">
            {searchTerm ? 'Try a different search or clear filters.' : 'Create your first report to get started.'}
          </p>
          <Button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="bg-[var(--brand-green)] text-white hover:bg-[var(--brand-green-dark)]"
          >
            New report
          </Button>
        </div>
      )}

      <Sheet open={showCreateForm} onOpenChange={setShowCreateForm}>
        <SheetContent side="right" className="w-full max-w-lg overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="page-title text-left">New report</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Title *</label>
              <Input
                value={newReport.title}
                onChange={(e) => setNewReport((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Report title"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Description</label>
              <Textarea
                value={newReport.description}
                onChange={(e) => setNewReport((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
                placeholder="Summary for your team…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Type</label>
                <select
                  value={newReport.type}
                  onChange={(e) => setNewReport((prev) => ({ ...prev, type: e.target.value as Report['type'] }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="mood_board">Mood board</option>
                  <option value="summary_report">Summary report</option>
                  <option value="sales_report">Sales report</option>
                  <option value="client_feedback">Client feedback</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Visibility</label>
                <select
                  value={newReport.visibility}
                  onChange={(e) =>
                    setNewReport((prev) => ({ ...prev, visibility: e.target.value as Report['visibility'] }))
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="team">Team</option>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>
            </div>

            {newReport.type === 'mood_board' && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium">Mood board media *</label>
                  <span className="text-xs text-muted-foreground">{newReport.attachments.length} selected</span>
                </div>
                <Input
                  value={uploadSearchTerm}
                  onChange={(e) => setUploadSearchTerm(e.target.value)}
                  placeholder="Filter uploads…"
                  className="mb-3"
                />
                {loadingUploads ? (
                  <p className="py-3 text-sm text-muted-foreground">Loading uploads…</p>
                ) : (
                  <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto rounded-md border border-[var(--color-border-tertiary)] p-2 sm:grid-cols-3">
                    {availableUploads
                      .filter((u) => u.filename.toLowerCase().includes(uploadSearchTerm.toLowerCase()))
                      .slice(0, 60)
                      .map((upload) => {
                        const selected = isAttachmentSelected(upload.fileUrl);
                        const isImage = upload.type.startsWith('image/');
                        return (
                          <button
                            key={upload._id}
                            type="button"
                            onClick={() => toggleMoodBoardAttachment(upload)}
                            className={cn(
                              'relative overflow-hidden rounded-md border text-left transition-shadow',
                              selected
                                ? 'border-[var(--brand-green)] ring-2 ring-[var(--brand-green)]/25'
                                : 'border-[var(--color-border-tertiary)] hover:border-[var(--color-border-primary)]'
                            )}
                          >
                            {isImage ? (
                              <img
                                src={upload.fileUrl || ''}
                                alt=""
                                className="h-20 w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-20 w-full items-center justify-center bg-[var(--surface-2)] text-muted-foreground">
                                {getAttachmentIcon(upload.type)}
                              </div>
                            )}
                            <div className="p-1.5">
                              <p className="truncate text-[11px] text-foreground">{upload.filename}</p>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium">Tags</label>
              <Input
                placeholder="Comma-separated, press Enter"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = (e.target as HTMLInputElement).value;
                    const tags = v
                      .split(',')
                      .map((tag) => tag.trim())
                      .filter(Boolean);
                    if (tags.length) {
                      setNewReport((prev) => ({ ...prev, tags: [...prev.tags, ...tags] }));
                      (e.target as HTMLInputElement).value = '';
                    }
                  }
                }}
              />
              {newReport.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {newReport.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center rounded-full border border-[var(--brand-green)]/30 bg-[var(--brand-green-light)] px-2 py-1 text-xs text-[var(--brand-green-dark)]"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() =>
                          setNewReport((prev) => ({
                            ...prev,
                            tags: prev.tags.filter((_, i) => i !== index),
                          }))
                        }
                        className="ml-1 text-[var(--brand-green-dark)] hover:opacity-80"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="mt-8 flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreateForm(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!newReport.title.trim()}
              className="flex-1 bg-[var(--brand-green)] text-white hover:bg-[var(--brand-green-dark)]"
              onClick={() => void createReport()}
            >
              Create
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={showAuthorDetails} onOpenChange={setShowAuthorDetails}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="page-title text-left">Author</SheetTitle>
          </SheetHeader>
          {selectedAuthor && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border-tertiary)] bg-[var(--surface-2)] p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-green-light)] text-lg font-medium text-[var(--brand-green-dark)]">
                  {selectedAuthor.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="font-medium text-foreground">{selectedAuthor.name || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">{selectedAuthor.role || 'Member'}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between border-b border-[var(--color-border-tertiary)] py-2">
                  <span className="text-muted-foreground">Role</span>
                  <span className="font-medium">{selectedAuthor.role || '—'}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--color-border-tertiary)] py-2">
                  <span className="text-muted-foreground">User ID</span>
                  <span className="font-mono text-xs text-muted-foreground">{selectedAuthor.id || '—'}</span>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={!!detailReport} onOpenChange={(o) => !o && setDetailReport(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="page-title text-left">{detailReport?.title}</SheetTitle>
          </SheetHeader>
          {detailReport && (
            <div className="mt-6 space-y-4">
              <span className={cn('inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase', typeBadgeClass(detailReport.type))}>
                {typeLabel(detailReport.type)}
              </span>
              <p className="text-sm text-muted-foreground">{detailReport.description}</p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{detailReport.author.name}</span>
                <span>·</span>
                <span>{formatDate(detailReport.createdAt)}</span>
              </div>
              {detailReport.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {detailReport.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="rounded-full border border-[var(--brand-green)]/25 bg-[var(--brand-green-light)] px-2 py-0.5 text-xs text-[var(--brand-green-dark)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {detailReport.attachments.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {detailReport.attachments.slice(0, 8).map((a, i) => (
                    <div key={i} className="overflow-hidden rounded-lg border border-[var(--color-border-tertiary)]">
                      {a.type.startsWith('image/') ? (
                        <img src={a.thumbnail || a.url} alt="" className="h-24 w-full object-cover" />
                      ) : (
                        <div className="flex h-24 items-center justify-center bg-[var(--surface-2)]">
                          {getAttachmentIcon(a.type)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {detailReport.comments.length} comments · {detailReport.likes.length} reactions
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
