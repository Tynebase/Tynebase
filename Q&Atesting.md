# Tynebase Dashboard Feedback & QA Report

**Overview:** This document contains feedback, bug reports, and copy changes for the Tynebase dashboard.
**Global Preference:** Please ensure **UK English** spelling is used (e.g., *Customise*, *Summarise*) where specified.

---

## 1. Billing & Subscription
**URL:** `https://www.tynebase.com/dashboard/settings/billing`

### Copy Changes
*   **Header Description:** In the text "Manage your subscription, view usage, and update payment methods", remove the comma before "and".
    *   *New Text:* "Manage your subscription, view usage and update payment methods"

---

## 2. Team Members / Users
**URL:** `https://www.tynebase.com/dashboard/users`

### Functional Bugs
*   **Action Buttons:** The icons (Add user, Email, More options) next to team members are unresponsive when clicked.
*   **Invite User Error:** When sending an invitation, the button works and the invite is sent, but the UI displays a "Failed to send invitation email" error message incorrectly.

### UI/UX Improvements
*   **User Roles & Permissions:** There is a request to add a clickable information modal or tooltip explaining roles (Admin, Editor, Viewer) directly on this screen, similar to the "User Roles & Permissions" screenshot provided.
    *   *Current Location:* Currently located at the Admin page.
    *   *Requested Location:* Accessible via a click option on the Team Members page.

---

## 3. Settings (General & Privacy)
**URL:** `https://www.tynebase.com/dashboard/settings/privacy`

### Copy Changes
*   **Export Data Text:** In the sentence "Export all your data including documents, templates, usage history, and profile information...", remove the comma before "and".
*   **Delete Account Warning:**
    *   Bold the phrase: **‘This action cannot be undone’**.
    *   Remove the comma before "...and usage history" in the sentence "Deleting your account will permanently remove all your data including documents, templates, and usage history within 24 hours."

---

## 4. Branding
**URL:** `https://www.tynebase.com/dashboard/settings/branding`

### Copy Changes
*   **Spelling:** Change "Customize" to **"Customise"**.

### Functional Bugs
*   **Logo Upload:** Clicking options to add logos or favicons does not trigger a popup or file selector.
*   **Feature Request:** Is drag-and-drop functionality for images planned?

---

## 5. Audit Logs (Admin)
**URL:** `https://www.tynebase.com/dashboard/settings/audit-logs`

### UI/UX Improvements
*   **Sidebar Label:** Rename "Activity Log" to **"Audit Log"** in the admin sidebar to match the page title.
*   **Upgrade CTA:** The banner "Upgrade for longer retention" should be a clickable link directing the user to the upgrade page. Currently, it is static text.

### Copy Changes
*   **Search Placeholder:** Remove the comma in the search bar text.
    *   *Current:* "Search by user, action, or target..."
    *   *New:* "Search by user, action or target..."

---

## 6. Templates
**URL:** `https://www.tynebase.com/dashboard/templates`

### UI/UX Improvements
*   **Delete Option:** Feature query: Can we give users the option to delete templates?
*   **Formatting:** In the banner text "Start with our pre-built templates to quickly create the article you need or create your own", add a comma.
    *   *New Text:* "...article you need, or create your own"

### New Template Screen (`/templates/new`)
*   **Input Formatting:**
    *   Remove the space between "Template Title" and the asterisk `*`.
    *   Remove the space between "Template Content" and the asterisk `*`.
    *   Remove the space between "Category" and the asterisk `*`.
*   **Clarification:** "Markdown format" and "rich content" might need a hover tooltip to explain the terms to non-technical users.

### AI Generation Modal (in Templates)
*   **Copy Changes:**
    *   In the placeholder text: "e.g., A technical RFC document for proposing new features, with sections for problem statement, proposed solution, alternatives considered, and implementation plan..."
    *   **Action:** Remove the comma after "e.g." and the comma before "and implementation plan".
