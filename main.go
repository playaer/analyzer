package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"can-analyzer/api"
	"can-analyzer/canbus"
	"can-analyzer/config"
	"can-analyzer/database"
	"can-analyzer/websocket"
	"github.com/rs/zerolog"
)

func main() {
	// Инициализация логгера
	logger := zerolog.New(os.Stdout).With().Timestamp().Logger()

	// Загрузка конфигурации
	cfg, err := config.LoadConfig()
	if err != nil {
		logger.Fatal().Err(err).Msg("Failed to load config")
	}

	// Инициализация базы данных
	db, err := database.InitDB(cfg.DBPath)
	if err != nil {
		logger.Fatal().Err(err).Msg("Failed to initialize database")
	}
	defer db.Close()

	// Инициализация CAN обработчика
	canHandler, err := canbus.NewCANHandler(cfg.CANInterface, cfg.LogFile, db, logger)
	if err != nil {
		logger.Fatal().Err(err).Msg("Failed to initialize CAN handler")
	}
	defer canHandler.Close()

	// Инициализация WebSocket хаба
	wsHub := websocket.NewHub(canHandler, db, logger)
	go wsHub.Run()

	// Запуск CAN чтения
	go canHandler.StartReading(wsHub.Broadcast)

	// Настройка HTTP сервера
	mux := http.NewServeMux()

	// Статические файлы
	fs := http.FileServer(http.Dir("./static"))
	mux.Handle("/", fs)

	// WebSocket endpoint
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		websocket.ServeWs(wsHub, w, r)
	})

	// API endpoints
	apiHandler := api.NewAPIHandler(db, logger)
	mux.HandleFunc("/api/filters", apiHandler.HandleFilters)
	mux.HandleFunc("/api/settings", apiHandler.HandleSettings)
	mux.HandleFunc("/api/send", apiHandler.HandleSendCAN)

	server := &http.Server{
		Addr:         cfg.HTTPAddr,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	// Graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		logger.Info().Str("addr", cfg.HTTPAddr).Msg("Starting HTTP server")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal().Err(err).Msg("Server failed")
		}
	}()

	<-stop
	logger.Info().Msg("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.Error().Err(err).Msg("Server shutdown failed")
	}

	canHandler.Close()
	logger.Info().Msg("Server stopped")
}
