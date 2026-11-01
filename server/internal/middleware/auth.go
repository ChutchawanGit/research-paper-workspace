package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"paper-platform/internal/service"
)

type contextKey string

const (
	UserClaimsKey contextKey = "user_claims"
	UserIDKey     contextKey = "user_id"
)

func AuthMiddleware(authService *service.AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenString := ""

			// 1. Check HttpOnly Cookie
			cookie, err := r.Cookie("auth_token")
			if err == nil && cookie.Value != "" {
				tokenString = cookie.Value
			}

			// 2. Fallback to Authorization Header (Bearer token)
			if tokenString == "" {
				authHeader := r.Header.Get("Authorization")
				if strings.HasPrefix(authHeader, "Bearer ") {
					tokenString = strings.TrimPrefix(authHeader, "Bearer ")
				}
			}

			if tokenString == "" {
				http.Error(w, `{"error":"unauthorized: missing token"}`, http.StatusUnauthorized)
				return
			}

			claims, err := authService.ValidateToken(tokenString)
			if err != nil {
				http.Error(w, `{"error":"unauthorized: invalid or expired token"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), UserClaimsKey, claims)
			ctx = context.WithValue(ctx, UserIDKey, claims.UserID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetUserIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	val := ctx.Value(UserIDKey)
	if val == nil {
		return uuid.Nil, false
	}
	id, ok := val.(uuid.UUID)
	return id, ok
}

func GetUserClaimsFromContext(ctx context.Context) (*service.UserClaims, bool) {
	val := ctx.Value(UserClaimsKey)
	if val == nil {
		return nil, false
	}
	claims, ok := val.(*service.UserClaims)
	return claims, ok
}
