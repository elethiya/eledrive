package events

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"eledrive/utils"
)

type Event struct {
	Type      string      `json:"type"`      // e.g. "file:create", "file:delete", "folder:create", "team:update", "sync"
	Action    string      `json:"action"`    // "create", "update", "delete", "trash", "restore", "star", "move"
	Target    string      `json:"target"`    // "file", "folder", "team", "trash", "drive"
	ID        string      `json:"id,omitempty"`
	FolderID  string      `json:"folder_id,omitempty"`
	UserID    string      `json:"user_id,omitempty"`
	Timestamp int64       `json:"timestamp"`
	Payload   interface{} `json:"payload,omitempty"`
}

type Client struct {
	ID     string
	UserID string
	Send   chan []byte
}

type Hub struct {
	clients       map[*Client]bool
	activeUsers   map[string]int
	lastSeenUsers map[string]time.Time
	broadcast     chan []byte
	register      chan *Client
	unregister    chan *Client
	history       []Event
	historyMu     sync.RWMutex
	mu            sync.RWMutex
}

var GlobalHub *Hub

func init() {
	GlobalHub = NewHub()
}

func NewHub() *Hub {
	h := &Hub{
		clients:       make(map[*Client]bool),
		activeUsers:   make(map[string]int),
		lastSeenUsers: make(map[string]time.Time),
		broadcast:     make(chan []byte, 256),
		register:      make(chan *Client),
		unregister:    make(chan *Client),
		history:       make([]Event, 0, 100),
	}
	go h.run()
	return h
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			var wentOnline bool
			if client.UserID != "" {
				h.activeUsers[client.UserID]++
				h.lastSeenUsers[client.UserID] = time.Now()
				if h.activeUsers[client.UserID] == 1 {
					wentOnline = true
				}
			}
			h.mu.Unlock()
			if wentOnline {
				go h.BroadcastEvent("presence:update", "user", "online", client.UserID, "", client.UserID, map[string]interface{}{
					"user_id": client.UserID,
					"online":  true,
				})
			}
		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
				var wentOffline bool
				if client.UserID != "" {
					h.activeUsers[client.UserID]--
					if h.activeUsers[client.UserID] <= 0 {
						delete(h.activeUsers, client.UserID)
						wentOffline = true
					}
					h.lastSeenUsers[client.UserID] = time.Now()
				}
				h.mu.Unlock()
				if wentOffline {
					go h.BroadcastEvent("presence:update", "user", "offline", client.UserID, "", client.UserID, map[string]interface{}{
						"user_id": client.UserID,
						"online":  false,
					})
				}
			} else {
				h.mu.Unlock()
			}
		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.Send <- message:
				default:
				}
			}
			h.mu.RUnlock()
		}
	}
}

// RecordActiveUser updates the last active timestamp for a user
func (h *Hub) RecordActiveUser(userID string) {
	if userID == "" {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	h.lastSeenUsers[userID] = time.Now()
}

// SetUserPresence updates user online/offline status via webhook or direct event
func (h *Hub) SetUserPresence(userID string, online bool) {
	if userID == "" {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if online {
		h.activeUsers[userID] = 1
		h.lastSeenUsers[userID] = time.Now()
	} else {
		delete(h.activeUsers, userID)
		h.lastSeenUsers[userID] = time.Now().Add(-1 * time.Hour)
	}
}

// IsUserOnline returns true if user currently has an active connection or activity within 45 seconds
func (h *Hub) IsUserOnline(userID string) bool {
	if userID == "" {
		return false
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	if count, ok := h.activeUsers[userID]; ok && count > 0 {
		return true
	}
	if lastSeen, ok := h.lastSeenUsers[userID]; ok {
		return time.Since(lastSeen) < 45*time.Second
	}
	return false
}

// GetUserLastSeen returns milliseconds timestamp of last activity
func (h *Hub) GetUserLastSeen(userID string) int64 {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if lastSeen, ok := h.lastSeenUsers[userID]; ok {
		return lastSeen.UnixMilli()
	}
	return 0
}

// GetAllPresence returns a map of online status for active users
func (h *Hub) GetAllPresence() map[string]bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	res := make(map[string]bool)
	for uid, count := range h.activeUsers {
		if count > 0 {
			res[uid] = true
		}
	}
	cutoff := time.Now().Add(-45 * time.Second)
	for uid, lastSeen := range h.lastSeenUsers {
		if lastSeen.After(cutoff) {
			res[uid] = true
		}
	}
	return res
}

// BroadcastEvent sends an event to all connected realtime clients on this hub
func (h *Hub) BroadcastEvent(eventType, target, action, id, folderID, userID string, payload interface{}) {
	evt := Event{
		Type:      eventType,
		Target:    target,
		Action:    action,
		ID:        id,
		FolderID:  folderID,
		UserID:    userID,
		Timestamp: time.Now().UnixMilli(),
		Payload:   payload,
	}

	// Keep rolling history of last 100 events for HTTP polling fallback
	h.historyMu.Lock()
	h.history = append(h.history, evt)
	if len(h.history) > 100 {
		h.history = h.history[len(h.history)-100:]
	}
	h.historyMu.Unlock()

	data, err := json.Marshal(evt)
	if err == nil {
		select {
		case h.broadcast <- data:
		default:
		}
	}
}

// Broadcast sends an event to all connected realtime clients
func Broadcast(eventType, target, action, id, folderID, userID string, payload interface{}) {
	if GlobalHub != nil {
		GlobalHub.BroadcastEvent(eventType, target, action, id, folderID, userID, payload)
	}
}

// ServeHTTP handles Server-Sent Events (SSE) connections
func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		userID = r.URL.Query().Get("uid")
	}
	if userID == "" {
		userID = r.URL.Query().Get("cid")
	}

	client := &Client{
		ID:     fmt.Sprintf("%d", time.Now().UnixNano()),
		UserID: userID,
		Send:   make(chan []byte, 64),
	}

	h.register <- client
	defer func() {
		h.unregister <- client
	}()

	// Send initial connection event with standard SSE retry configuration
	fmt.Fprintf(w, "retry: 3000\nevent: connected\ndata: {\"status\":\"connected\",\"time\":%d}\n\n", time.Now().UnixMilli())
	flusher.Flush()

	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()

	ctx := r.Context()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			fmt.Fprintf(w, ": keepalive\n\n")
			flusher.Flush()
		case msg, ok := <-client.Send:
			if !ok {
				return
			}
			fmt.Fprintf(w, "event: message\ndata: %s\n\n", string(msg))
			flusher.Flush()
		}
	}
}

