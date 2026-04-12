package server

import (
	"database/sql"
	"fmt"
	"log"
	"net"
	"net/http"
	"strings"

	"tabzen-service/internal/handler"
)

const DefaultPort = 7824

func Start(db *sql.DB, port int) error {
	h := handler.New(db)
	mux := RegisterRoutes(h)
	wrapped := corsMiddleware(mux)

	addr := fmt.Sprintf("127.0.0.1:%d", port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("listen %s: %w", addr, err)
	}

	go func() {
		log.Printf("HTTP server listening on %s", addr)
		if err := http.Serve(ln, wrapped); err != nil {
			log.Printf("HTTP server error: %v", err)
		}
	}()

	return nil
}

var allowedOriginPrefixes = []string{
	"chrome-extension://",
	"moz-extension://",
	"http://localhost",
	"http://127.0.0.1",
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if isAllowedOrigin(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func isAllowedOrigin(origin string) bool {
	for _, prefix := range allowedOriginPrefixes {
		if strings.HasPrefix(origin, prefix) {
			return true
		}
	}
	return false
}
