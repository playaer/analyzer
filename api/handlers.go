package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"can-analyzer/database"
	"github.com/rs/zerolog"
)

type APIHandler struct {
	db  *database.DB
	log zerolog.Logger
}

type Filter struct {
	ID      int    `json:"id"`
	CANID   uint32 `json:"can_id"`
	Mask    uint32 `json:"mask"`
	Enabled bool   `json:"enabled"`
}

type Settings struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type CANFrameRequest struct {
	ID   string `json:"id"`
	Data string `json:"data"`
}

func NewAPIHandler(db *database.DB, log zerolog.Logger) *APIHandler {
	return &APIHandler{
		db:  db,
		log: log,
	}
}

func (h *APIHandler) HandleFilters(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.getFilters(w, r)
	case http.MethodPost:
		h.addFilter(w, r)
	case http.MethodDelete:
		h.deleteFilter(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *APIHandler) getFilters(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query("SELECT id, can_id, mask, enabled FROM filters")
	if err != nil {
		h.log.Error().Err(err).Msg("Failed to query filters")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	filters := []Filter{}
	for rows.Next() {
		var f Filter
		if err := rows.Scan(&f.ID, &f.CANID, &f.Mask, &f.Enabled); err != nil {
			h.log.Error().Err(err).Msg("Failed to scan filter")
			continue
		}
		filters = append(filters, f)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(filters)
}

func (h *APIHandler) addFilter(w http.ResponseWriter, r *http.Request) {
	var f Filter
	if err := json.NewDecoder(r.Body).Decode(&f); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	result, err := h.db.Exec(
		"INSERT INTO filters (can_id, mask, enabled) VALUES (?, ?, ?)",
		f.CANID, f.Mask, f.Enabled,
	)
	if err != nil {
		h.log.Error().Err(err).Msg("Failed to insert filter")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	id, _ := result.LastInsertId()
	f.ID = int(id)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(f)
}

func (h *APIHandler) deleteFilter(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Query().Get("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid filter ID", http.StatusBadRequest)
		return
	}

	_, err = h.db.Exec("DELETE FROM filters WHERE id = ?", id)
	if err != nil {
		h.log.Error().Err(err).Msg("Failed to delete filter")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *APIHandler) HandleSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.getSettings(w, r)
	case http.MethodPost:
		h.saveSettings(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *APIHandler) getSettings(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")

	var value string
	err := h.db.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&value)
	if err != nil {
		http.Error(w, "Setting not found", http.StatusNotFound)
		return
	}

	settings := Settings{Key: key, Value: value}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(settings)
}

func (h *APIHandler) saveSettings(w http.ResponseWriter, r *http.Request) {
	var s Settings
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	_, err := h.db.Exec(
		"INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
		s.Key, s.Value,
	)
	if err != nil {
		h.log.Error().Err(err).Msg("Failed to save settings")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s)
}

func (h *APIHandler) HandleSendCAN(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req CANFrameRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Здесь будет логика отправки CAN фрейма
	// Пока что просто возвращаем подтверждение

	response := map[string]string{
		"status":  "success",
		"message": "CAN frame queued for sending",
		"id":      req.ID,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