// HandleWebhook processes inbound webhooks and triggers instant realtime broadcasts
func HandleWebhook(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Event    string      `json:"event"`
		Target   string      `json:"target"`
		Action   string      `json:"action"`
		ID       string      `json:"id"`
		FolderID string      `json:"folder_id"`
		UserID   string      `json:"user_id"`
		Data     interface{} `json:"data"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid webhook payload JSON")
		return
	}

	eventType := payload.Event
	if eventType == "" {
		eventType = "sync"
	}

	target := payload.Target
	if target == "" {
		target = "drive"
	}

	action := payload.Action
	if action == "" {
		action = "refresh"
	}

	targetUserID := payload.UserID
	if targetUserID == "" && payload.ID != "" && payload.Target == "user" {
		targetUserID = payload.ID
	}
	if payload.ID == "" && targetUserID != "" {
		payload.ID = targetUserID
	}

	// Handle real-time presence webhooks (replaces polling)
	if payload.Event == "presence:update" || payload.Event == "presence" || (payload.Target == "user" && (payload.Action == "online" || payload.Action == "offline")) {
		isOnline := payload.Action == "online"
		if dataMap, ok := payload.Data.(map[string]interface{}); ok {
			if onVal, exists := dataMap["online"]; exists {
				if onBool, ok := onVal.(bool); ok {
					isOnline = onBool
				}
			}
		}
		if targetUserID != "" && GlobalHub != nil {
			GlobalHub.SetUserPresence(targetUserID, isOnline)
		}
		if payload.Data == nil {
			payload.Data = map[string]interface{}{
				"user_id": targetUserID,
				"online":  isOnline,
			}
		}
		eventType = "presence:update"
		target = "user"
	}

	// Broadcast webhook event to all connected realtime clients
	Broadcast(eventType, target, action, payload.ID, payload.FolderID, targetUserID, payload.Data)

	utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"success":     true,
		"broadcasted": true,
		"event":       eventType,
		"target":      target,
		"received_at": time.Now().UnixMilli(),
	})
}

// HandleSyncPoll provides lightweight HTTP polling fallback for adblocker-restricted browsers
func HandleSyncPoll(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	sinceStr := r.URL.Query().Get("since")
	var since int64
	if sinceStr != "" {
		if s, err := strconv.ParseInt(sinceStr, 10, 64); err == nil {
			since = s
		}
	}

	userID := r.URL.Query().Get("uid")
	if userID == "" {
		userID = r.URL.Query().Get("user_id")
	}
	if userID != "" {
		GlobalHub.RecordActiveUser(userID)
	}

	var newEvents []Event
	GlobalHub.historyMu.RLock()
	if since > 0 {
		for _, evt := range GlobalHub.history {
			if evt.Timestamp > since {
				newEvents = append(newEvents, evt)
			}
		}
	}
	GlobalHub.historyMu.RUnlock()

	if newEvents == nil {
		newEvents = []Event{}
	}

	utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "ok",
		"events":    newEvents,
		"timestamp": time.Now().UnixMilli(),
	})
}

