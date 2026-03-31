import { DocArticle } from './types';

export const billingArticles: DocArticle[] = [
  {
    id: 'billing-overview',
    slug: 'billing-overview',
    title: 'Billing Overview',
    description: 'Understand TyneBase\'s pricing plans, billing cycles, and payment options.',
    content: `# Billing Overview

TyneBase offers flexible pricing plans designed to scale with your organization's needs. From free plans for small teams to enterprise solutions for large organizations, we have options for every use case.

## Pricing Plans

### Free Plan
Perfect for small teams and individuals getting started with knowledge management.

**Features:**
- Up to 5 users
- 100 documents
- 1GB storage
- Basic AI features (10 credits/month)
- Community support
- Standard branding

### Professional Plan
Ideal for growing teams that need more power and flexibility.

**Features:**
- Up to 50 users
- Unlimited documents
- 10GB storage
- Advanced AI features (100 credits/month)
- Email support
- Custom branding
- API access

### Business Plan
Designed for larger teams and organizations with advanced needs.

**Features:**
- Up to 200 users
- Unlimited documents
- 50GB storage
- Premium AI features (500 credits/month)
- Priority email support
- Advanced branding
- Advanced analytics
- SSO integration

### Enterprise Plan
Custom solutions for large organizations with specific requirements.

**Features:**
- Unlimited users
- Unlimited documents
- Unlimited storage
- Unlimited AI credits
- Dedicated support
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
- Invoicing (30-day payment terms)

## Usage-Based Billing

### AI Credits
AI features use a credit-based system:
- **Text Generation**: 1 credit per 1,000 words
- **Document Analysis**: 1 credit per 10 pages
- **Video Processing**: 10 credits per minute of video
- **Image Generation**: 5 credits per image

### Storage Overages
If you exceed your storage limit:
- Additional storage: $0.10 per GB per month
- Automatic billing for overages
- Usage alerts at 80% and 100%

### User Overages
Add more users to your plan anytime:
- Professional: $10 per additional user per month
- Business: $8 per additional user per month
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
- Downgrade at the end of billing cycle
- Data retention policies apply
- Some features may become unavailable
- Export data before downgrading

### Cancellation
- Cancel anytime with no penalties
- Access until end of billing period
- Data export options available
- Reactivate subscription later

## Enterprise Billing

### Custom Contracts
- Flexible payment terms
- Net 30, 60, or 90 day terms
- Purchase order processing
- Volume discounts available

### Multi-Workspace Billing
- Single invoice for multiple workspaces
- Consolidated reporting
- Centralized user management
- Cost allocation by department

### Compliance and Security
- SOC 2 Type II compliant billing
- GDPR-compliant data handling
- PCI DSS certified payment processing
- Audit trails for all transactions

## Tax Information

### Sales Tax
- Sales tax applied based on your location
- Tax exemptions available for qualifying organizations
- VAT handling for EU customers
- Tax certificates accepted

### Expense Reporting
- Detailed expense reports
- Category-based expense tracking
- Integration with expense management systems
- Customizable report formats

## Support and Resources

### Billing Support
- Dedicated billing support team
- 24/7 payment issue resolution
- Refund and credit policies
- Dispute resolution assistance

### Documentation
- Detailed billing guides
- FAQ for common questions
- Video tutorials for billing tasks
- API documentation for billing automation

## Getting Help

### Billing Questions
- Contact our billing team at billing@tynebase.com
- Submit support tickets through the dashboard
- Access live chat during business hours
- Schedule a consultation with our team

### Account Management
- Self-service account portal
- Download invoices and receipts
- Update payment methods
- Manage subscription settings

## Best Practices

### Budget Planning
- Monitor usage trends and patterns
- Set up alerts for unusual activity
- Plan for seasonal usage changes
- Consider annual billing for savings

### Cost Optimization
- Regular usage audits
- Remove inactive users
- Optimize AI credit usage
- Review storage utilization

### Team Coordination
- Designate billing administrators
- Establish approval workflows
- Create expense policies
- Train team on billing procedures`,
    tags: ['billing', 'pricing', 'plans', 'payment', 'subscription'],
    category: 'billing',
    lastUpdated: '2024-01-15',
    readTime: 10,
  },
  {
    id: 'payment-methods',
    slug: 'payment-methods',
    title: 'Payment Methods & Management',
    description: 'Manage your payment methods, billing information, and payment preferences.',
    content: `# Payment Methods & Management

Easily manage your payment methods and billing information to ensure uninterrupted access to TyneBase services.

## Supported Payment Methods

### Credit and Debit Cards
We accept all major credit and debit cards:
- **Visa**: Most widely accepted globally
- **MasterCard**: Global acceptance with security features
- **American Express**: Premium card with additional benefits
- **Discover**: Growing acceptance with cashback programs
- **JCB**: Popular in Asian markets

### Bank Transfers
For larger transactions and enterprise customers:
- **ACH (Automated Clearing House)**: US bank transfers
- **SEPA (Single Euro Payments Area)**: European transfers
- **Wire Transfers**: International bank transfers
- **Direct Debit**: Recurring payment setup

### Alternative Methods
Additional payment options for convenience:
- **PayPal**: Digital wallet with buyer protection
- **Purchase Orders**: For enterprise and government customers
- **Cryptocurrency**: Bitcoin and Ethereum (Enterprise only)
- **Check Payments**: Traditional paper checks (US only)

## Managing Payment Methods

### Adding a Payment Method
1. Navigate to **Settings > Billing**
2. Click "Add Payment Method"
3. Select your payment type
4. Enter payment details
5. Verify and save

### Updating Payment Information
- Update expired cards before billing date
- Change bank account details as needed
- Update billing contact information
- Set backup payment methods

### Removing Payment Methods
- Remove unused payment methods anytime
- Cannot remove methods with active subscriptions
- Set replacement methods before removal
- Download receipts for record-keeping

## Security Features

### Payment Security
- **PCI DSS Compliance**: Industry-standard security
- **Encryption**: All data encrypted in transit and at rest
- **Tokenization**: Secure payment token storage
- **Fraud Detection**: Automated fraud prevention

### Account Protection
- **Two-Factor Authentication**: Additional security layer
- **Billing Alerts**: Notifications for suspicious activity
- **Access Controls**: Role-based payment management
- **Audit Logs**: Complete transaction history

## Billing Preferences

### Payment Scheduling
- **Automatic Payments**: Never miss a payment
- **Manual Approvals**: Require approval for charges
- **Threshold Alerts**: Notify for large transactions
- **Custom Schedules**: Flexible billing dates

### Invoice Preferences
- **Email Delivery**: Receive invoices via email
- **PDF Downloads**: Download for record-keeping
- **Accounting Integration**: QuickBooks, Xero integration
- **Custom Formatting**: Branded invoice templates

### Refund Preferences
- **Automatic Refunds**: Quick processing for eligible returns
- **Store Credit**: Refunds as account credit
- **Original Payment**: Refund to original payment method
- **Manual Review**: Require approval for refunds

## Enterprise Payment Options

### Purchase Orders
- **Net Terms**: 30, 60, or 90 day payment terms
- **Volume Discounts**: Pricing based on commitment
- **Multi-Year Contracts**: Extended payment schedules
- **Custom Invoicing**: Branded invoice formats

### Wire Transfers
- **International Payments**: Global wire transfer support
- **Batch Processing**: Multiple payments in one transaction
- **Currency Conversion**: Automatic currency handling
- **Tracking**: Real-time payment status updates

### Corporate Cards
- **Corporate Credit Cards**: Business payment cards
- **Purchase Cards**: Controlled spending limits
- **Virtual Cards**: Single-use payment cards
- **Expense Cards**: Employee expense management

## Troubleshooting

### Payment Declined
- Check card details and expiration date
- Verify sufficient funds available
- Contact your bank for authorization
- Try alternative payment method

### Billing Issues
- Verify billing information is current
- Check payment method is active
- Review subscription plan limits
- Contact support for assistance

### Refund Processing
- Refunds typically process in 5-10 business days
- Bank transfers may take longer
- Check with your bank for status
- Contact support if delays exceed expectations

## International Payments

### Currency Support
We accept payments in multiple currencies:
- **USD**: United States Dollar
- **EUR**: Euro
- **GBP**: British Pound
- **CAD**: Canadian Dollar
- **AUD**: Australian Dollar
- **JPY**: Japanese Yen

### Exchange Rates
- Real-time exchange rate conversion
- Transparent pricing in local currency
- No hidden conversion fees
- Rate lock for subscription period

### Regional Methods
- **iDEAL**: Netherlands online banking
- **SOFORT**: German online banking
- **Giropay**: German bank transfers
- **Przelewy24**: Polish online payments
- **BACS**: UK bank transfers

## Compliance and Regulation

### Financial Regulations
- **KYC Requirements**: Identity verification for large transactions
- **AML Compliance**: Anti-money laundering measures
- **Tax Reporting**: Automatic tax reporting requirements
- **Data Protection**: GDPR and CCPA compliance

### Audit Trail
- Complete transaction history
- Payment method changes logged
- Authorization records maintained
- Compliance reporting available

## Best Practices

### Security
- Use secure payment methods
- Monitor account for unauthorized activity
- Keep payment information updated
- Use strong passwords and 2FA

### Budget Management
- Set spending limits and alerts
- Review transactions regularly
- Plan for seasonal expenses
- Use accounting software integration

### Record Keeping
- Download receipts for all transactions
- Organize expenses by category
- Maintain records for tax purposes
- Backup financial data regularly

## Getting Help

### Payment Support
- **Email**: billing@tynebase.com
- **Phone**: 1-800-TYNEBASE (Mon-Fri, 9am-5pm EST)
- **Live Chat**: Available in billing dashboard
- **Support Tickets**: Submit through help center

### Resources
- **Billing FAQ**: Answers to common questions
- **Payment Guides**: Step-by-step instructions
- **Video Tutorials**: Visual payment setup guides
- **Documentation**: Comprehensive billing documentation`,
    tags: ['payment', 'billing', 'credit-card', 'security', 'enterprise'],
    category: 'billing',
    lastUpdated: '2024-01-15',
    readTime: 12,
  },
  {
    id: 'usage-monitoring',
    slug: 'usage-monitoring',
    title: 'Usage Monitoring & Analytics',
    description: 'Track your workspace usage, monitor costs, and optimize resources.',
    content: `# Usage Monitoring & Analytics

Stay informed about your workspace usage with comprehensive monitoring tools and detailed analytics to help you optimize costs and resources.

## Usage Dashboard

### Overview Metrics
Get a bird's-eye view of your workspace activity:
- **Active Users**: Currently logged-in users
- **Document Count**: Total documents in your workspace
- **Storage Used**: Current storage consumption
- **AI Credits**: Remaining AI credits this month
- **API Calls**: API usage for current billing period

### Real-Time Monitoring
Track activity as it happens:
- **Live User Count**: Users currently online
- **Document Activity**: Recent uploads and edits
- **AI Usage**: Real-time credit consumption
- **Bandwidth Usage**: Data transfer metrics
- **Response Times**: System performance indicators

## Detailed Analytics

### User Analytics
Understand how your team uses TyneBase:
- **Active vs Inactive Users**: Engagement metrics
- **Login Patterns**: Peak usage times and frequency
- **Feature Adoption**: Most and least used features
- **User Growth**: New user acquisition trends
- **Retention Rates**: User retention over time

### Document Analytics
Monitor document creation and usage:
- **Creation Trends**: Documents created over time
- **Popular Content**: Most viewed documents
- **Search Patterns**: Common search terms and queries
- **Collaboration Metrics**: Comments, shares, and edits
- **Content Lifecycle**: Document age and updates

### Storage Analytics
Track storage consumption and optimization:
- **File Type Breakdown**: Distribution by file type
- **Large Files**: Identify storage-heavy content
- **Growth Trends**: Storage usage over time
- **Redundancy**: Duplicate or similar content
- **Archive Potential**: Unused or old documents

## Cost Optimization

### Usage Alerts
Set up notifications to stay within budget:
- **Storage Alerts**: Notify at 80% and 90% capacity
- **User Alerts**: Notify when approaching user limits
- **Credit Alerts**: Low AI credit warnings
- **API Alerts**: Unusual API usage patterns
- **Budget Alerts**: Monthly spending notifications

### Resource Recommendations
Get AI-powered suggestions for optimization:
- **Storage Cleanup**: Identify files for deletion
- **User Management**: Suggest inactive user removal
- **Plan Optimization**: Recommend plan changes
- **Feature Usage**: Suggest feature enablement/disablement
- **Cost Savings**: Identify potential savings opportunities

### Usage Patterns
Analyze usage patterns to make informed decisions:
- **Peak Hours**: Identify busiest times
- **Team Usage**: Department-level usage breakdown
- **Seasonal Trends**: Usage variations throughout year
- **Feature Correlation**: Feature usage and retention
- **Growth Projections**: Predict future needs

## Reporting Tools

### Custom Reports
Create reports tailored to your needs:
- **Monthly Summaries**: Executive overview reports
- **Department Reports**: Team-specific usage data
- **Cost Analysis**: Detailed cost breakdown
- **Usage Forecasts**: Predictive analytics
- **Compliance Reports**: Audit-ready documentation

### Data Export
Export your data for further analysis:
- **CSV Export**: Spreadsheet-compatible data
- **JSON Export**: Machine-readable format
- **PDF Reports**: Presentation-ready formats
- **API Access**: Programmatic data retrieval
- **Scheduled Exports**: Automated report delivery

### Historical Data
Access long-term usage trends:
- **Daily Metrics**: Granular daily usage data
- **Monthly Summaries**: Monthly aggregated data
- **Yearly Comparisons**: Year-over-year analysis
- **Custom Date Ranges**: Flexible time period selection
- **Data Retention**: Configurable data history

## API Monitoring

### API Usage Tracking
Monitor your API integration performance:
- **Request Volume**: Number of API calls
- **Response Times**: API performance metrics
- **Error Rates**: Failed request percentages
- **Rate Limits**: API throttling and limits
- **Authentication**: API key and token usage

### Integration Analytics
Track third-party integration usage:
- **Connected Apps**: Active integrations
- **Data Sync**: Synchronization status
- **Webhook Delivery**: Webhook success rates
- **Custom Apps**: Custom application usage
- **API Keys**: Key management and rotation

### Developer Tools
Tools for API developers and administrators:
- **API Explorer**: Interactive API testing
- **Documentation**: Comprehensive API guides
- **SDK Metrics**: SDK usage statistics
- **Debug Logs**: Detailed error tracking
- **Performance Metrics**: Optimization insights

## Security Monitoring

### Access Monitoring
Track and secure your workspace:
- **Login Attempts**: Successful and failed logins
- **Geographic Access**: User location tracking
- **Device Usage**: Device and browser statistics
- **Permission Changes**: Role and access modifications
- **Security Events**: Suspicious activity alerts

### Compliance Tracking
Maintain compliance with regulations:
- **Data Access**: Who accessed what and when
- **Data Modification**: Change tracking and audit trails
- **Retention Policies**: Data lifecycle management
- **Export Logs**: Data export activities
- **Privacy Controls**: Personal data handling

## Performance Metrics

### System Performance
Monitor TyneBase performance:
- **Response Times**: Application responsiveness
- **Uptime**: Service availability metrics
- **Error Rates**: System error tracking
- **Load Balancing**: Server performance distribution
- **Database Health**: Database performance metrics

### User Experience
Track user satisfaction and engagement:
- **Page Load Times**: Website performance
- **Feature Performance**: Feature-specific metrics
- **User Feedback**: Satisfaction scores and comments
- **Support Tickets**: Help desk interactions
- **Feature Requests**: User improvement suggestions

## Getting Started

### Initial Setup
Configure your monitoring preferences:
1. Navigate to **Settings > Analytics**
2. Choose your preferred metrics
3. Set up alert thresholds
4. Configure report schedules
5. Invite team members to analytics

### Dashboard Customization
Personalize your analytics experience:
- **Widget Layout**: Arrange dashboard components
- **Time Ranges**: Set default time periods
- **Metric Selection**: Choose relevant KPIs
- **Alert Preferences**: Configure notifications
- **Export Options**: Set up automated exports

### Team Collaboration
Share insights with your team:
- **Shared Dashboards**: Collaborative analytics
- **Report Sharing**: Distribute insights easily
- **Commenting**: Discuss metrics and trends
- **Annotations**: Mark important events
- **Alert Sharing**: Team-wide notifications

## Best Practices

### Regular Monitoring
- **Daily Check-ins**: Review key metrics daily
- **Weekly Reviews**: Analyze trends weekly
- **Monthly Reports**: Generate monthly summaries
- **Quarterly Planning**: Plan based on insights
- **Annual Assessment**: Year-end evaluation

### Data-Driven Decisions
- **Evidence-Based**: Use data for decisions
- **Trend Analysis**: Identify patterns and trends
- **Cost Optimization**: Reduce unnecessary expenses
- **Resource Planning**: Plan for growth
- **Performance Improvement**: Optimize user experience

### Privacy and Security
- **Data Minimization**: Collect only necessary data
- **Access Control**: Limit access to sensitive data
- **Regular Audits**: Review data permissions
- **Secure Storage**: Protect sensitive information
- **Compliance**: Follow data protection regulations

## Support Resources

### Help Documentation
- **Getting Started Guide**: Initial setup instructions
- **Feature Guides**: Detailed feature documentation
- **Troubleshooting**: Common issues and solutions
- **API Documentation**: Developer resources
- **Best Practices**: Optimization recommendations

### Community Support
- **User Forums**: Community discussions
- **Knowledge Base**: Self-service resources
- **Video Tutorials**: Visual learning materials
- **Webinars**: Live training sessions
- **Blog Posts**: Tips and best practices

### Expert Support
- **Priority Support**: Fast response times
- **Technical Consulting**: Expert advice
- **Custom Solutions**: Tailored recommendations
- **Training Services**: Team education
- **Implementation Support**: Setup assistance`,
    tags: ['analytics', 'monitoring', 'usage', 'optimization', 'reporting'],
    category: 'billing',
    lastUpdated: '2024-01-15',
    readTime: 15,
  },
];
