"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import {
  User, Mail, Lock, Bell, Globe, Camera,
  Save, Eye, EyeOff
} from "lucide-react";

export default function ProfileSettingsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    fullName: user?.full_name || "",
    email: user?.email || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    emailNotifications: true,
    pushNotifications: true,
    weeklyDigest: false,
    marketingEmails: false,
    language: "en",
    timezone: "UTC",
  });

  const handleSave = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    addToast({
      type: "success",
      title: "Profile updated",
      description: "Your profile settings have been saved successfully.",
    });
    setIsLoading(false);
  };

  const handlePasswordChange = async () => {
    if (formData.newPassword !== formData.confirmPassword) {
      addToast({
        type: "error",
        title: "Passwords don't match",
        description: "Please make sure your new passwords match.",
      });
      return;
    }
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    addToast({
      type: "success",
      title: "Password updated",
      description: "Your password has been changed successfully.",
    });
    setFormData({ ...formData, currentPassword: "", newPassword: "", confirmPassword: "" });
    setIsLoading(false);
  };

  return (
    <div className="h-full w-full min-h-0 flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Profile Settings</h1>
        <p className="text-[var(--dash-text-tertiary)] mt-1">
          Manage your personal information and preferences
        </p>
      </div>

      {/* Profile Picture & Basic Info */}
      <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--dash-border-subtle)]">
          <h2 className="font-semibold text-[var(--dash-text-primary)] flex items-center gap-2">
            <User className="w-5 h-5 text-[var(--brand)]" />
            Personal Information
          </h2>
        </div>
        <div className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-[var(--brand-primary-muted)] flex items-center justify-center text-[var(--brand)] text-3xl font-bold">
                  {user?.full_name?.charAt(0) || user?.email?.charAt(0) || "U"}
                </div>
                <button className="absolute bottom-0 right-0 w-8 h-8 bg-[var(--brand)] text-white rounded-full flex items-center justify-center hover:bg-[var(--brand-dark)] transition-colors shadow-lg">
                  <Camera className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Form Fields */}
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
                  placeholder="Enter your full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dash-text-muted)]" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-11 pr-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
                    placeholder="Enter your email"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Password Change */}
      <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--dash-border-subtle)]">
          <h2 className="font-semibold text-[var(--dash-text-primary)] flex items-center gap-2">
            <Lock className="w-5 h-5 text-[var(--brand)]" />
            Change Password
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.currentPassword}
                onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                className="w-full px-4 py-3 pr-11 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--dash-text-muted)] hover:text-[var(--dash-text-primary)]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                New Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
                placeholder="Enter new password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                Confirm Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <button
            onClick={handlePasswordChange}
            disabled={isLoading || !formData.currentPassword || !formData.newPassword}
            className="w-full sm:w-auto px-5 py-2.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] text-[var(--dash-text-secondary)] rounded-lg font-medium hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Update Password
          </button>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--dash-border-subtle)]">
          <h2 className="font-semibold text-[var(--dash-text-primary)] flex items-center gap-2">
            <Bell className="w-5 h-5 text-[var(--brand)]" />
            Notification Preferences
          </h2>
        </div>
        <div className="p-6 space-y-4">
          {[
            { key: "emailNotifications", label: "Email Notifications", desc: "Receive updates about your documents via email" },
            { key: "pushNotifications", label: "Push Notifications", desc: "Get notified in your browser" },
            { key: "weeklyDigest", label: "Weekly Digest", desc: "Receive a weekly summary of activity" },
            { key: "marketingEmails", label: "Marketing Emails", desc: "Receive news and product updates" },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-3 border-b border-[var(--dash-border-subtle)] last:border-0 last:pb-0">
              <div className="flex-1 pr-4">
                <p className="font-medium text-[var(--dash-text-primary)]">{item.label}</p>
                <p className="text-sm text-[var(--dash-text-tertiary)]">{item.desc}</p>
              </div>
              <button
                onClick={() => setFormData({ ...formData, [item.key]: !formData[item.key as keyof typeof formData] })}
                className={`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 ${formData[item.key as keyof typeof formData] ? "bg-[var(--brand)]" : "bg-[var(--dash-border-default)]"
                  }`}
              >
                <span className={`absolute left-1 top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData[item.key as keyof typeof formData] ? "translate-x-5" : "translate-x-0"
                  }`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Regional Settings */}
      <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--dash-border-subtle)]">
          <h2 className="font-semibold text-[var(--dash-text-primary)] flex items-center gap-2">
            <Globe className="w-5 h-5 text-[var(--brand)]" />
            Regional Settings
          </h2>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
              Language
            </label>
            <select
              value={formData.language}
              onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
              Timezone
            </label>
            <select
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
            >
              <option value="UTC">UTC (Coordinated Universal Time)</option>
              <option value="EST">EST (Eastern Standard Time)</option>
              <option value="PST">PST (Pacific Standard Time)</option>
              <option value="GMT">GMT (Greenwich Mean Time)</option>
              <option value="CET">CET (Central European Time)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-4 pt-4">
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 text-white rounded-xl font-semibold transition-all hover:shadow-lg"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}
