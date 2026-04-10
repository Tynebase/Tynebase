/**
 * Contact Form API
 * 
 * Public API for submitting contact form - no authentication required
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  message: string;
}

export interface ContactFormResponse {
  success: boolean;
  message: string;
}

export async function submitContactForm(formData: ContactFormData): Promise<ContactFormResponse> {
  const url = `${API_BASE_URL}/api/contact`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to submit contact form');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Contact form submission error:', error);
    throw error;
  }
}
