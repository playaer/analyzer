package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"can-analyzer/canbus"
	"can-analyzer/database"
	"github.com/rs/zerolog"
)

type APIHandler struct {
	db          *database.DB
	log         zerolog.Logger
	dataHandler canbus.DataHandler
}

func NewAPIHandler(db *database.DB, dataHandler canbus.DataHandler, log zerolog.Logger) *APIHandler {
	return &APIHandler{
		db:          db,
		dataHandler: dataHandler,
		log:         log,
	}
}

// ... остальные функции остаются такими же ...

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
