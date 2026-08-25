# Fixed Login and Employee Deletion

## Login Issues
- Corrected `API_BASE_URL` port in `src/services/config.ts` from 3001 to 3002 (matching the backend).
- Moved `erp/funcionarios` route registration in `backend/src/index.ts` to be before `restrictDemo` middleware.
- Refined path checking in `backend/src/routes/erp-funcionarios.ts` middleware to correctly allow public access to `/login`.
- Improved CPF masking in `AppFuncionarios.tsx` to prevent entry of more than 11 digits.

## Employee Deletion
- Implemented hybrid deletion policy in `FuncionariosList.tsx`:
    - Clicking delete now prompts the user with two options:
        1. **Inactivate** (Soft delete): Marks as `active = false`, preserving history.
        2. **Permanent Delete** (Hard delete): Removes from database.
- Backend handles `permanent=true` query parameter for physical deletion.
- Added safety check to prevent permanent deletion if there are linked records (Foreign Key constraints).

## Backend Reliability
- Re-installed dependencies and rebuilt the backend to ensure all TypeScript changes were applied.
- Validated that the server is running on port 3002.
