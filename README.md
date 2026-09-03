# EleDrive - Team Cloud Drive & Project Workspace

A modern, fast, self-hosted team cloud drive built with **Golang**, **SQLite**, and **ReactJS**. Designed for engineering teams to share code projects, folders, assets, and documents with granular collaboration permissions, public sharing links, an **Admin Panel**, a **User Profile Manager**, and a **sleek Dark Theme**.

---

## 🌟 Key Features

### 🌙 1. Sleek Dark Theme
- **High-contrast, developer-first dark mode** (`slate-950` / `slate-900`) across all pages, modals, sidebars, lightboxes, and code previewers.
- Glowing accents, subtle gradient touches, and custom dark scrollbars.

### ⚙️ 2. Admin Panel (`<url>/admin`)
- Accessible directly at **`http://localhost:8080/admin`** (or via the Sidebar/Navbar for Admin accounts).
- **System Metrics**: Real-time overview of total users, total files, total storage consumed, and active share links.
- **User Management & Per-User Profiles**:
  - View all registered team members in a searchable table.
  - Edit any user's profile: Display Name, Email, System Role (`admin` vs `member`).
  - Adjust storage quota limits per user (e.g. 10 GB, 25 GB, 50 GB, 100 GB).
  - Admin password override / reset.
  - Delete user accounts with automatic disk and database cleanup.
- **Audit & Activity Logs**:
  - Live table of system events: Logins, Uploads, Downloads, Deletions, Shares, Password Changes, and Administrative Updates.
  - Filter logs by action type or search by keyword.
  - Clear logs action.
- **System Settings**:
  - Platform / Workspace Name customization.
  - Default storage quota for newly registered users.
  - Max upload file size limit.
  - Toggle public self-registration on/off.
  - Toggle public share link generation on/off.

### 👤 3. Per-User Profile & Security Page
- Accessible from the Sidebar or Profile dropdown ("My Profile & Settings").
- **Personal Information**: Edit display name and choose custom avatar accent colors.
- **Account Security**: Change account password with current-password verification.
- **Storage Breakdown**: Visual storage meter and breakdown across file types (code, documents, images, videos, audio, archives).

### 📁 4. Full Folder & Project Upload
- **Recursive Directory Upload**: Drag & drop or pick entire directories / code projects (`webkitdirectory`). EleDrive preserves nested subdirectories and files automatically.
- **On-The-Fly ZIP Download**: Download entire folders or codebases as a single `.zip` archive at any depth.
- **Code & Syntax Live Preview**: Instant in-browser viewer for code files (`.go`, `.js`, `.jsx`, `.ts`, `.tsx`, `.py`, `.json`, `.sql`, `.html`, `.css`, `.md`, `.env`, etc.) with line numbers.
- **Media Lightbox**: Stream videos, listen to audio, preview images, and view PDFs directly in the browser.

### 👥 5. Team Member Sharing & Permissions
- **Granular Access Controls**:
  - **Can Edit & Upload**: Teammates can view, download, rename, and upload files directly into the shared folder.
  - **Viewer**: Read-only access to view and download files.
- **Shared With Me View**: Dedicated view listing all folders and files shared with the current user.
- **User Search**: Easily find team members by name or email when sharing.

### 🔗 6. Public Share Links (With Guest Upload Support)
- **Upload & View Permission**: External collaborators and clients can upload files directly into your shared drive folder without needing an account!
- **Password Protection**: Secure sensitive shares with optional password encryption.
- **Expiration Dates**: Set share links to expire after 7, 30, 90 days, or never.
- **Direct ZIP Downloads**: Anyone with the link can download the whole project as a ZIP.

---

## 🏗️ Architecture & Tech Stack

- **Backend**: Golang (`go1.24+`)
  - Router: `go-chi/chi/v5`
  - Authentication: JWT (`golang-jwt/jwt/v5`) + `bcrypt`
  - Database: Pure Go SQLite (`modernc.org/sqlite`) with WAL mode
  - Storage Engine: Local filesystem storage with automatic MIME detection and on-the-fly streaming ZIP compression (`archive/zip`)
- **Database**: SQLite (`data/eledrive.db`)
  - Relational schema: `users`, `folders`, `files`, `shares`, `share_links`, `activity_logs`, `system_settings`
- **Frontend**: React 19 + Vite + Tailwind CSS + Lucide Icons + Axios
  - Built as a single-page application served directly by the Go binary.

---

## 🚀 Quick Start

Run the server with:
```bash
./start.sh
# Or run the compiled binary directly:
./eledrive-app
```
Then open **[http://localhost:8080](http://localhost:8080)**.

To access the Admin Console directly, navigate to **[http://localhost:8080/admin](http://localhost:8080/admin)**.

---

## 👥 Seed Accounts

| Account | Email | Password | Role |
|---|---|---|---|
| **Admin Lead** | `admin@eledrive.local` | `password123` | Administrator |
| **Alex Miller** | `alex@eledrive.local` | `password123` | Team Member |
| **Sarah Connor** | `sarah@eledrive.local` | `password123` | Team Member |

*(You can switch between teammates in 1 click using the profile menu in the top-right corner of the interface)*.
