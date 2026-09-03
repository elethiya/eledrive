# EleDrive - Team Cloud Drive & Project Workspace

A modern, high-performance, self-hosted team cloud drive built with **Golang**, **SQLite**, and **ReactJS**. Designed for engineering teams to share code projects, folders, assets, and documents with granular collaboration permissions, public sharing links, an **Admin Panel**, a **User Profile Manager**, a **sleek Dark Theme**, and **full Mobile Optimization**.

---

## 🌟 Key Features

### 🌙 1. Sleek Dark Theme
- **High-contrast, developer-first dark mode** (`slate-950` / `slate-900`) across all pages, modals, sidebars, lightboxes, and code previewers.
- Glowing accents, subtle gradient touches, and custom dark scrollbars.

### 📱 2. Full Mobile & Touch Optimization
- **Off-Canvas Slide-Out Navigation**: On screens `< 768px`, the sidebar turns into a smooth slide-out drawer with a backdrop overlay and close button.
- **Mobile Hamburger Header**: One-tap access to menu and team switcher.
- **Collapsible Search**: Expandable search input that fits on phone screens without crowding buttons.
- **Touch-Friendly Interaction**: Single-tap navigation for opening folders and previewing files on touchscreen devices.
- **Responsive 2-Column Grid**: Tighter mobile grid layout (`grid-cols-2`) and compact list views.
- **Responsive Modals**: Modals fit mobile viewports with scrollable containers and touch-friendly controls.

### ⚙️ 3. Admin Panel (`<url>/admin`)
- Accessible directly at **`http://localhost:8080/admin`** (or via the Sidebar/Navbar for Admin accounts).
- **System Metrics**: Real-time overview of total users, total files, total storage consumed, and active share links.
- **User Management & Per-User Profiles**:
  - View all registered team members in a searchable table.
  - Edit any user's profile: Display Name, Email, System Role (`admin` vs `member`).
  - Adjust storage quota limits per user (e.g., 10 GB, 25 GB, 50 GB, 100 GB).
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

### 👤 4. Per-User Profile & Security Page
- Accessible from the Sidebar or Profile dropdown ("My Profile & Settings").
- **Personal Information**: Edit display name and choose custom avatar accent colors.
- **Account Security**: Change account password with current-password verification.
- **Storage Breakdown**: Visual storage meter and breakdown across file types (code, documents, images, videos, audio, archives).

### 📁 5. Full Folder & Project Upload
- **Recursive Directory Upload**: Drag & drop or pick entire directories / code projects (`webkitdirectory`). EleDrive preserves nested subdirectories and files automatically.
- **On-The-Fly ZIP Download**: Download entire folders or codebases as a single `.zip` archive at any depth.
- **Code & Syntax Live Preview**: Instant in-browser viewer for code files (`.go`, `.js`, `.jsx`, `.ts`, `.tsx`, `.py`, `.json`, `.sql`, `.html`, `.css`, `.md`, `.env`, etc.) with line numbers.
- **Media Lightbox**: Stream videos, listen to audio, preview images, and view PDFs directly in the browser.

### 👥 6. Team Member Sharing & Permissions
- **Granular Access Controls**:
  - **Can Edit & Upload**: Teammates can view, download, rename, and upload files directly into the shared folder.
  - **Viewer**: Read-only access to view and download files.
- **Shared With Me View**: Dedicated view listing all folders and files shared with the current user.
- **User Search**: Easily find team members by name or email when sharing.

### 🔗 7. Public Share Links (With Guest Upload Support)
- **Upload & View Permission**: External collaborators and clients can upload files directly into your shared drive folder without needing an account!
- **Password Protection**: Secure sensitive shares with optional password encryption.
- **Expiration Dates**: Set share links to expire after 7, 30, 90 days, or never.
- **Direct ZIP Downloads**: Anyone with the link can download the whole project as a ZIP.

---

## 👥 Seed Accounts

| Account | Email | Password | Role |
|---|---|---|---|
| **Admin Lead** | `admin@eledrive.local` | `password123` | Administrator (Access to `/admin`) |
| **Alex Miller** | `alex@eledrive.local` | `password123` | Team Member |
| **Sarah Connor** | `sarah@eledrive.local` | `password123` | Team Member |

*(You can switch between teammates in 1 click using the profile menu in the top-right corner of the interface)*.

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

## 📂 Project Structure

