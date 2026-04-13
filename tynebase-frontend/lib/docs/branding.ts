import { DocArticle } from './types';

export const brandingArticles: DocArticle[] = [
  {
    id: 'branding-overview',
    slug: 'branding-overview',
    title: 'Branding Overview',
    description: 'Customise your workspace with your company\'s branding and white-label options.',
    content: `# Branding Overview

TyneBase offers branding capabilities to make your workspace reflect your brand identity. Upload your logo, set your brand colors, and configure a custom domain.

## What You Can Customize

### Visual Branding
- **Company Logo**: Upload your logo (Pro+ tier)
- **Color Scheme**: Choose primary and secondary colors that match your brand (Pro+ tier)
- **Custom Domain**: Use your own domain (e.g., docs.yourcompany.com) (Base+ tier)

## Getting Started

1. Navigate to **Settings > Branding**
2. Upload your company logo
3. Choose your brand colors
4. Configure your custom domain
5. Preview changes before publishing

## Best Practices

- Keep your logo under 2MB for optimal loading
- Use high-contrast colors for accessibility
- Test your branding on both light and dark themes
- Ensure your custom domain has proper SSL certificates (automatically provisioned)`,
    tags: ['branding', 'white-label', 'customization', 'visual'],
    category: 'branding',
    lastUpdated: '2026-04-13',
    readTime: '5 min',
  },
  {
    id: 'custom-domain-setup',
    slug: 'custom-domain-setup',
    title: 'Custom Domain Setup',
    description: 'Configure your custom domain for a fully branded experience.',
    content: `# Custom Domain Setup

Configure your custom domain for a fully branded experience. Setting up a custom domain gives your workspace a professional appearance and strengthens your brand identity.

## Prerequisites

- A domain you own (e.g., docs.yourcompany.com)
- Access to your domain's DNS settings
- SSL certificate (auto-provided by TyneBase)

## Step-by-Step Setup

### 1. Choose Your Domain
Select a subdomain that represents your brand:
- docs.com - for documentation
- knowledge.com - for knowledge base
- wiki.com - for internal wiki

### 2. Configure DNS
Add a CNAME record in your DNS settings:

Type: CNAME
Name: docs (or your chosen subdomain)
Value: tynebase.yourdomain.com
TTL: 3600 (or 1 hour)

### 3. Verify Domain
1. Navigate to Admin > Branding in TyneBase
2. Enter your custom domain
3. Click Verify Domain
4. Wait for DNS propagation (typically 5-15 minutes)

### 4. Configure SSL
TyneBase automatically provides SSL certificates for verified domains. The process usually completes within 24 hours.

## Troubleshooting

### Domain Not Verifying
- Check that your CNAME record points to the correct value
- Wait for DNS propagation (use nslookup to verify)
- Ensure no conflicting records exist

### SSL Issues
- SSL certificates can take up to 24 hours to issue
- Check that your domain is properly verified
- Contact support if issues persist after 24 hours

## Advanced Configuration

### Wildcard Domains
For enterprise plans, you can set up wildcard domains:
Type: CNAME
Name: *
Value: tynebase.com

### Multiple Domains
Add multiple domains to serve different teams or regions:
- docs.com - US team
- docs.com - EU team
- docs.com - APAC team`,
    tags: ['domain', 'dns', 'ssl', 'custom-domain', 'configuration'],
    category: 'branding',
    lastUpdated: '2026-04-13',
    readTime: '8 min',
  },
  {
    id: 'color-customization',
    slug: 'color-customization',
    title: 'Color Customization',
    description: 'Personalize your workspace colors to match your brand identity.',
    content: `# Color Customization

Personalize your workspace colors to match your brand identity. Set primary and secondary colors that are applied to buttons, links, and accents throughout your workspace.

## Color Options

### Brand Colors
- **Primary Brand Color**: Main accent color for buttons, links, and highlights
- **Secondary Brand Color**: Complementary color for secondary actions

## Getting Started

1. Navigate to **Settings > Branding**
2. Click on "Brand Colours"
3. Use the color picker or enter hex codes
4. Preview changes in real-time
5. Save your preferences

## Color Picker Options

### Custom Colors
You can specify colors using:
- **Color Picker**: Click to select from a color palette
- **Hex Codes**: Enter directly (e.g., #FF5733)

### Live Preview
See your colors in action before saving:
- Preview swatches showing both colors
- Sample buttons displaying how colors appear
- Real-time updates as you adjust

## Best Practices

### Accessibility
- Ensure sufficient contrast between text and background
- Follow WCAG 2.1 AA guidelines (4.5:1 contrast ratio minimum)
- Test with color blindness simulators if needed

### Brand Consistency
- Use your brand's official color codes
- Maintain consistency across all marketing materials
- Consider how colors appear in different contexts

### User Experience
- Test colors in both light and dark themes
- Ensure colors work well on different devices
- Consider cultural implications of color choices

## Troubleshooting

### Colors Not Applying
- Clear your browser cache
- Ensure you have proper permissions (Pro+ tier required)
- Check that you clicked Save after making changes

### Contrast Issues
- Use online contrast checker tools
- Adjust brightness or saturation
- Consider alternative color combinations

### Brand Colors Not Working
- Verify hex code format (must be 7 characters including #)
- Check for typos in color codes
- Test with different browsers`,
    tags: ['colors', 'branding', 'customization', 'design', 'accessibility'],
    category: 'branding',
    lastUpdated: '2026-04-13',
    readTime: '7 min',
  },
  {
    id: 'logo-upload',
    slug: 'logo-upload',
    title: 'Logo Upload & Management',
    description: 'Upload and manage your company logo across the platform.',
    content: `# Logo Upload & Management

Upload and manage your company logo across the platform. Your company logo is a key element of your brand identity. Learn how to upload and manage logos effectively in TyneBase.

## Supported Formats

### Image Formats
- **PNG**: Recommended for transparency support
- **JPG**: Good for photographic logos
- **SVG**: Ideal for vector logos (scales perfectly)
- **WEBP**: Modern format with better compression

### Size Requirements
- **Maximum File Size**: 2MB
- **Recommended Dimensions**: 200x200 to 400x400 pixels
- **Aspect Ratio**: Square (1:1) works best
- **Resolution**: 72 DPI for web display

## Upload Process

### 1. Prepare Your Logo
- Use a high-quality version of your logo
- Ensure it has a transparent background (PNG/SVG)
- Test it on both light and dark backgrounds

### 2. Upload to TyneBase
1. Go to **Settings > Branding**
2. Click "Upload Logo"
3. Select your logo file
4. Adjust positioning if needed
5. Save changes

### 3. Preview and Adjust
- Check how your logo looks in the header
- Test on both light and dark themes
- Verify it appears correctly on mobile devices

## Logo Guidelines

### Best Practices
- **Keep it Simple**: Complex logos may not scale well
- **High Contrast**: Ensure visibility on all backgrounds
- **Consistent Branding**: Use the same logo across all materials
- **Responsive Design**: Test on various screen sizes

### What to Avoid
- Low-resolution or pixelated images
- Logos with watermarks or text overlays
- Excessively large file sizes
- Logos that don't work well when scaled down

## Advanced Options

### Multiple Logos
For enterprise plans, you can upload different logos for:
- **Header Logo**: Appears in the main navigation
- **Login Logo**: Shown on authentication pages
- **Email Logo**: Used in email notifications
- **Favicon**: Browser tab icon

### Logo Variations
Consider having different versions:
- **Full Color**: Standard branding
- **Monochrome**: For single-color contexts
- **Inverse**: For dark backgrounds

## Troubleshooting

### Logo Not Appearing
- Check file format and size requirements
- Clear browser cache
- Verify upload completed successfully
- Check permissions and user roles

### Logo Looks Distorted
- Ensure correct aspect ratio
- Try a different file format (SVG recommended)
- Check original image quality
- Test with different logo variations

### Mobile Display Issues
- Test logo on actual mobile devices
- Check responsive behavior
- Consider a simplified mobile logo version
- Verify touch target accessibility

## Brand Consistency

### Cross-Platform Consistency
Use the same logo across:
- TyneBase workspace
- Email communications
- Marketing materials
- Social media profiles

### Logo Usage Rights
Ensure you have:
- Permission to use the logo
- Rights for digital distribution
- Compliance with brand guidelines
- Proper licensing if using third-party logos

## Technical Considerations

### Performance
- Optimize image file size without quality loss
- Use appropriate image formats (SVG for vector, PNG for transparency)
- Consider lazy loading for large logos
- Test loading times on various connections

### SEO Benefits
- Brand recognition improves user trust
- Consistent branding aids recall
- Professional appearance impacts perception
- Custom domains with logos enhance credibility`,
    tags: ['logo', 'upload', 'branding', 'images', 'management'],
    category: 'branding',
    lastUpdated: '2026-04-13',
    readTime: '6 min',
  },
];
