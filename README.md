# EleDrive - Team Cloud Drive & Project Workspace

A modern, fast, self-hosted team cloud drive built with **Golang**, **SQLite**, and **ReactJS**. Designed for engineering teams to share code projects, folders, assets, and documents with granular collaboration permissions and public sharing links.

---

## 🌟 Key Features

### 📁 1. Full Folder & Project Upload
- **Recursive Directory Upload**: Drag & drop or choose entire directories / code projects (`webkitdirectory`). EleDrive preserves nested subdirectories and files automatically.
- **On-The-Fly ZIP Download**: Download entire folders or codebases as a single `.zip` archive at any depth.
- **Code & Syntax Live Preview**: Instant in-browser viewer for code files (`.go`, `.js`, `.jsx`, `.ts`, `.tsx`, `.py`, `.json`, `.sql`, `.html`, `.css`, `.md`, `.env`, etc.) with line numbers.
- **Media Lightbox**: Stream videos, listen to audio, preview images, and view PDFs directly in the browser.

### 👥 2. Team Member Sharing & Permissions
- **Granular Access Controls**:
  - **Can Edit & Upload**: Teammates can view, download, rename, and upload files directly into the shared folder.
  - **Viewer**: Read-only access to view and download files.
- **Shared With Me View**: Dedicated view listing all folders and files shared with the current user.
- **User Search**: Easily find team members by name or email when sharing.

### 🔗 3. Public Share Links (With Guest Upload Support!)
- **Upload & View Permission**: External collaborators and clients can upload files directly into your shared drive folder without needing an account!
- **Password Protection**: Secure sensitive shares with optional password encryption.
- **Expiration Dates**: Set share links to expire after 7, 30, 90 days, or never.
- **Direct ZIP Downloads**: Anyone with the link can download the whole project as a ZIP.

### 🛡️ 4. Storage Quota & File Management
- **Trash & Restore**: Soft deletion with safe restoration or permanent empty trash.
- **Starred Items**: Quick access to starred projects and files.
- **Global Search & Filters**: Search across all files with category filters (Code/Projects, Documents, Images, Archives, All).
- **Fast Account Switcher**: Built-in test account switcher in the profile menu to quickly simulate multi-user team workflows.

---

## 🏗️ Architecture & Tech Stack

- **Backend**: Golang (`go1.24+`)
  - Router: `go-chi/chi/v5`
  - Authentication: JWT (`golang-jwt/jwt/v5`) + `bcrypt`
  - Database: Pure Go SQLite (`modernc.org/sqlite`) with WAL mode
  - Storage Engine: Local filesystem storage with automatic MIME detection and on-the-fly streaming ZIP compression (`archive/zip`)
- **Database**: SQLite (`data/eledrive.db`)
  - Automatic migrations and relational schema with foreign key cascades
- **Frontend**: React 19 + Vite + Tailwind CSS + Lucide Icons + Axios
  - Embedded single-page application served directly by the Go backend or running via Vite dev server.

---

## 🚀 Quick Start

### Option 1: Run the Server Directly
```bash
./start.sh
```
Or manually:
```bash
./eledrive-app
```
Then open your browser at **[http://localhost:8080](http://localhost:8080)**.

### Option 2: Development Mode with Hot Reload
In terminal 1 (Backend):
```bash
go run main.go
```
In terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)**. Requests to `/api` are automatically proxied to `:8080`.

---

## 👥 Seed Accounts (Ready to Use)

The SQLite database automatically initializes three team accounts:

| Name | Email | Password | Role | Storage Quota |
|---|---|---|---|---|
| **Admin User** | `admin@eledrive.local` | `password123` | Team Lead | 20 GB |
| **Alex Miller** | `alex@eledrive.local` | `password123` | Teammate | 10 GB |
| **Sarah Connor** | `sarah@eledrive.local` | `password123` | Teammate | 10 GB |

> *Tip: You can switch between accounts in 1 click from the profile menu in the top-right corner of the web interface!*

---

## 📡 API Overview

### Authentication
- `POST /api/auth/register` - Create a team member account
- `POST /api/auth/login` - Authenticate and get JWT token
- `GET /api/auth/me` - Current user profile and storage stats
- `GET /api/users/search?q={query}` - Search users to share items

### Folders & Files
- `GET /api/folders?folder_id={id}` - List subfolders and files
- `POST /api/folders` - Create a folder
- `PUT /api/folders/{id}` - Rename or recolor folder
- `POST /api/folders/{id}/move` - Move folder
- `POST /api/folders/{id}/star` - Toggle star
- `DELETE /api/folders/{id}` - Move folder to trash
- `POST /api/folders/{id}/restore` - Restore from trash
- `GET /api/folders/{id}/download` - Download entire folder as ZIP
- `POST /api/upload` - Multipart upload for files and project folders (preserves `paths[]`)
- `GET /api/files/{id}/download` - Stream or download file
- `GET /api/files/{id}/preview` - Code/text preview
- `PUT /api/files/{id}` - Rename file
- `POST /api/files/{id}/move` - Move file
- `POST /api/files/{id}/star` - Toggle star
- `DELETE /api/files/{id}` - Move file to trash
- `GET /api/files/search?q={q}&type={type}` - Search files

### Team Sharing & Public Links
- `POST /api/shares` - Share folder or file with team member
- `GET /api/shares` - List all items shared with me
- `GET /api/shares/target?type={type}&id={id}` - List collaborators on item
- `DELETE /api/shares/{id}` - Revoke team share
- `POST /api/share-links` - Create public share link (with upload support)
- `GET /api/share-links/target?type={type}&id={id}` - Get public link info
- `DELETE /api/share-links/{id}` - Disable public link
- `GET /api/public/share/{token}` - Public view (no login needed)
- `GET /api/public/share/{token}/download` - Public download (file or ZIP)
- `POST /api/public/share/{token}/upload` - Public upload into shared folder

### Stats & Organization
- `GET /api/stats` - Storage quota usage breakdown
- `GET /api/recent` - Recently modified files
- `GET /api/starred` - Starred folders and files
- `GET /api/trash` - Trashed items
- `POST /api/trash/empty` - Permanently empty trash