*   **Dark Mode Bug:** When generating a template from AI in dark mode, the input text is invisible (white text on white background or similar contrast issue).

### Template Creation Success Screen
**URL:** `.../templates/[ID]`
*   **Copy Changes:** Change the success message text.
    *   *Current:* "This template will be used to create a new document..."
    *   *New:* "A new document will be created as a draft. The template content will be copied to the new document"
*   **UI Cleanup:** Hide or rename the "Template ID: [long-hash]" displayed on the screen. It creates visual noise.

---

## 7. Community / Discussions
**URL:** `[Community Page]`

### Copy Changes
*   **Header Subtext:** Remove the comma before "or collect".
    *   *New:* "Ask a question, share an update or collect feedback."
*   **Input Placeholder:** Remove the comma before "and include".
    *   *New:* "Share your thoughts, add context and include any links..."
*   **Posting Tips Sidebar:** Remove the comma before "and what you already tried".

### Functional Bugs & UI
*   **Tags:** Capitalize the first letter of tags (e.g., **G**eneral, **I**deas, **Q**uestions, **A**nnouncements).
*   **Post Button:** The "Post" button is non-functional.
*   **Feature Request:** Add a polling system for community posts.

---

## 8. Content Audit & Health
**URL:** `https://www.tynebase.com/dashboard/audit`

### Functional Bugs
*   **Empty State:** Screen displays "No documents with views yet" even though the user has documents in the instance.

### UI/UX Improvements
*   **Content Health Logic:** The percentage breakdown seems incorrect (100% should be Excellent).
    *   *Proposed Scale:*
        *   80-100%: Excellent
        *   60-79.99%: Very good
        *   40-59.99%: Good
        *   20-39.99%: Poor
        *   0-19.99%: Very poor

---

## 9. All Documents / Knowledge Base
**URL:** `https://www.tynebase.com/dashboard/knowledge`

### UI/UX Improvements
*   **Delete Confirmation:** Request for a confirmation modal when deleting documents.
*   **Tags:** Capitalize status tags (e.g., **P**ublished, **D**raft).
*   **Column Headers:** Change the column header "CATEGORIES" to **"TAGS"**.
*   **Category Pills:**
    *   Add a header label "Categories" above the category filter pills.
    *   **Bug:** Re-ordering categories triggers a "Failed to save new order" error.
    *   **Bug:** Clicking "Query Workspace" results in a 404 error.
*   **View Options:** The "Views" (eye icon) has moved under the "Actions" column incorrectly. It needs its own column.
*   **Action Menu:**
    *   Change the menu option text "Move to Category" to **"Assign a Category"**.

---

## 10. Assign Category & Tags Modals

### Assign Category Modal
*   **Copy/Layout Changes:**
    *   Title: **Assign a Category**
    *   Subtext: **Assign [0] documents a category**
    *   Dropdown: Remove "Select a category" from inside the list. List should show specific options (Uncategorised, Example 1, Example 2).
    *   Buttons: Cancel | Assign category
*   **Feature:** Request for a confirmation screen after assignment.

### Assign Tag Modal
*   **Copy/Layout Changes:**
    *   Title: **Assign a Tag**
    *   Subtext: **Add a tag to [0] documents**
    *   Dropdown: Remove "Select a tag.." placeholder from the selectable list; show only available tags.
*   **UX Query:** User questions if the "Published/Draft" visual checkmark block is necessary inside the modal, as the status column already shows this info.

---

## 11. Document Editing
**URL:** `https://www.tynebase.com/dashboard/knowledge/[ID]`

### Functional Bugs
*   **Document Settings:** The buttons "Duplicate Document" and "Copy Public Link" are unresponsive.
*   **AI Enhancement:**
    *   **Scroll Issue:** The AI panel scrolls with the whole page. It should scroll independently so the user can view the article while reading AI suggestions.
    *   **Execution Errors:** AI is not applying suggested changes correctly, or is introducing random artifacts (random letters, removing spaces) not requested.
