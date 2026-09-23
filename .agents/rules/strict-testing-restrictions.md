# Strict Testing & File Access Restrictions

## ⚠️ CRITICAL RULE: NEVER USE GOOGLE DRIVE FILES
- **Strictly Prohibited**: Never access, read, list, test, debug, validate, or develop with ANY Google Drive files, Google Drive paths, or cloud drive directories under ANY circumstances, now or in the future, unless the user explicitly gives written permission in chat.
- **Allowed Test Files ONLY**: Use ONLY local sample files located strictly within the workspace directory:
  - `d:/SP-Prj/Preview-application/apps/demo/public/samples/`
  - `d:/SP-Prj/Preview-application/apps/demo/public/uploaded-samples/`
  - Workspace-local scratch files in `d:/SP-Prj/Preview-application/scratch/`
- **Zero Exceptions**: If a test file is needed that does not exist in the above directories, ask the user or create a synthetic test file locally within the workspace scratch folder. NEVER look for or use files from Google Drive.