```
eledrive/
├── config/              # Server configuration and environment variable loading
├── data/                # SQLite database and stored file assets (git-ignored)
│   ├── eledrive.db      # SQLite database with WAL mode
│   └── storage/         # Physical files stored on disk
├── db/                  # SQLite schema initialization and migration logic
├── handlers/            # HTTP handlers
│   ├── admin.go         # Admin stats, user management, audit logs, and settings
│   ├── auth.go          # User registration, login, and team lookup
│   ├── files.go         # File CRUD, preview, and download
│   ├── folders.go       # Folder CRUD, ZIP generation, and star/trash
│   ├── profile.go       # User profile and password updates
│   ├── public_share.go  # Token-based public sharing and guest uploads
│   ├── shares.go        # Team direct sharing and permissions
│   ├── stats.go         # User metrics, recent, starred, and trash lists
│   └── upload.go        # Recursive folder and multi-file uploads
├── middleware/          # JWT authentication and CORS middleware
├── models/              # Go data structs
├── storage/             # File storage service and ZIP streaming
├── utils/               # JSON responses and MIME detection helpers
├── frontend/            # React 19 + Vite SPA
│   ├── dist/            # Production frontend build (served by backend)
│   └── src/
│       ├── api/         # Axios API client
│       ├── components/  # Sidebar, Navbar, FileCard, Breadcrumbs, and Modals
│       ├── context/     # AuthContext (state & session management)
│       ├── pages/       # Drive, Shared, Recent, Starred, Trash, Admin, Profile
│       └── utils/       # Formatters (bytes, dates, icons)
├── main.go              # Entrypoint, route mounting, and SPA fallback
├── start.sh             # Startup script (builds frontend & runs server)
├── .gitignore           # Complete ignore rules for Go, Node, Vite, and SQLite
└── README.md
```

---

## 🚀 Quick Start

### 1. Run the Startup Script
The `start.sh` script automatically checks and builds the frontend bundle, compiles the Go backend, and runs the application:
```bash
chmod +x start.sh
./start.sh
```

### 2. Manual Setup (Alternative)

**Build Frontend:**
```bash
cd frontend
npm install
npm run build
cd ..
```

**Run Go Backend:**
```bash
go build -o eledrive-app .
./eledrive-app
```

Then open your browser at **[http://localhost:8080](http://localhost:8080)**.

To access the Admin Console directly: **[http://localhost:8080/admin](http://localhost:8080/admin)**.

---

## 🌐 API Endpoints Reference

### Authentication & Profile
- `POST /api/auth/register` - Create a new team user account
- `POST /api/auth/login` - Authenticate and receive JWT token
- `GET /api/auth/me` - Get current authenticated user profile
- `PUT /api/user/profile` - Update display name and avatar color
- `PUT /api/user/password` - Change account password

### Folders & Files
- `GET /api/folders?parent_id={id}` - Retrieve folder contents and path breadcrumbs
- `POST /api/folders` - Create a new folder
- `PUT /api/folders/{id}` - Rename folder
- `POST /api/folders/{id}/move` - Move folder to target parent
- `POST /api/folders/{id}/star` - Toggle starred state
- `DELETE /api/folders/{id}` - Move folder to trash
- `POST /api/folders/{id}/restore` - Restore folder from trash
- `DELETE /api/folders/{id}/permanent` - Permanently delete folder
- `GET /api/folders/{id}/download` - Download entire folder hierarchy as `.zip`
- `POST /api/upload` - Upload multiple files or full folder projects
- `GET /api/files/search?q={query}&type={type}` - Search files and folders
- `GET /api/files/{id}/preview` - Get code/text preview content
- `GET /api/files/{id}/download?inline={0|1}` - Stream or download file

### Team & Public Sharing
- `POST /api/shares` - Share folder/file with a teammate
- `GET /api/shares` - List items shared with current user
- `DELETE /api/shares/{id}` - Revoke team member share
- `POST /api/share-links` - Generate public link (supports guest upload permission)
- `GET /api/public/share/{token}` - View shared folder/file metadata
- `GET /api/public/share/{token}/download` - Download shared item or folder ZIP
- `POST /api/public/share/{token}/upload` - Upload files into shared folder as guest

### Admin Console (`/admin`)
- `GET /api/admin/stats` - Platform storage and activity metrics
- `GET /api/admin/users` - List all users with storage limits and usage
- `PUT /api/admin/users/{id}` - Update user profile, role, quota, or reset password
- `DELETE /api/admin/users/{id}` - Delete user account and disk storage
- `GET /api/admin/logs?action={action}&q={query}` - Filter system audit logs
- `DELETE /api/admin/logs` - Clear activity logs
- `GET /api/admin/settings` - View platform settings
- `PUT /api/admin/settings` - Update platform settings

---

## ⚙️ Environment Variables

EleDrive can be configured using environment variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Port for the HTTP server |
| `DB_PATH` | `data/eledrive.db` | Path to the SQLite database file |
| `STORAGE_DIR` | `data/storage` | Path to directory where files are stored |
| `JWT_SECRET` | `eledrive-secret-key-...` | Secret key used for signing JWT tokens |
| `JWT_EXPIRY_HOURS` | `168` (7 days) | Token expiration duration in hours |
| `MAX_UPLOAD_SIZE_MB`| `1024` (1 GB) | Maximum allowed file upload size in MB |
| `DEFAULT_STORAGE_LIMIT_GB` | `10` (10 GB) | Storage quota for newly registered users |
