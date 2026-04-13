"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Clock, Save, Trash2, Plus } from "lucide-react";
import {
  getAuditSchedules,
  createAuditSchedule,
  updateAuditSchedule,
  deleteAuditSchedule,
  type AuditSchedule,
  type CreateScheduleParams,
  type UpdateScheduleParams,
} from "@/lib/api/audit";
import { useToast } from "@/components/ui/Toast";

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ScheduleModal({ isOpen, onClose }: ScheduleModalProps) {
  const { addToast } = useToast();
  const [schedules, setSchedules] = useState<AuditSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<AuditSchedule | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateScheduleParams>({
    name: '',
    frequency: 'weekly',
    interval_value: 1,
    hour_of_day: 9,
    minute_of_hour: 0,
    timezone: 'UTC',
    is_active: true,
    auto_create_reviews: true,
    stale_threshold_days: 90,
  });

  useEffect(() => {
    if (isOpen) {
      fetchSchedules();
    }
  }, [isOpen]);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const data = await getAuditSchedules();
      setSchedules(data.schedules);
    } catch (error) {
      console.error("Failed to fetch schedules:", error);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingSchedule) {
        await updateAuditSchedule(editingSchedule.id, formData as UpdateScheduleParams);
        addToast({ type: 'success', title: 'Schedule updated successfully' });
      } else {
        await createAuditSchedule(formData);
        addToast({ type: 'success', title: 'Schedule created successfully' });
      }
      setShowForm(false);
      setEditingSchedule(null);
      resetForm();
      fetchSchedules();
    } catch (error) {
      console.error("Failed to save schedule:", error);
      addToast({ type: 'error', title: 'Failed to save schedule' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    setLoading(true);
    try {
      await deleteAuditSchedule(id);
      addToast({ type: 'success', title: 'Schedule deleted successfully' });
      fetchSchedules();
    } catch (error) {
      console.error("Failed to delete schedule:", error);
      addToast({ type: 'error', title: 'Failed to delete schedule' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (schedule: AuditSchedule) => {
    setEditingSchedule(schedule);
    setFormData({
      name: schedule.name,
      frequency: schedule.frequency,
      interval_value: schedule.interval_value,
      day_of_week: schedule.day_of_week || undefined,
      day_of_month: schedule.day_of_month || undefined,
      hour_of_day: schedule.hour_of_day,
      minute_of_hour: schedule.minute_of_hour,
      timezone: schedule.timezone,
      is_active: schedule.is_active,
      auto_create_reviews: schedule.auto_create_reviews,
      stale_threshold_days: schedule.stale_threshold_days,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      frequency: 'weekly',
      interval_value: 1,
      hour_of_day: 9,
      minute_of_hour: 0,
      timezone: 'UTC',
      is_active: true,
      auto_create_reviews: true,
      stale_threshold_days: 90,
    });
  };

  const formatScheduleDescription = (schedule: AuditSchedule) => {
    const frequencyText = schedule.frequency === 'daily' ? 'Daily' 
      : schedule.frequency === 'weekly' ? `Every ${schedule.interval_value} week${schedule.interval_value > 1 ? 's' : ''}`
      : `Every ${schedule.interval_value} month${schedule.interval_value > 1 ? 's' : ''}`;
    
    const dayText = schedule.frequency === 'weekly' && schedule.day_of_week !== null
      ? ` on ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][schedule.day_of_week]}`
      : schedule.frequency === 'monthly' && schedule.day_of_month !== null
      ? ` on day ${schedule.day_of_month}`
      : '';
    
    const timeText = ` at ${schedule.hour_of_day.toString().padStart(2, '0')}:${schedule.minute_of_hour.toString().padStart(2, '0')} ${schedule.timezone}`;
    
    return `${frequencyText}${dayText}${timeText}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--dash-border-subtle)] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--dash-text-primary)]">Configure Schedule</h2>
            <p className="text-sm text-[var(--dash-text-tertiary)] mt-1">Set up automated audit runs for your content</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {showForm ? (
            /* Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-[var(--dash-text-primary)]">
                  {editingSchedule ? 'Edit Schedule' : 'New Schedule'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingSchedule(null);
                    resetForm();
                  }}
                  className="text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)]"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                    Schedule Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Weekly Content Health Check"
                    className="w-full px-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                    Frequency
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                    className="w-full px-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                    Interval
                  </label>
                  <input
                    type="number"
                    value={formData.interval_value}
                    onChange={(e) => setFormData({ ...formData, interval_value: parseInt(e.target.value) || 1 })}
                    min="1"
                    max="365"
                    className="w-full px-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  />
                  <p className="text-xs text-[var(--dash-text-muted)] mt-1">Run every X periods</p>
                </div>

                {formData.frequency === 'weekly' && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                      Day of Week
                    </label>
                    <select
                      value={formData.day_of_week ?? 1}
                      onChange={(e) => setFormData({ ...formData, day_of_week: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                    >
                      <option value={0}>Sunday</option>
                      <option value={1}>Monday</option>
                      <option value={2}>Tuesday</option>
                      <option value={3}>Wednesday</option>
                      <option value={4}>Thursday</option>
                      <option value={5}>Friday</option>
                      <option value={6}>Saturday</option>
                    </select>
                  </div>
                )}

                {formData.frequency === 'monthly' && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                      Day of Month
                    </label>
                    <input
                      type="number"
                      value={formData.day_of_month ?? 1}
                      onChange={(e) => setFormData({ ...formData, day_of_month: parseInt(e.target.value) || 1 })}
                      min="1"
                      max="31"
                      className="w-full px-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                    Hour
                  </label>
                  <input
                    type="number"
                    value={formData.hour_of_day}
                    onChange={(e) => setFormData({ ...formData, hour_of_day: parseInt(e.target.value) || 9 })}
                    min="0"
                    max="23"
                    className="w-full px-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                    Minute
                  </label>
                  <input
                    type="number"
                    value={formData.minute_of_hour}
                    onChange={(e) => setFormData({ ...formData, minute_of_hour: parseInt(e.target.value) || 0 })}
                    min="0"
                    max="59"
                    className="w-full px-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                    Timezone
                  </label>
                  <select
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="Europe/London">London</option>
                    <option value="Europe/Paris">Paris</option>
                    <option value="Asia/Tokyo">Tokyo</option>
                    <option value="Asia/Shanghai">Shanghai</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                    Stale Threshold (days)
                  </label>
                  <input
                    type="number"
                    value={formData.stale_threshold_days}
                    onChange={(e) => setFormData({ ...formData, stale_threshold_days: parseInt(e.target.value) || 90 })}
                    min="30"
                    max="365"
                    className="w-full px-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-5 h-5 rounded border-[var(--dash-border-subtle)] text-[var(--brand)] focus:ring-[var(--brand)]"
                  />
                  <span className="text-sm text-[var(--dash-text-secondary)]">Enable this schedule</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.auto_create_reviews}
                    onChange={(e) => setFormData({ ...formData, auto_create_reviews: e.target.checked })}
                    className="w-5 h-5 rounded border-[var(--dash-border-subtle)] text-[var(--brand)] focus:ring-[var(--brand)]"
                  />
                  <span className="text-sm text-[var(--dash-text-secondary)]">Auto-create reviews for issues found</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingSchedule(null);
                    resetForm();
                  }}
                  className="px-5 py-2.5 bg-[var(--surface-ground)] text-[var(--dash-text-secondary)] rounded-xl text-sm font-medium hover:bg-[var(--dash-border-subtle)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand)] text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'Saving...' : 'Save Schedule'}
                </button>
              </div>
            </form>
          ) : (
            /* List */
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-[var(--dash-text-primary)]">Your Schedules</h3>
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--brand)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  New Schedule
                </button>
              </div>

              {loading && schedules.length === 0 ? (
                <div className="text-center py-12 text-[var(--dash-text-muted)]">Loading schedules...</div>
              ) : schedules.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-[var(--dash-text-muted)] mx-auto mb-4" />
                  <p className="text-[var(--dash-text-tertiary)]">No schedules configured yet</p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="mt-4 text-[var(--brand)] text-sm font-medium hover:underline"
                  >
                    Create your first schedule
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {schedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl p-4 hover:border-[var(--dash-border)] transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-[var(--dash-text-primary)]">{schedule.name}</h4>
                            {!schedule.is_active && (
                              <span className="px-2 py-0.5 bg-[var(--dash-border-subtle)] text-[var(--dash-text-muted)] text-xs rounded-full">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-[var(--dash-text-secondary)] flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5" />
                            {formatScheduleDescription(schedule)}
                          </p>
                          {schedule.next_run_at && (
                            <p className="text-xs text-[var(--dash-text-muted)] mt-1">
                              Next run: {new Date(schedule.next_run_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleEdit(schedule)}
                            className="p-2 rounded-lg hover:bg-[var(--surface-card)] text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)] transition-colors"
                            title="Edit"
                          >
                            <Calendar className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(schedule.id, schedule.name)}
                            className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--dash-text-tertiary)] hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
