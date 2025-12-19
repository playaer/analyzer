package main

import (
	"context"
	"flag"
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
	// Парсинг аргументов командной строки
	mode := flag.String("mode", "file", "Режим работы: can или file")
	filePath := flag.String("file", "", "Путь к файлу для чтения (только в режиме file)")
	enableLog := flag.Bool("log", false, "Включить логирование")
	flag.Parse()

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

	// Инициализация обработчика данных
	var dataHandler canbus.DataHandler
	if *mode == "can" {
		dataHandler, err = canbus.NewCANHandler(cfg.CANInterface, cfg.LogFile, db, logger, *enableLog)
		if err != nil {
			logger.Fatal().Err(err).Msg("Failed to initialize CAN handler")
		}
	} else if *mode == "file" {
		if *filePath == "" {
			logger.Fatal().Msg("File path is required in file mode")
		}
		dataHandler, err = canbus.NewFileHandler(*filePath, cfg.LogFile, db, logger, *enableLog)
		if err != nil {
			logger.Fatal().Err(err).Msg("Failed to initialize file handler")
		}
	} else {
		logger.Fatal().Msg("Unknown mode")
	}
	defer dataHandler.Close()

	// Инициализация WebSocket хаба
	wsHub := websocket.NewHub(dataHandler, db, logger)
	go wsHub.Run()

	// Запуск чтения данных
	go dataHandler.StartReading(wsHub.Broadcast)

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
	apiHandler := api.NewAPIHandler(db, dataHandler, logger)
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
		logger.Info().Str("addr", cfg.HTTPAddr).Str("mode", *mode).Msg("Starting HTTP server")
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

	dataHandler.Close()
	logger.Info().Msg("Server stopped")
}
