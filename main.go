package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"eledrive/config"
	"eledrive/db"
	"eledrive/handlers"
	"eledrive/middleware"
	"eledrive/storage"
	"eledrive/utils"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	// CLI helper flags for administration and set-owner.sh
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "--hash-password":
			if len(os.Args) > 2 {
				h, err := bcrypt.GenerateFromPassword([]byte(os.Args[2]), bcrypt.DefaultCost)
				if err != nil {
					fmt.Fprintf(os.Stderr, "Error hashing password: %v\n", err)
					os.Exit(1)
				}
				fmt.Print(string(h))
				os.Exit(0)
			}
			fmt.Fprintln(os.Stderr, "Usage: eledrive-app --hash-password <password>")
			os.Exit(1)

		case "--init-db":
			cfg := config.LoadConfig()
			database, err := db.InitDB(cfg)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Failed to initialize database: %v\n", err)
				os.Exit(1)
			}
			database.Close()
			fmt.Println("Database initialized successfully.")
			os.Exit(0)
		}
	}

	cfg := config.LoadConfig()

	// Initialize file & folder logger in database/logs/<date>/<time>.log/
	sessionDir, err := utils.InitLogger(cfg.LogsDir)
	if err != nil {
		log.Printf("\033[1;33m[WARN]\033[0m Failed to initialize log folder: %v", err)
	}

	// Initialize Database
	database, err := db.InitDB(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

	// Initialize Storage Service
	storageService := storage.NewStorageService(cfg)

	// Initialize Handlers
	authHandler := handlers.NewAuthHandler(cfg, storageService)
	folderHandler := handlers.NewFolderHandler(cfg, storageService)
	fileHandler := handlers.NewFileHandler(cfg, storageService)
	uploadHandler := handlers.NewUploadHandler(cfg, storageService)
	shareHandler := handlers.NewShareHandler(cfg, storageService)
	publicShareHandler := handlers.NewPublicShareHandler(cfg, storageService)
	statsHandler := handlers.NewStatsHandler(cfg, storageService)
	profileHandler := handlers.NewProfileHandler()
	adminHandler := handlers.NewAdminHandler(cfg, storageService)

	r := chi.NewRouter()

	// Global Middleware
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := chimw.NewWrapResponseWriter(w, r.ProtoMajor)
			next.ServeHTTP(ww, r)
			duration := time.Since(start).String()
			status := fmt.Sprintf("%d", ww.Status())
			utils.LogRequestToFile(r.Method, r.URL.Path, status, duration, r.RemoteAddr)
		})
	})
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:3000", "http://localhost:8080", "*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Share-Password"},
		ExposedHeaders:   []string{"Link", "Content-Disposition", "Content-Length"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// API Routes
	r.Route("/api", func(api chi.Router) {
		// Public Auth
		api.Post("/auth/register", authHandler.Register)
		api.Post("/auth/login", authHandler.Login)

		// Public Share endpoints (no account needed)
		api.Get("/public/share/{token}", publicShareHandler.GetPublicShareInfo)
		api.Get("/public/share/{token}/download", publicShareHandler.DownloadPublic)
		api.Post("/public/share/{token}/upload", publicShareHandler.UploadPublic)

		// Authenticated Routes
		api.Group(func(auth chi.Router) {
			auth.Use(middleware.AuthMiddleware(cfg))

			// Auth info & User lookup
			auth.Get("/auth/me", authHandler.Me)
			auth.Get("/users/search", authHandler.SearchUsers)
			auth.Get("/users", authHandler.ListTeamMembers)

			// Profile Settings (Per User)
			auth.Put("/user/profile", profileHandler.UpdateProfile)
			auth.Put("/user/password", profileHandler.ChangePassword)

			// Folders
			auth.Get("/folders", folderHandler.GetContents)
			auth.Post("/folders", folderHandler.Create)
			auth.Put("/folders/{id}", folderHandler.Update)
			auth.Post("/folders/{id}/star", folderHandler.ToggleStar)
			auth.Post("/folders/{id}/move", folderHandler.Move)
			auth.Delete("/folders/{id}", folderHandler.Trash)
			auth.Post("/folders/{id}/restore", folderHandler.Restore)
			auth.Delete("/folders/{id}/permanent", folderHandler.PermanentDelete)
			auth.Get("/folders/{id}/download", folderHandler.DownloadZip)

			// Files
			auth.Get("/files/search", fileHandler.Search)
			auth.Get("/files/{id}", fileHandler.GetMetadata)
			auth.Get("/files/{id}/download", fileHandler.Download)
			auth.Get("/files/{id}/preview", fileHandler.GetPreview)
			auth.Put("/files/{id}", fileHandler.Rename)
			auth.Post("/files/{id}/move", fileHandler.Move)
			auth.Post("/files/{id}/star", fileHandler.ToggleStar)
			auth.Delete("/files/{id}", fileHandler.Trash)
			auth.Post("/files/{id}/restore", fileHandler.Restore)
			auth.Delete("/files/{id}/permanent", fileHandler.PermanentDelete)

			// Uploads (Files & Projects / Folders)
			auth.Post("/upload", uploadHandler.Upload)

			// Team Member Direct Shares
			auth.Post("/shares", shareHandler.Create)
			auth.Get("/shares", shareHandler.GetSharedWithMe)
			auth.Get("/shares/target", shareHandler.GetTargetShares)
			auth.Delete("/shares/{id}", shareHandler.Delete)

			// Public Share Links Management
			auth.Post("/share-links", publicShareHandler.CreateLink)
			auth.Get("/share-links/target", publicShareHandler.GetTargetLink)
			auth.Delete("/share-links/{id}", publicShareHandler.DeleteLink)

			// Stats & Special Lists
			auth.Get("/stats", statsHandler.GetStats)
			auth.Get("/recent", statsHandler.GetRecent)
			auth.Get("/starred", statsHandler.GetStarred)
			auth.Get("/trash", statsHandler.GetTrash)
			auth.Post("/trash/empty", statsHandler.EmptyTrash)

			// Admin Panel Routes
			auth.Group(func(admin chi.Router) {
				admin.Use(adminHandler.RequireAdmin)
				admin.Get("/admin/stats", adminHandler.GetStats)
				admin.Get("/admin/logs", adminHandler.GetLogs)
				admin.Delete("/admin/logs", adminHandler.ClearLogs)
				admin.Get("/admin/users", adminHandler.ListUsers)
				admin.Put("/admin/users/{id}", adminHandler.UpdateUser)
				admin.Post("/admin/users/{id}/approve", adminHandler.ApproveUser)
				admin.Post("/admin/users/{id}/reject", adminHandler.RejectUser)
				admin.Delete("/admin/users/{id}", adminHandler.DeleteUser)
				admin.Get("/admin/settings", adminHandler.GetSettings)
				admin.Put("/admin/settings", adminHandler.UpdateSettings)

				// Security & Forensic Leak Tracker
				admin.Post("/admin/security/inspect", adminHandler.InspectLeak)
				admin.Get("/admin/security/stats", adminHandler.GetSecurityStats)
			})
		})
	})

	// Static frontend file serving / SPA routing fallback
	frontendDist := filepath.Join("frontend", "dist")
	if _, err := os.Stat(frontendDist); err == nil {
		fileServer := http.FileServer(http.Dir(frontendDist))
		spaHandler := func(w http.ResponseWriter, r *http.Request) {
			path := filepath.Join(frontendDist, r.URL.Path)
			if _, err := os.Stat(path); os.IsNotExist(err) || strings.HasPrefix(r.URL.Path, "/share/") || strings.HasPrefix(r.URL.Path, "/admin") {
				http.ServeFile(w, r, filepath.Join(frontendDist, "index.html"))
				return
			}
			fileServer.ServeHTTP(w, r)
		}
		r.Get("/*", spaHandler)
		r.Head("/*", spaHandler)
	}

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("\033[1;34m==================================================\033[0m")
	log.Printf("\033[1;32m[SERVER]\033[0m   EleDrive running on http://localhost%s", addr)
	log.Printf("\033[1;34m[STORAGE]\033[0m  Storage dir: %s", cfg.StorageDir)
	log.Printf("\033[1;35m[ACCOUNT]\033[0m  Account DB:  %s", cfg.AccountDBPath)
	log.Printf("\033[1;35m[DRIVE]\033[0m    Drive DB:    %s", cfg.DriveDBPath)
	log.Printf("\033[1;36m[LOGS]\033[0m     Logs dir:    %s", sessionDir)
	log.Printf("\033[1;34m==================================================\033[0m")

	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
