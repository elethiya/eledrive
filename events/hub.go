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
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	history    []Event
	historyMu  sync.RWMutex
	mu         sync.RWMutex
}

var GlobalHub = NewHub()

func NewHub() *Hub {
	h := &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		history:    make([]Event, 0, 100),
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
			h.mu.Unlock()
		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
			}
			h.mu.Unlock()
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

// Broadcast sends an event to all connected realtime clients
func Broadcast(eventType, target, action, id, folderID, userID string, payload interface{}) {
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
	GlobalHub.historyMu.Lock()
	GlobalHub.history = append(GlobalHub.history, evt)
	if len(GlobalHub.history) > 100 {
		GlobalHub.history = GlobalHub.history[len(GlobalHub.history)-100:]
	}
	GlobalHub.historyMu.Unlock()

	data, err := json.Marshal(evt)
	if err == nil {
		select {
		case GlobalHub.broadcast <- data:
		default:
		}
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

	// Broadcast webhook event to all connected realtime clients
	Broadcast(eventType, target, action, payload.ID, payload.FolderID, payload.UserID, payload.Data)

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

