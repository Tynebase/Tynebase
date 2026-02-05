# Visual & Copy Changes Required

## Billing & Subscription
- **Change:** `$` symbols → `£`
- **Copy:** Remove comma before "and"
  - *Current:* "...processing, and..."
  - *New:* "...processing and..."

## Team Members
- **UI:** Add "Invite User" / "Add User" button (visible if user count < limit).
- **Logic:** Ensure selecting "Admin" toggle filters the list correctly.

## Tags Screen
- **Style:** Capitalize the first letter of all tags (e.g., `draft` → `Draft`, `published` → `Published`).
- **UI:** Ensure "View Docs" and Delete (Trash can) buttons are interactive/visible.

## Templates Screen
- **Copy (Header):**
  - *New:* "Start with our pre-built templates to quickly create the article you need or create your own"
- **Copy (Button):**
  - *New:* "Create a Template" (Remove "...or let AI do it")
- **Input Field:**
  - *New Placeholder:* "Give a brief description of what this template is for..."

## Collections
- **Modal Header:**
  - *New:* "Add to a collection"
- **Modal Body:**
  - *New:* "Add [0] documents to a collection"
- **Dropdown:**
  - Remove "Select a collection..." from the list options; allow searching or picking from existing.
- **Buttons:**
  - *Right button:* "Add to Collection"
- **Deletion Modal:**
  - *New:* "Are you sure you want to delete the **[User guides]** collection?"

## Assign Category / Tag Modals
- **Dropdowns:** Remove "Select a..." placeholder from the options list. Provide valid options (e.g., "Uncategorised", "HR", etc.).
- **Buttons:** Change button text to "Assign Category" or "Assign Tag".

## Document Deletion Modal
- **Copy:**
  - *Headline:* "Delete documents"
  - *Body:* "**This action cannot be undone.** Are you sure you want to delete these [0] documents? This will permanently remove all of the selected documents and their content."
  - *Buttons:* `<Cancel>` `<Delete documents>` (Red/Danger style for delete).

## Content Audit / Index Health
- **Copy:**
  - Change "normalization" → "normalisation" (UK English).
  - Remove comma before "...and retrieval".
  - Breadcrumbs: Remove breadcrumb links if they are circular or unnecessary.
- **Table Headers:**
  - Change "Normalized" → "Normalised".
- **Empty States:**
  - *Categories:* "There are no categories yet, click + New Category to create one"
  - *Documents:* "Documents needing Re-indexing" (Rename table header).

## Branding
- **Buttons:** Add a confirmation modal ("Are you sure?") before resetting.
- **Success Message:**
  - *New:* "Colours reset. Brand colours have been reset to the default settings."

## Notifications
- **Logic:** If multiple options are selected, combine strings.
  - *Example:* "Your AI processing and consent preferences have been changed."

## Help Centre
- **Copy:**
  - *Header:* "Automatically transform audio recordings into comprehensive documentation"
  - *Header:* "Automatically transform videos into comprehensive documentation"
  - *Rating:* Change "100%" → "Excellent" (or "Perfect").