*   **Formatting Bug:** Text is rendering with vertical splits (one letter per line) in some instances (See "Inspiration", "Usage" screenshot).

### Feature Requests
*   **Drag and Drop:** Enable drag-and-drop of files/images directly into the article editor.

---

## 12. Category Management
**URL:** `https://www.tynebase.com/dashboard/knowledge/categories`

### UI/UX Improvements
*   **Alignment:** Action buttons are misaligned/scattered.
*   **Delete Flow:**
    *   **Logic Conflict:** The first modal says items will move to "Uncategorized (Default)", but the next screen asks the user to choose a destination.
    *   **Text Update:** Remove the specific destination text in the first modal. Replace with: "Documents and subcategories can be allocated to a new category".
    *   **Button Label:** Change "Delete Category" button on the first screen to **"Next"**.
    *   **Spelling:** Change "Uncategorized" to **"Uncategorised"** (UK English).
    *   **Bug:** Deleting a category results in a server error.

---

## 13. Miscellaneous Screens

### Collections & Tags Settings
*   **Confirmation:** Request for confirmation screens when deleting a Collection or a Tag.

### Activity Screen
**URL:** `.../dashboard/knowledge/activity`
*   **UX Query:** Why is there a "Community" button here?
*   **Bug:** "New Document" button redirects to a 404 page.

### My Drafts
*   **UX Query:** What is the specific function of the "Submit for review" button?

### Sources / Indexing
**URL:** `.../dashboard/sources`
*   **Copy:** Change "Needs Re-Index" to **"Needs Re-indexed"**.
*   **Header:** Change "Documents Needing Re-Index" to **"Documents needing Re-indexing"**.
*   **Bug:** After indexing, status instantly reverts to "Outdated".
*   **Normalized Markdown:** Capitalize tags (**P**ublished, **D**raft).
*   **Index Health:** "Re-run health checks" button is unresponsive.
*   **Recommended Actions:** Buttons "Retry failed normalizations" and "Review normalized Markdown" are unresponsive.

---

## 14. AI Assistant & Ingest
**URL:** `.../dashboard/ai-chat` & `.../ai-assistant`

### Functional Bugs
*   **Delete Chat:** The confirmation is a native browser alert. It should be a styled in-app modal.
*   **Ingest Quality:** Generating an article from a prompt results in half-finished content.
*   **Video Ingest:**
    *   Pasting a YouTube URL results in a "Processing Error" (400 Bad Request / Vertex AI error).
    *   "Generate" button is unresponsive.
*   **Audio Ingest:** Uploading audio results in a "Processing Error" (Whisper SageMaker exception).

### Copy Changes
*   **Spelling:** Change "Summarize" to **"Summarise"**.

### Recent Generations
*   **UI:** Not showing all history.
*   **Tags:** Capitalize tags.
*   **Navigation:** Clicking a generated article card does not navigate the user to the article.

---

## 15. Notifications
*   **Functional Bugs:**
    *   Clicking a notification item does nothing.
    *   "Mark all as read" button does not work.
    *   Clicking "View all notifications" does nothing.

---

## 16. User Settings & Permissions
**URL:** `https://www.tynebase.com/dashboard/settings/users`

### UI/UX Improvements
*   **Button Labels:**
    *   Capitalize "admin" (in the orange pill) to **"Admin"**.
    *   Change "Send Invites" button text to **"Invite users"**.
*   **Permission Stats:** The user counts shown on the Permission cards are inaccurate.
*   **Custom Roles:**
    *   Admins should be able to delete Custom Roles.
    *   Admins should *not* be able to delete System Roles.
*   **Edit Role Bug:** There is no way to edit permissions for a role after it has been created.
*   **Visual Bug:** The "Permission Matrix" columns become misaligned when a new custom role is added.