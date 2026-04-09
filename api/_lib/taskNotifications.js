import { supabase } from './db.js';

/**
 * Sprint 3 (Paul): notify assignee when a task is assigned or reassigned.
 */
export async function notifyTaskAssignment({
  assigneeId,
  taskId,
  taskTitle,
  assignerName,
}) {
  if (!assigneeId || !taskId) return;
  try {
    const title = 'New task assigned';
    const safeTitle = (taskTitle || 'Task').slice(0, 200);
    const message = assignerName
      ? `${assignerName} assigned you: "${safeTitle}"`
      : `You were assigned: "${safeTitle}"`;
    const { error } = await supabase.from('notifications').insert([
      {
        user_id: assigneeId,
        type: 'task_assigned',
        title,
        message,
        ref_id: taskId,
        ref_type: 'task',
        read: false,
      },
    ]);
    if (error) throw error;
  } catch (e) {
    console.error('notifyTaskAssignment:', e.message || e);
  }
}
