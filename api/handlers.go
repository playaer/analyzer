package api

import (
	"can-analyzer/canbus"
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"can-analyzer/database"
	"github.com/rs/zerolog"
)

type APIHandler struct {
	db          *database.DB
	log         zerolog.Logger
	dataHandler canbus.DataHandler
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

func NewAPIHandler(db *database.DB, dataHandler canbus.DataHandler, log zerolog.Logger) *APIHandler {
	return &APIHandler{
		db:          db,
		dataHandler: dataHandler,
		log:         log,
	}
}

func (h *APIHandler) HandleFilters(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.getFilters(w, r)
	case http.MethodPost:
		h.addFilter(w, r)
	case http.MethodPut:
		h.updateFilter(w, r)
	case http.MethodDelete:
		h.deleteFilter(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *APIHandler) reloadFilters() {
	// Метод для перезагрузки фильтров в обработчике данных
	if handler, ok := h.dataHandler.(interface{ ReloadFilters() error }); ok {
		if err := handler.ReloadFilters(); err != nil {
			h.log.Error().Err(err).Msg("Failed to reload filters in data handler")
		}
	}
}

func (h *APIHandler) addFilter(w http.ResponseWriter, r *http.Request) {
	var f Filter
	if err := json.NewDecoder(r.Body).Decode(&f); err != nil {
		h.log.Error().Err(err).Msg("Invalid request body")
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate input
	if f.CANID == 0 {
		http.Error(w, "CAN ID is required", http.StatusBadRequest)
		return
	}

	// Check if filter already exists
	var existingID int
	err := h.db.QueryRow("SELECT id FROM filters WHERE can_id = ?", f.CANID).Scan(&existingID)

	if err == nil {
		// Filter exists, update it
		enabledValue := 0
		if f.Enabled {
			enabledValue = 1
		}

		_, err = h.db.Exec(
			"UPDATE filters SET mask = ?, enabled = ? WHERE id = ?",
			f.Mask, enabledValue, existingID,
		)
		if err != nil {
			h.log.Error().Err(err).Msg("Failed to update filter")
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		f.ID = existingID
	} else if err == sql.ErrNoRows {
		// Filter doesn't exist, insert new one
		enabledValue := 0
		if f.Enabled {
			enabledValue = 1
		}

		result, err := h.db.Exec(
			"INSERT INTO filters (can_id, mask, enabled) VALUES (?, ?, ?)",
			f.CANID, f.Mask, enabledValue,
		)
		if err != nil {
			h.log.Error().Err(err).Msg("Failed to insert filter")
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		id, err := result.LastInsertId()
		if err != nil {
			h.log.Error().Err(err).Msg("Failed to get last insert ID")
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		f.ID = int(id)
	} else {
		h.log.Error().Err(err).Msg("Failed to check existing filter")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Reload filters in data handler
	h.reloadFilters()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(f); err != nil {
		h.log.Error().Err(err).Msg("Failed to encode response")
	}
}

func (h *APIHandler) deleteFilter(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		// Try to get ID from JSON body
		var f struct {
			ID int `json:"id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&f); err == nil && f.ID != 0 {
			idStr = strconv.Itoa(f.ID)
		}
	}

	if idStr == "" {
		// Try to delete by CAN ID
		canIdStr := r.URL.Query().Get("can_id")
		if canIdStr != "" {
			canId, err := strconv.ParseUint(canIdStr, 0, 32)
			if err != nil {
				http.Error(w, "Invalid CAN ID", http.StatusBadRequest)
				return
			}

			_, err = h.db.Exec("DELETE FROM filters WHERE can_id = ?", uint32(canId))
			if err != nil {
				h.log.Error().Err(err).Msg("Failed to delete filter by CAN ID")
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				return
			}

			// Reload filters in data handler
			h.reloadFilters()

			w.WriteHeader(http.StatusNoContent)
			return
		}

		http.Error(w, "Filter ID or CAN ID is required", http.StatusBadRequest)
		return
	}

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

	// Reload filters in data handler
	h.reloadFilters()

	w.WriteHeader(http.StatusNoContent)
}

func (h *APIHandler) getFilters(w http.ResponseWriter, r *http.Request) {
	h.log.Info().Msg("Fetching filters from database")

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
		var enabledInt int
		if err := rows.Scan(&f.ID, &f.CANID, &f.Mask, &enabledInt); err != nil {
			h.log.Error().Err(err).Msg("Failed to scan filter")
			continue
		}
		f.Enabled = enabledInt == 1
		filters = append(filters, f)
		h.log.Info().Uint32("can_id", f.CANID).Bool("enabled", f.Enabled).Msg("Found filter")
	}

	if err := rows.Err(); err != nil {
		h.log.Error().Err(err).Msg("Error iterating filters")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	h.log.Info().Int("count", len(filters)).Msg("Returning filters")

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(filters); err != nil {
		h.log.Error().Err(err).Msg("Failed to encode filters")
	}
}

func (h *APIHandler) updateFilter(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Query().Get("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid filter ID", http.StatusBadRequest)
		return
	}

	var f Filter
	if err := json.NewDecoder(r.Body).Decode(&f); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	enabledValue := 0
	if f.Enabled {
		enabledValue = 1
	}

	_, err = h.db.Exec(
		"UPDATE filters SET can_id = ?, mask = ?, enabled = ? WHERE id = ?",
		f.CANID, f.Mask, enabledValue, id,
	)
	if err != nil {
		h.log.Error().Err(err).Msg("Failed to update filter")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	f.ID = id
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(f); err != nil {
		h.log.Error().Err(err).Msg("Failed to encode response")
	}
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
