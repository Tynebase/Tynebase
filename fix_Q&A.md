Phase 1: Critical System Failures (The "House is on Fire" List)

Focus on these first. These issues prevent the core purpose of the app (creating and saving content) from functioning.

    AI Generation Failures (YouTube, Direct URL, & File Upload): The 500/400 errors appearing here suggest the backend service handling AI ingestion is broken or timing out.

    AI Enhancement Logic: The AI is hallucinating (adding random letters/removing spaces) rather than formatting. This implies a prompt engineering issue or a temperature setting that is too high on the model.

    Template Creation Error: The error occurring when using DeepSeek/Claude indicates a failure in the API connection or response parsing for templates.

    Save Functionality (Settings & Profile): Users cannot update their workspace or profile. This is usually a database permission issue or a broken API endpoint.

    Index Health/Re-indexing: The re-index failure prevents search from working correctly.

    Content Audit 404: The main functionality of this screen is dead (404 error).

Phase 2: Functional Bugs & Broken Navigation

Once the core engine works, fix the controls so users can actually drive the car.

    Dead Buttons/Links:

        Tags: "View docs" is broken.

        Community: "Post new discussion" is broken.

        Imports: "Start Import" is broken.

        Dashboard: Clicking an article title does nothing.

        Notifications: Clicking notifications or "Mark all as read" does nothing.

        Admin Toggle: Selecting Admin in Team Members shows no results.

    Filters: The filters on All Documents, Tags, and Dashboard are currently non-functional.

    Indexing Status: Items showing as "Outdated" immediately after indexing suggests a timestamp logic error in the database.

Phase 3: Architectural & Workflow Decisions

These are not bugs, but logic gaps you need to decide on to prevent data loss or confusion.

    Document Editing Flow (Publish vs. Draft):

        Recommendation: Your suggestion is correct. Adopt a standard CMS flow:

            When a published doc is edited, it enters a dirty state.

            "Save" = Saves to Draft (Published version remains the old one).

            "Publish" = Pushes Draft to Live.

    Category Deletion Logic:

        Recommendation: Yes, make a "Default/Uncategorised" category that cannot be deleted. If a user deletes a custom category, force a migration of those documents to "Uncategorised" or ask them where to move them. Do not delete documents when a category is deleted (unless explicitly requested).

    Private Collections:

        Clarification: "Private" usually means "Only visible to the creator and specific invitees." "Company" visibility is usually the default state of a "Public" internal collection.

    Delete Documents:

        Confirmation: Absolutely requires a modal confirmation to prevent accidental data loss.

Phase 4: UX Enhancements

These make the app feel professional.

    Modal vs. Page Scroll: On the AI changes screen, use CSS overflow-y: scroll on the modal body so the background page stays still.

    Dropdowns: Remove placeholder text like "Select a category..." from the actual selectable list.

    Drag and Drop: This is a "Nice to Have" (P3/P4 priority). Focus on making the buttons work first.