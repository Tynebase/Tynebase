"use client";

import { useState, useEffect } from "react";
import { X, Bell, Save, Trash2, Plus, Mail, Smartphone } from "lucide-react";
import {
  getNotificationRules,
  createNotificationRule,
  updateNotificationRule,
  deleteNotificationRule,
  type NotificationRule,
  type CreateNotificationRuleParams,
  type UpdateNotificationRuleParams,
} from "@/lib/api/audit";
import { useToast } from "@/components/ui/Toast";

interface NotificationRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationRulesModal({ isOpen, onClose }: NotificationRulesModalProps) {
  const { addToast } = useToast();
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateNotificationRuleParams>({
    name: '',
    rule_type: 'review_due',
    notify_via_email: true,
    notify_via_in_app: true,
    is_active: true,
  });

  useEffect(() => {
    if (isOpen) {
      fetchRules();
    }
  }, [isOpen]);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const data = await getNotificationRules();
      setRules(data.rules);
    } catch (error) {
      console.error("Failed to fetch notification rules:", error);
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingRule) {
        await updateNotificationRule(editingRule.id, formData as UpdateNotificationRuleParams);
        addToast({ type: 'success', title: 'Notification rule updated successfully' });
      } else {
        await createNotificationRule(formData);
        addToast({ type: 'success', title: 'Notification rule created successfully' });
      }
      setShowForm(false);
      setEditingRule(null);
      resetForm();
      fetchRules();
    } catch (error) {
      console.error("Failed to save notification rule:", error);
      addToast({ type: 'error', title: 'Failed to save notification rule' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    setLoading(true);
    try {
      await deleteNotificationRule(id);
      addToast({ type: 'success', title: 'Notification rule deleted successfully' });
      fetchRules();
    } catch (error) {
      console.error("Failed to delete notification rule:", error);
      addToast({ type: 'error', title: 'Failed to delete notification rule' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (rule: NotificationRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      rule_type: rule.rule_type,
      priority_filter: rule.priority_filter || undefined,
      days_before_due: rule.days_before_due || undefined,
      stale_threshold_days: rule.stale_threshold_days || undefined,
      health_threshold_percentage: rule.health_threshold_percentage || undefined,
      notify_via_email: rule.notify_via_email,
      notify_via_in_app: rule.notify_via_in_app,
      notify_users: rule.notify_users,
      notify_roles: rule.notify_roles,
      is_active: rule.is_active,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      rule_type: 'review_due',
      notify_via_email: true,
      notify_via_in_app: true,
      is_active: true,
    });
  };

  const getRuleTypeLabel = (type: string) => {
    switch (type) {
      case 'review_due': return 'Review Due';
      case 'review_overdue': return 'Review Overdue';
      case 'stale_content': return 'Stale Content';
      case 'audit_complete': return 'Audit Complete';
      case 'health_threshold': return 'Health Threshold';
      default: return type;
    }
  };

  const getRuleTypeDescription = (rule: NotificationRule) => {
    const parts: string[] = [];
    
    if (rule.priority_filter && rule.priority_filter !== 'all') {
      parts.push(`${rule.priority_filter} priority`);
    }
    
    if (rule.days_before_due !== null) {
      parts.push(`${rule.days_before_due} day${rule.days_before_due !== 1 ? 's' : ''} before due`);
    }
    
    if (rule.stale_threshold_days !== null) {
      parts.push(`${rule.stale_threshold_days}+ days stale`);
    }
    
    if (rule.health_threshold_percentage !== null) {
      parts.push(`below ${rule.health_threshold_percentage}% health`);
    }
    
    return parts.length > 0 ? parts.join(', ') : 'All';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--dash-border-subtle)] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--dash-text-primary)]">Notification Rules</h2>
            <p className="text-sm text-[var(--dash-text-tertiary)] mt-1">Configure when and how you receive audit notifications</p>
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
                  {editingRule ? 'Edit Rule' : 'New Rule'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingRule(null);
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
                    Rule Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., High Priority Review Alerts"
                    className="w-full px-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                    Trigger Event
                  </label>
                  <select
                    value={formData.rule_type}
                    onChange={(e) => setFormData({ ...formData, rule_type: e.target.value as any })}
                    className="w-full px-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  >
                    <option value="review_due">Review Due</option>
                    <option value="review_overdue">Review Overdue</option>
                    <option value="stale_content">Stale Content Detected</option>
                    <option value="audit_complete">Audit Complete</option>
                    <option value="health_threshold">Health Threshold Breached</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                    Priority Filter
                  </label>
                  <select
                    value={formData.priority_filter || 'all'}
                    onChange={(e) => setFormData({ ...formData, priority_filter: e.target.value as any })}
                    className="w-full px-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  >
                    <option value="all">All Priorities</option>
                    <option value="high">High Only</option>
                    <option value="medium">Medium & High</option>
                    <option value="low">Low, Medium & High</option>
                  </select>
                </div>

                {formData.rule_type === 'review_due' && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                      Days Before Due
                    </label>
                    <input
                      type="number"
                      value={formData.days_before_due ?? 1}
                      onChange={(e) => setFormData({ ...formData, days_before_due: parseInt(e.target.value) || 1 })}
                      min="0"
                      max="30"
                      className="w-full px-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                    />
                    <p className="text-xs text-[var(--dash-text-muted)] mt-1">Notify this many days before review is due</p>
                  </div>
                )}

                {formData.rule_type === 'stale_content' && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                      Stale Threshold (days)
                    </label>
                    <input
                      type="number"
                      value={formData.stale_threshold_days ?? 90}
                      onChange={(e) => setFormData({ ...formData, stale_threshold_days: parseInt(e.target.value) || 90 })}
                      min="30"
                      max="365"
                      className="w-full px-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                    />
                  </div>
                )}

                {formData.rule_type === 'health_threshold' && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                      Health Threshold (%)
                    </label>
                    <input
                      type="number"
                      value={formData.health_threshold_percentage ?? 50}
                      onChange={(e) => setFormData({ ...formData, health_threshold_percentage: parseInt(e.target.value) || 50 })}
                      min="0"
                      max="100"
                      className="w-full px-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                    />
                    <p className="text-xs text-[var(--dash-text-muted)] mt-1">Alert when health falls below this percentage</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-3">
                  Notification Channels
                </label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer p-3 bg-[var(--surface-ground)] rounded-xl hover:bg-[var(--dash-border-subtle)] transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.notify_via_email}
                      onChange={(e) => setFormData({ ...formData, notify_via_email: e.target.checked })}
                      className="w-5 h-5 rounded border-[var(--dash-border-subtle)] text-[var(--brand)] focus:ring-[var(--brand)]"
                    />
                    <Mail className="w-5 h-5 text-[var(--dash-text-tertiary)]" />
                    <span className="text-sm text-[var(--dash-text-secondary)]">Email notifications</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer p-3 bg-[var(--surface-ground)] rounded-xl hover:bg-[var(--dash-border-subtle)] transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.notify_via_in_app}
                      onChange={(e) => setFormData({ ...formData, notify_via_in_app: e.target.checked })}
                      className="w-5 h-5 rounded border-[var(--dash-border-subtle)] text-[var(--brand)] focus:ring-[var(--brand)]"
                    />
                    <Smartphone className="w-5 h-5 text-[var(--dash-text-tertiary)]" />
                    <span className="text-sm text-[var(--dash-text-secondary)]">In-app notifications</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-5 h-5 rounded border-[var(--dash-border-subtle)] text-[var(--brand)] focus:ring-[var(--brand)]"
                  />
                  <span className="text-sm text-[var(--dash-text-secondary)]">Enable this rule</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingRule(null);
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
                  {loading ? 'Saving...' : 'Save Rule'}
                </button>
              </div>
            </form>
          ) : (
            /* List */
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-[var(--dash-text-primary)]">Your Rules</h3>
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--brand)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  New Rule
                </button>
              </div>

              {loading && rules.length === 0 ? (
                <div className="text-center py-12 text-[var(--dash-text-muted)]">Loading notification rules...</div>
              ) : rules.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="w-12 h-12 text-[var(--dash-text-muted)] mx-auto mb-4" />
                  <p className="text-[var(--dash-text-tertiary)]">No notification rules configured yet</p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="mt-4 text-[var(--brand)] text-sm font-medium hover:underline"
                  >
                    Create your first rule
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {rules.map((rule) => (
                    <div
                      key={rule.id}
                      className="bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl p-4 hover:border-[var(--dash-border)] transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-[var(--dash-text-primary)]">{rule.name}</h4>
                            {!rule.is_active && (
                              <span className="px-2 py-0.5 bg-[var(--dash-border-subtle)] text-[var(--dash-text-muted)] text-xs rounded-full">
                                Inactive
                              </span>
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-[var(--dash-text-secondary)] flex items-center gap-2">
                              <Bell className="w-3.5 h-3.5" />
                              {getRuleTypeLabel(rule.rule_type)}
                            </p>
                            <p className="text-xs text-[var(--dash-text-muted)]">
                              {getRuleTypeDescription(rule)}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              {rule.notify_via_email && (
                                <span className="flex items-center gap-1 text-xs text-[var(--dash-text-muted)]">
                                  <Mail className="w-3 h-3" />
                                  Email
                                </span>
                              )}
                              {rule.notify_via_in_app && (
                                <span className="flex items-center gap-1 text-xs text-[var(--dash-text-muted)]">
                                  <Smartphone className="w-3 h-3" />
                                  In-app
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleEdit(rule)}
                            className="p-2 rounded-lg hover:bg-[var(--surface-card)] text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)] transition-colors"
                            title="Edit"
                          >
                            <Bell className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(rule.id, rule.name)}
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
