package canbus

import (
	"bufio"
	"context"
	"encoding/hex"
	"fmt"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"can-analyzer/database"
	"github.com/rs/zerolog"
)

type FileHandler struct {
	filePath  string
	logger    *CANLogger
	db        *database.DB
	log       zerolog.Logger
	mu        sync.RWMutex
	filters   map[uint32]bool
	sendChan  chan CANFrame
	ctx       context.Context
	cancel    context.CancelFunc
	enableLog bool
}

func NewFileHandler(filePath, logFile string, db *database.DB, log zerolog.Logger, enableLog bool) (*FileHandler, error) {
	var logger *CANLogger
	var err error

	if enableLog {
		logger, err = NewCANLogger(logFile)
		if err != nil {
			return nil, fmt.Errorf("failed to create CAN logger: %v", err)
		}
	}

	ctx, cancel := context.WithCancel(context.Background())

	handler := &FileHandler{
		filePath:  filePath,
		logger:    logger,
		db:        db,
		log:       log,
		filters:   make(map[uint32]bool),
		sendChan:  make(chan CANFrame, 100),
		ctx:       ctx,
		cancel:    cancel,
		enableLog: enableLog,
	}

	// Загрузка фильтров из БД
	if err := handler.loadFilters(); err != nil {
		log.Warn().Err(err).Msg("Failed to load filters")
	}

	return handler, nil
}

func (h *FileHandler) StartReading(broadcastFunc func([]byte)) {
	go h.readLoop(broadcastFunc)
	go h.writeLoop()
}

func (h *FileHandler) readLoop(broadcastFunc func([]byte)) {
	for {
		select {
		case <-h.ctx.Done():
			return
		default:
			file, err := os.Open(h.filePath)
			if err != nil {
				h.log.Error().Err(err).Msg("Failed to open file")
				time.Sleep(1 * time.Second)
				continue
			}

			scanner := bufio.NewScanner(file)
			for scanner.Scan() {
				select {
				case <-h.ctx.Done():
					file.Close()
					return
				default:
					line := scanner.Text()
					frame, err := parseLine(line)
					if err != nil {
						h.log.Debug().Str("line", line).Msg("Skipping invalid line")
						continue
					}

					// Логирование
					if h.enableLog && h.logger != nil {
						h.logger.LogFrame(frame, "RX")
					}

					// Проверка фильтра
					if h.checkFilter(frame.ID) {
						// Преобразование в JSON для WebSocket
						jsonData := fmt.Sprintf(
							`{"type":"can_frame","id":"0x%X","data":"%s","dlc":%d,"time":"%s"}`,
							frame.ID,
							hex.EncodeToString(frame.Data),
							frame.DLC,
							frame.Time.Format(time.RFC3339),
						)

						broadcastFunc([]byte(jsonData))
					}

					// Небольшая задержка между сообщениями
					time.Sleep(10 * time.Millisecond)
				}
			}

			file.Close()

			if err := scanner.Err(); err != nil {
				h.log.Error().Err(err).Msg("Error reading file")
			}

			// При достижении конца файла ждем 1 секунду и начинаем сначала
			h.log.Info().Msg("Reached end of file, restarting in 1 second...")
			time.Sleep(1 * time.Second)
		}
	}
}

func (h *FileHandler) writeLoop() {
	// В режиме файла отправка в CAN не требуется, но мы оставляем канал для отправки из вебсокета
	for {
		select {
		case <-h.ctx.Done():
			return
		case frame := <-h.sendChan:
			h.log.Warn().Msg("Send frame is not supported in file mode")
			// Логирование отправленного фрейма (если нужно)
			if h.enableLog && h.logger != nil {
				h.logger.LogFrame(frame, "TX")
			}
		}
	}
}

func (h *FileHandler) SendFrame(frame CANFrame) {
	select {
	case h.sendChan <- frame:
	default:
		h.log.Warn().Msg("Send channel full, dropping frame")
	}
}

func (h *FileHandler) checkFilter(canID uint32) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if len(h.filters) == 0 {
		return true // Если фильтров нет, пропускаем все
	}

	return h.filters[canID]
}

func (h *FileHandler) loadFilters() error {
	rows, err := h.db.Query("SELECT can_id FROM filters WHERE enabled = 1")
	if err != nil {
		return err
	}
	defer rows.Close()

	h.mu.Lock()
	defer h.mu.Unlock()

	h.filters = make(map[uint32]bool)
	for rows.Next() {
		var canID uint32
		if err := rows.Scan(&canID); err != nil {
			return err
		}
		h.filters[canID] = true
	}

	return rows.Err()
}

func (h *FileHandler) Close() {
	h.cancel()
	if h.logger != nil {
		h.logger.Close()
	}
}

// parseLine парсит строку лога и возвращает CANFrame
// Пример строки: 11:15:53.794 1 0x508 STD Rx 8 00 00 00 00 00 00 00 00
func parseLine(line string) (CANFrame, error) {
	parts := strings.Fields(line)
	if len(parts) < 8 {
		return CANFrame{}, fmt.Errorf("invalid line format")
	}

	// parts[0] - время (только время дня, без даты)
	// parts[1] - номер шины (игнорируем)
	// parts[2] - идентификатор в формате 0xXXX
	// parts[3] - тип (STD или EXT)
	// parts[4] - направление (Rx или Tx)
	// parts[5] - DLC
	// parts[6:] - данные (все оставшиеся части)

	// Парсим время: parts[0] - время в формате HH:MM:SS.sss
	// Мы будем использовать текущую дату и это время
	t, err := parseTime(parts[0])
	if err != nil {
		return CANFrame{}, fmt.Errorf("invalid time: %v", err)
	}

	// Парсим CAN ID
	canIDStr := parts[2]
	canID, err := strconv.ParseUint(canIDStr, 0, 32)
	if err != nil {
		return CANFrame{}, fmt.Errorf("invalid CAN ID: %v", err)
	}

	// Парсим DLC
	dlc, err := strconv.Atoi(parts[5])
	if err != nil {
		return CANFrame{}, fmt.Errorf("invalid DLC: %v", err)
	}

	// Парсим данные
	data := make([]byte, 0)
	for i := 6; i < len(parts); i++ {
		b, err := hex.DecodeString(parts[i])
		if err != nil {
			return CANFrame{}, fmt.Errorf("invalid data byte: %v", err)
		}
		data = append(data, b...)
	}

	// Проверяем, что DLC соответствует количеству данных
	if dlc != len(data) {
		return CANFrame{}, fmt.Errorf("DLC (%d) does not match data length (%d)", dlc, len(data))
	}

	frame := CANFrame{
		ID:   uint32(canID),
		Data: data,
		DLC:  uint8(dlc),
		Time: t,
	}

	return frame, nil
}

// parseTime парсит время из формата HH:MM:SS.sss
func parseTime(timeStr string) (time.Time, error) {
	// Добавляем текущую дату к времени
	currentDate := time.Now().Format("2006-01-02")
	t, err := time.Parse("2006-01-02 15:04:05.000", currentDate+" "+timeStr)
	if err != nil {
		return time.Time{}, err
	}
	return t, nil
}

func (h *FileHandler) ReloadFilters() error {
	return h.loadFilters()
}
