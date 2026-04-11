import React, { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { Plus, Search, MapPin, GripVertical, X } from 'lucide-react';
import LocationText from '../components/LocationText';
import { getLocationLabel } from '../utils/locationLabel';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Task = {
  _id: string;
  title: string;
  description?: string;
  assignee: { id: string; name: string; code: string; email: string } | null;
  createdBy: { id: string; name: string; code: string; email: string } | null;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  dueAt?: string;
  location?: { name?: string; coords?: { lat: number; lng: number } };
  comments: Array<{ text: string; author: { name: string; code: string }; createdAt: string }>;
  createdAt: string;
  updatedAt: string;
};

type UserRow = {
  _id: string;
  name: string;
  code: string;
  email: string;
  role: string;
};

type ColId = 'pending' | 'in_progress' | 'completed';

const COLS: { id: ColId; label: string; labelClass: string; badgeClass: string }[] = [
  { id: 'pending', label: 'Pending', labelClass: 'text-muted-foreground', badgeClass: 'bg-muted text-muted-foreground' },
  { id: 'in_progress', label: 'Accepted / In Progress', labelClass: 'text-[var(--accent-blue)]', badgeClass: 'bg-[var(--accent-blue-light)] text-[var(--accent-blue)]' },
  { id: 'completed', label: 'Completed', labelClass: 'text-[var(--brand-green-dark)]', badgeClass: 'bg-[var(--brand-green-light)] text-[var(--brand-green-dark)]' },
];

function taskColumn(t: Task): ColId {
  if (t.status === 'completed') return 'completed';
  if (t.status === 'in_progress') return 'in_progress';
  return 'pending';
}

function colToApiStatus(col: ColId): Task['status'] {
  if (col === 'completed') return 'completed';
  if (col === 'in_progress') return 'in_progress';
  return 'pending';
}

function initials(n: string) {
  const p = n.trim().split(/\s+/);
  if (p.length === 0) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function rel(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function DroppableCol({
  id,
  children,
  className,
}: {
  id: ColId;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${id}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[320px] rounded-xl border border-dashed border-transparent bg-[var(--surface-2)]/50 p-2 transition-colors',
        isOver && 'border-[var(--brand-green)]/40 bg-[var(--brand-green-light)]/30',
        className
      )}
    >
      {children}
    </div>
  );
}

function DraggableCard({
  task,
  onOpen,
}: {
  task: Task;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task._id,
    data: { task },
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` }
    : undefined;
  const overdue = task.status === 'overdue' || (task.dueAt && new Date(task.dueAt) < new Date() && task.status !== 'completed');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'mb-2 flex gap-2 rounded-lg border border-[var(--color-border-tertiary)] bg-[var(--surface)] p-2 shadow-sm',
        'hover:border-[var(--color-border-primary)]',
        isDragging && 'opacity-60'
      )}
    >
      <button
        type="button"
        className="mt-1 shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...listeners}
        {...attributes}
        aria-label="Drag task"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen()}>
        <p className="text-[13px] font-medium leading-snug text-foreground">{task.title}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-[10px]">
              {task.assignee ? initials(task.assignee.name) : '?'}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">{task.assignee?.name ?? 'Unassigned'}</span>
          {task.dueAt && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {new Date(task.dueAt).toLocaleDateString()}
            </span>
          )}
          {overdue && <span className="rounded-full bg-[var(--accent-red-light)] px-2 py-0.5 text-[10px] text-[var(--accent-red)]">Overdue</span>}
        </div>
      </button>
    </div>
  );
}

export default function Tasks(): React.ReactElement {
  const userInfo = typeof window !== 'undefined' ? localStorage.getItem('user_info') : null;
  const userRole = userInfo ? JSON.parse(userInfo)?.role : null;
  const isSales = userRole === 'sales';
  const isManager = userRole === 'manager';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'mine' | 'overdue'>(isSales ? 'all' : 'all');
  const [userFilter, setUserFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assigneeId: '',
    dueAt: '',
    priority: 'medium',
    category: 'general',
    location: { name: '', coords: null as { lat: number; lng: number } | null },
  });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newComment, setNewComment] = useState('');
  const [activeDrag, setActiveDrag] = useState<Task | null>(null);
  const [wide, setWide] = useState(typeof window !== 'undefined' && window.innerWidth >= 1024);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);

  useEffect(() => {
    const onR = () => setWide(window.innerWidth >= 1024);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('user_info');
    if (raw) {
      try {
        const u = JSON.parse(raw) as { id?: string; _id?: string; name?: string };
        setCurrentUserId(u.id ?? u._id ?? null);
        setCurrentUserName(u.name ?? null);
      } catch {
        /* ignore */
      }
    }
  }, []);

  async function loadTasks() {
    setLoading(true);
    try {
      const response = await fetch(`/api/tasks`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
      });
      const data = await response.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Could not load tasks.');
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const response = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
      });
      const data = await response.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void loadTasks();
    void loadUsers();
  }, []);

  const uniqueUsers = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach(t => {
      if (t.assignee?.id) map.set(t.assignee.id, t.assignee.name || t.assignee.id);
    });
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [tasks]);

  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (isSales && currentUserId && task.assignee?.id !== currentUserId) return false;
      if (isSales && filter === 'overdue') {
        const o = task.status === 'overdue' || (task.dueAt && new Date(task.dueAt) < new Date() && task.status !== 'completed');
        if (!o) return false;
      }
      if (!isSales && userFilter !== 'all' && task.assignee?.id !== userFilter) return false;
      return true;
    });
  }, [tasks, searchTerm, filter, currentUserId, isSales, userFilter]);

  const byCol = useMemo(() => {
    const m: Record<ColId, Task[]> = { pending: [], in_progress: [], completed: [] };
    for (const t of filtered) {
      if (t.status === 'cancelled') continue;
      m[taskColumn(t)].push(t);
    }
    return m;
  }, [filtered]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function updateTaskStatus(taskId: string, status: Task['status']) {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        toast.success('Task updated');
        await loadTasks();
        if (selectedTask?._id === taskId) {
          const u = await fetch(`/api/tasks/${taskId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
          }).then((r) => r.json());
          setSelectedTask(u);
        }
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(typeof err.error === 'string' ? err.error : 'Could not update task.');
      }
    } catch {
      toast.error('Could not update task.');
    }
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveDrag(null);
    const { active, over } = e;
    if (!over) return;
    const taskId = String(active.id);
    let targetCol: ColId | null = null;
    const overId = String(over.id);
    if (overId.startsWith('col-')) {
      targetCol = overId.replace('col-', '') as ColId;
    } else {
      const hover = tasks.find((t) => t._id === overId);
      if (hover) targetCol = taskColumn(hover);
    }
    if (!targetCol) return;
    const t = tasks.find((x) => x._id === taskId);
    if (!t) return;
    const next = colToApiStatus(targetCol);
    if (t.status === next || (taskColumn(t) === targetCol && next === t.status)) return;
    if (t.status === 'overdue' && targetCol === 'pending') {
      void updateTaskStatus(taskId, 'pending');
      return;
    }
    void updateTaskStatus(taskId, next);
  }

  async function createTask() {
    if (!newTask.title || !newTask.assigneeId) {
      toast.error('Add a title and assignee.');
      return;
    }
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(newTask),
      });
      if (response.ok) {
        setNewTask({
          title: '',
          description: '',
          assigneeId: '',
          dueAt: '',
          priority: 'medium',
          category: 'general',
          location: { name: '', coords: null },
        });
        setShowCreate(false);
        await loadTasks();
        toast.success('Task created');
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(typeof err.error === 'string' ? err.error : 'Create failed');
      }
    } catch {
      toast.error('Create failed');
    }
  }

  async function addComment(taskId: string) {
    if (!newComment.trim()) return;
    try {
      const response = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ text: newComment }),
      });
      if (response.ok) {
        setNewComment('');
        await loadTasks();
        const updated = await fetch(`/api/tasks/${taskId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
        }).then((r) => r.json());
        setSelectedTask(updated);
        toast.success('Comment added');
      }
    } catch {
      toast.error('Could not add comment');
    }
  }

  function captureLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const locationLabel = await getLocationLabel(lat, lng);
        setNewTask((prev) => ({
          ...prev,
          location: { name: locationLabel || 'Current location', coords: { lat, lng } },
        }));
      },
      () => toast.error('Location unavailable')
    );
  }

  const computedStatus = selectedTask?.status === 'overdue' || (selectedTask?.dueAt && new Date(selectedTask.dueAt) < new Date() && selectedTask?.status !== 'completed') ? 'overdue' : selectedTask?.status;

  const detailPanel = selectedTask && (
    <div className="flex h-full min-h-0 flex-col border-l border-[var(--color-border-tertiary)] bg-[var(--surface)]">
      <div className="border-b border-[var(--color-border-tertiary)] p-4 flex justify-between items-start">
        <div>
          <p className="text-[14px] font-medium leading-snug">{selectedTask.title}</p>
          <div className="mt-2">
            <StatusBadge status={computedStatus || selectedTask.status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedTask.status === 'pending' && isSales && selectedTask.assignee?.id === currentUserId && (
            <Button 
              size="sm" 
              onClick={() => void updateTaskStatus(selectedTask._id, 'in_progress')}
              className="bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white"
            >
              Accept Task
            </Button>
          )}
          {selectedTask.status === 'in_progress' && isSales && selectedTask.assignee?.id === currentUserId && (
            <Button 
              size="sm" 
              onClick={() => void updateTaskStatus(selectedTask._id, 'completed')}
              className="bg-[var(--brand-green)] hover:bg-[var(--brand-green-dark)] text-white"
            >
              Mark Complete
            </Button>
          )}
          <button
            type="button"
            onClick={() => setSelectedTask(null)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--surface-2)] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Assigned to</p>
          <div className="mt-1 flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {selectedTask.assignee ? initials(selectedTask.assignee.name) : '?'}
              </AvatarFallback>
            </Avatar>
            <span>{selectedTask.assignee?.name ?? 'Unassigned'}</span>
          </div>
        </div>
        {selectedTask.dueAt && (
          <div>
            <p className="text-xs text-muted-foreground">Due</p>
            <p>{new Date(selectedTask.dueAt).toLocaleString()}</p>
          </div>
        )}
        {selectedTask.description && (
          <div>
            <p className="text-xs text-muted-foreground">Description</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{selectedTask.description}</p>
          </div>
        )}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Comments</p>
          <div className="space-y-3">
            {(selectedTask.comments || []).map((c, i) => {
              const mine = currentUserName && c.author?.name === currentUserName;
              return (
                <div
                  key={i}
                  className={cn('flex gap-2', mine && 'flex-row-reverse')}
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="text-[10px]">{initials(c.author?.name || '?')}</AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      'max-w-[85%] rounded-lg px-3 py-2 text-xs',
                      mine ? 'bg-[var(--brand-dark)] text-white' : 'bg-[var(--surface-2)] text-foreground'
                    )}
                  >
                    <p>{c.text}</p>
                    <p className={cn('mt-1 text-[10px] opacity-70', mine ? 'text-white/80' : 'text-muted-foreground')}>
                      {rel(c.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 lg:flex-row">
      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {isSales ? (
            <div className="flex gap-1 rounded-full border border-[var(--color-border-tertiary)] bg-[var(--surface)] p-0.5">
              {(['all', 'overdue'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium capitalize',
                    filter === f ? 'bg-[var(--brand-dark)] text-white' : 'text-muted-foreground'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Filter by Rep:</label>
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="h-8 max-w-[160px] rounded-md border border-[var(--color-border-tertiary)] bg-[var(--surface)] px-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-green)]"
              >
                <option value="all">All Reps</option>
                {uniqueUsers.map(u => (
                  <option key={u.code} value={u.code}>{u.name}</option>
                ))}
              </select>
            </div>
          )}

          {isManager && (
            <Button onClick={() => setShowCreate(true)} className="bg-[var(--brand-green)] text-white hover:bg-[var(--brand-green-dark)]">
              <Plus className="mr-1 h-4 w-4" />
              New task
            </Button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-xl" />
            ))}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={(e) => {
              const t = tasks.find((x) => x._id === e.active.id);
              if (t) setActiveDrag(t);
            }}
            onDragEnd={onDragEnd}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {COLS.map((col) => (
                <div key={col.id}>
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className={cn('text-xs font-semibold uppercase tracking-wide', col.labelClass)}>{col.label}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', col.badgeClass)}>
                      {byCol[col.id].length}
                    </span>
                  </div>
                  <DroppableCol id={col.id}>
                    {byCol[col.id].map((task) => (
                      <DraggableCard key={task._id} task={task} onOpen={() => setSelectedTask(task)} />
                    ))}
                  </DroppableCol>
                </div>
              ))}
            </div>
            <DragOverlay>
              {activeDrag ? (
                <div className="rounded-lg border border-[var(--color-border-primary)] bg-[var(--surface)] p-3 shadow-lg">
                  <p className="text-[13px] font-medium">{activeDrag.title}</p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {wide && (
        <div className="hidden w-[320px] shrink-0 lg:block">{selectedTask ? detailPanel : <div className="h-full rounded-xl border border-dashed border-[var(--color-border-tertiary)] p-6 text-center text-sm text-muted-foreground">Select a task</div>}</div>
      )}

      {!wide && (
        <Sheet open={!!selectedTask && !wide} onOpenChange={(o) => !o && setSelectedTask(null)}>
          <SheetContent side="right" className="w-full max-w-md p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Task</SheetTitle>
            </SheetHeader>
            {selectedTask ? detailPanel : null}
          </SheetContent>
        </Sheet>
      )}

      <Sheet open={showCreate} onOpenChange={setShowCreate}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New task</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <Input
              placeholder="Title"
              value={newTask.title}
              onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
            />
            <Textarea
              placeholder="Description"
              value={newTask.description}
              onChange={(e) => setNewTask((p) => ({ ...p, description: e.target.value }))}
            />
            <select
              value={newTask.assigneeId}
              onChange={(e) => setNewTask((p) => ({ ...p, assigneeId: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Assignee</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </select>
            <Input
              type="datetime-local"
              value={newTask.dueAt}
              onChange={(e) => setNewTask((p) => ({ ...p, dueAt: e.target.value }))}
            />
            <Button type="button" variant="outline" size="sm" onClick={captureLocation}>
              <MapPin className="mr-1 h-4 w-4" />
              Capture location
            </Button>
            {newTask.location?.coords && (
              <p className="text-xs text-[var(--brand-green)]">
                <LocationText lat={newTask.location.coords.lat} lng={newTask.location.coords.lng} />
              </p>
            )}
            <Button className="w-full bg-[var(--brand-green)] text-white" onClick={() => void createTask()}>
              Create
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
