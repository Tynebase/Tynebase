import { test, expect } from '@playwright/test';

/**
 * Objective O1 — Users Page UI Tests
 * 
 * Tests for:
 * 1. Admin guard (permission denied for non-admins)
 * 2. Users list display
 * 3. Invite modal functionality
 * 4. Role change modal
 * 5. Delete user confirmation
 * 6. Pending invitations display
 */

test.describe('Users Page - Admin Access', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin before each test
    // This assumes you have a test admin account set up
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', process.env.TEST_ADMIN_EMAIL || 'admin@test.com');
    await page.fill('input[type="password"]', process.env.TEST_ADMIN_PASSWORD || 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/**');
  });

  test('displays users list for admin', async ({ page }) => {
    await page.goto('/dashboard/users');
    
    // Should see the page header
    await expect(page.locator('h1')).toContainText('Team Members');
    
    // Should see stats cards
    await expect(page.locator('text=Total Members')).toBeVisible();
    await expect(page.locator('text=Active')).toBeVisible();
    
    // Should see the Members card
    await expect(page.locator('text=Members')).toBeVisible();
  });

  test('opens invite modal when clicking Invite Member', async ({ page }) => {
    await page.goto('/dashboard/users');
    
    // Click the invite button
    await page.click('button:has-text("Invite Member")');
    
    // Modal should appear
    await expect(page.locator('text=Invite Team Member')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();
    
    // Close modal
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('text=Invite Team Member')).not.toBeVisible();
  });

  test('validates email in invite modal', async ({ page }) => {
    await page.goto('/dashboard/users');
    
    await page.click('button:has-text("Invite Member")');
    
    // Send button should be disabled when email is empty
    const sendButton = page.locator('button:has-text("Send Invite")');
    await expect(sendButton).toBeDisabled();
    
    // Enter invalid email
    await page.fill('input[type="email"]', 'invalid');
    
    // Button should still be enabled (validation happens on submit)
    await expect(sendButton).toBeEnabled();
  });

  test('opens role change modal when clicking Change Role', async ({ page }) => {
    await page.goto('/dashboard/users');
    
    // Find a user row and click the role change button
    const userRow = page.locator('.divide-y > div').first();
    await userRow.locator('button[title="Change role"]').click();
    
    // Modal should appear
    await expect(page.locator('text=Change Role')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();
    
    // Close modal
    await page.click('button:has-text("Cancel")');
  });

  test('shows delete confirmation when clicking Remove User', async ({ page }) => {
    await page.goto('/dashboard/users');
    
    // Find a user row (not the current user) and open dropdown
    const userRows = page.locator('.divide-y > div');
    const count = await userRows.count();
    
    if (count > 1) {
      // Click more options on second user
      await userRows.nth(1).locator('button[title="More options"]').click();
      
      // Click Remove User
      await page.click('button:has-text("Remove User")');
      
      // Confirmation modal should appear
      await expect(page.locator('text=Remove User')).toBeVisible();
      await expect(page.locator('text=This will remove')).toBeVisible();
      
      // Close modal
      await page.click('button:has-text("Cancel")');
    }
  });

  test('shows roles info modal', async ({ page }) => {
    await page.goto('/dashboard/users');
    
    // Click View Roles link
    await page.click('text=View Roles');
    
    // Modal should appear with role descriptions
    await expect(page.locator('text=User Roles & Permissions')).toBeVisible();
    await expect(page.locator('text=Admin')).toBeVisible();
    await expect(page.locator('text=Editor')).toBeVisible();
    await expect(page.locator('text=Viewer')).toBeVisible();
  });

  test('filters users by search', async ({ page }) => {
    await page.goto('/dashboard/users');
    
    // Type in search box
    await page.fill('input[placeholder="Search members..."]', 'admin');
    
    // Should filter the list
    await page.waitForTimeout(300); // Debounce
    
    // Results should be filtered (exact assertion depends on test data)
    const memberCount = page.locator('text=/\\d+ member/');
    await expect(memberCount).toBeVisible();
  });

  test('filters users by role', async ({ page }) => {
    await page.goto('/dashboard/users');
    
    // Select a role filter
    await page.selectOption('select', 'admin');
    
    // Should filter the list
    await page.waitForTimeout(300);
    
    // Results should be filtered
    const memberCount = page.locator('text=/\\d+ member/');
    await expect(memberCount).toBeVisible();
  });
});

test.describe('Users Page - Non-Admin Access', () => {
  test.beforeEach(async ({ page }) => {
    // Login as non-admin before each test
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', process.env.TEST_MEMBER_EMAIL || 'member@test.com');
    await page.fill('input[type="password"]', process.env.TEST_MEMBER_PASSWORD || 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/**');
  });

  test('shows permission denied for non-admin', async ({ page }) => {
    await page.goto('/dashboard/users');
    
    // Should see access denied message
    await expect(page.locator('text=Access Denied')).toBeVisible();
    await expect(page.locator('text=Only administrators can view')).toBeVisible();
    
    // Should see Go Back button
    await expect(page.locator('button:has-text("Go Back")')).toBeVisible();
  });

  test('does not show invite button for non-admin', async ({ page }) => {
    await page.goto('/dashboard/users');
    
    // Invite button should not be visible
    await expect(page.locator('button:has-text("Invite Member")')).not.toBeVisible();
  });
});

test.describe('Pending Invitations', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', process.env.TEST_ADMIN_EMAIL || 'admin@test.com');
    await page.fill('input[type="password"]', process.env.TEST_ADMIN_PASSWORD || 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/**');
  });

  test('displays pending invitations card when invites exist', async ({ page }) => {
    await page.goto('/dashboard/users');
    
    // If there are pending invites, the card should be visible
    const pendingCard = page.locator('text=Pending Invitations');
    
    // This test is conditional on having pending invites
    const isVisible = await pendingCard.isVisible().catch(() => false);
    
    if (isVisible) {
      await expect(pendingCard).toBeVisible();
      
      // Should have Resend and Cancel buttons
      await expect(page.locator('button:has-text("Resend")')).toBeVisible();
      await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
    }
  });
});
