package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"eledrive/config"
	"eledrive/db"
	"eledrive/utils"
	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const (
	UserContextKey contextKey = "currentUser"
)

type JWTClaims struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

func GenerateToken(userID, username, email, role string, cfg *config.Config) (string, error) {
	claims := JWTClaims{
		UserID:   userID,
		Username: username,
		Email:    email,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)), // 7 days
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.JWTSecret))
}

func AuthMiddleware(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenStr := extractToken(r)
			if tokenStr == "" {
				utils.RespondError(w, http.StatusUnauthorized, "Authentication required")
				return
			}

			claims, err := parseToken(tokenStr, cfg)
			if err != nil {
				utils.RespondError(w, http.StatusUnauthorized, "Invalid or expired token")
				return
			}

			ctx := context.WithValue(r.Context(), UserContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func OptionalAuthMiddleware(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenStr := extractToken(r)
			if tokenStr != "" {
				if claims, err := parseToken(tokenStr, cfg); err == nil {
					ctx := context.WithValue(r.Context(), UserContextKey, claims)
					next.ServeHTTP(w, r.WithContext(ctx))
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

func extractToken(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
		return strings.TrimPrefix(authHeader, "Bearer ")
	}

	// Also check query param "token" (useful for direct file download / stream preview links)
	if qToken := r.URL.Query().Get("token"); qToken != "" {
		return qToken
	}

	// Or cookie
	if cookie, err := r.Cookie("token"); err == nil {
		return cookie.Value
	}

	return ""
}

func parseToken(tokenStr string, cfg *config.Config) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(cfg.JWTSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

func GetUserClaims(ctx context.Context) *JWTClaims {
	if val, ok := ctx.Value(UserContextKey).(*JWTClaims); ok {
		return val
	}
	return nil
}

func MaintenanceMiddleware(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			isMaint, notice := db.GetMaintenanceStatus()
			if !isMaint {
				next.ServeHTTP(w, r)
				return
			}

			// Whitelist public system endpoints and live events
			path := r.URL.Path
			if strings.HasPrefix(path, "/api/system/status") ||
				strings.HasPrefix(path, "/api/realtime") ||
				strings.HasPrefix(path, "/api/events") ||
				strings.HasPrefix(path, "/api/sync") ||
				strings.HasPrefix(path, "/api/live-sync") {
				next.ServeHTTP(w, r)
				return
			}

			// Allow login requests to pass through to AuthHandler.Login (which validates admin/owner role)
			if strings.HasPrefix(path, "/api/auth/login") {
				next.ServeHTTP(w, r)
				return
			}

			// If request has authenticated claims or valid admin/owner token, allow
			claims := GetUserClaims(r.Context())
			if claims == nil && cfg != nil {
				if tokenStr := extractToken(r); tokenStr != "" {
					claims, _ = parseToken(tokenStr, cfg)
				}
			}

			if claims != nil && (claims.Role == "admin" || claims.Role == "owner") {
				next.ServeHTTP(w, r)
				return
			}

			if notice == "" {
				notice = "The platform is currently undergoing scheduled maintenance. Please check back shortly."
			}

			// Block all other requests with 503 Service Unavailable
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"success":          false,
				"error":            notice,
				"maintenance_mode": true,
				"message":          notice,
			})
		})
	}
}
