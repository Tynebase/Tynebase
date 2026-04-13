import { DocArticle } from './types';

export const billingArticles: DocArticle[] = [
  {
    id: 'billing-overview',
    slug: 'billing-overview',
    title: 'Billing Overview',
    description: 'Understand TyneBase\'s pricing plans, billing cycles, and payment options.',
    content: `# Billing Overview

TyneBase's pricing plans, billing cycles and payment options. TyneBase offers flexible pricing plans designed to scale with your organization's needs. From free plans for small teams to enterprise solutions for large organizations, we have options for every use case.

## Pricing Plans

### Base Plan (Free)
Perfect for individuals getting started with knowledge management.

**Features:**
- 1 solo account
- 100 documents
- Basic AI features (10 credits/month)
- Community support
- Standard branding

### Pro Plan
Ideal for growing teams that need more power and flexibility.

**Price:** £29/month

**Features:**
- Up to 10 users
- Unlimited documents
- 1GB storage
- Advanced AI features (100 credits/month)
- Email support
- Custom domain

### Pro Plan (Advanced)
Designed for larger teams and organizations with advanced needs.

**Price:** £99/month

**Features:**
- Up to 50 users
- Unlimited documents
- 10GB storage
- Premium AI features (500 credits/month)
- White-label branding
- Advanced analytics
- Custom Domain
- Priority Support
- Audit logs

### Enterprise
Consult Sales for custom solutions for large organizations with specific requirements.

**Features:**
- All pro features
- Unlimited users
- Unlimited documents
- Dedicated support
- Rollover AI credits
- Full white-labeling
- Custom integrations
- On-premise deployment option

## Billing Cycle

### Monthly vs Annual
- **Monthly**: Pay month-to-month with flexibility
- **Annual**: Pay for 12 months and get 2 months free (17% discount)
- **Custom**: Enterprise plans with flexible billing terms

### Payment Methods
We accept various payment methods to make billing convenient:
- Credit/Debit cards (Visa, MasterCard, American Express)
- Bank transfers (ACH, SEPA)
- Purchase orders (for enterprise customers)
- Invoicing

## Usage-Based Billing

### AI Credits
AI features use a credit-based system:
- **Text Generation**: 1 credit per 1,000 words
- **Document Analysis**: 1 credit per 10 pages
- **Video Processing**: 10 credits per minute of video
- **Image Generation**: 5 credits per image

### User Overages
Add more users to your plan anytime:
- Pro: Custom pricing
- Enterprise: Custom pricing

## Invoicing and Receipts

### Automatic Invoices
- Invoices generated automatically on billing date
- Detailed breakdown of charges
- PDF download available
- Email delivery to billing contacts

### Receipts
- Instant receipt for every payment
- Tax information included
- Expense reports available
- Historical access to all receipts

## Managing Your Subscription

### Upgrading Plans
- Upgrade anytime with prorated billing
- Immediate access to new features
- No data migration required
- Support team assistance available

### Downgrading Plans
- Downgrade at the end of billing cycle (You cannot downgrade from Enterprise)
- Data retention policies apply
- Some features may become unavailable
- Export data before downgrading

### Cancellation
- Access until end of billing period
- Data export options available
- Reactivate subscription later
`,
    tags: ['billing', 'pricing', 'plans', 'payment', 'subscription'],
    category: 'billing',
    lastUpdated: '2026-04-13',
    readTime: '10',
  },
];
