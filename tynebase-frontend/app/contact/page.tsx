"use client";

import { Mail, MessageSquare, MapPin, Phone } from "lucide-react";
import { useState } from "react";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { submitContactForm } from "@/lib/api/contact";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      await submitContactForm(formData);
      setSubmitStatus('success');
      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        company: '',
        message: ''
      });
    } catch (error) {
      setSubmitStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };
  return (
    <div className="min-h-screen relative">
      <div className="hero-gradient" />

      <SiteNavbar currentPage="other" />

      <section className="section pt-[180px] pb-[80px]">
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px' }}>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>Contact</p>
          <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 3.75rem)', fontWeight: 600, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: '24px', textAlign: 'center' }}>
            Get in <span className="text-gradient">touch</span>
          </h1>
          <p style={{ fontSize: '20px', color: 'var(--text-secondary)', maxWidth: '600px', textAlign: 'center' }}>
            Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
          </p>
        </div>
      </section>

      <section className="section py-16">
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px' }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12" style={{ width: '100%', maxWidth: '1152px' }}>
            {/* Contact Form */}
            <div className="bento-item">
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">Send us a message</h2>
              <form onSubmit={handleSubmit} className="space-y-5" style={{ position: 'relative', zIndex: 1 }}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2 text-left">First name</label>
                    <input 
                      type="text" 
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      className="w-full px-6 py-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)]" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2 text-left">Last name</label>
                    <input 
                      type="text" 
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      className="w-full px-6 py-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)]" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2 text-left">Email</label>
                  <input 
                    type="email" 
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)]" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2 text-left">Company</label>
                  <input 
                    type="text" 
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)]" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2 text-left">Message</label>
                  <textarea 
                    rows={4} 
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] resize-none" 
                  />
                </div>
                <div style={{ paddingTop: '32px' }}>
                  {submitStatus === 'success' && (
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-800 text-sm">Thank you for your message! We'll get back to you soon.</p>
                    </div>
                  )}
                  {submitStatus === 'error' && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-800 text-sm">{errorMessage}</p>
                    </div>
                  )}
                  <button 
                    type="submit" 
                    className="btn btn-primary w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Sending...' : 'Send message'}
                  </button>
                </div>
              </form>
            </div>

            {/* Contact Info */}
            <div className="space-y-6">
              <div className="bento-item" style={{ marginBottom: '32px' }}>
                <div className="flex items-start gap-4">
                  <div className="feature-icon feature-icon-brand">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)] mb-1">Email</h3>
                    <p className="text-[var(--text-secondary)]">support@tynebase.com</p>
                    <p className="text-sm text-[var(--text-muted)]">We'll respond within 48 hours</p>
                  </div>
                </div>
              </div>

              <div className="bento-item" style={{ marginBottom: '32px' }}>
                <div className="flex items-start gap-4">
                  <div className="feature-icon feature-icon-purple">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)] mb-1">Office</h3>
                    <p className="text-[var(--text-secondary)]">Newcastle, United Kingdom</p>
                    <p className="text-sm text-[var(--text-muted)]">EU data residency</p>
                  </div>
                </div>
              </div>

              <div className="bento-item">
                <div className="flex items-start gap-4">
                  <div className="feature-icon feature-icon-green">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)] mb-1">WhatsApp</h3>
                    <p className="text-[var(--text-secondary)]">+44 7428 448571</p>
                    <p className="text-sm text-[var(--text-muted)]">Quick response guaranteed</p>
                  </div>
                </div>
              </div>  
            </div>
          </div>
        </div>
      </section>


      <SiteFooter currentPage="contact" />
    </div>
  );
}
