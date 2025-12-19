package canbus

import (
	"context"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"go.einride.tech/can"
	"go.einride.tech/can/pkg/socketcan"
	"net"
	"sync"
	"time"

	"can-analyzer/database"
	"github.com/rs/zerolog"
)

type CANFrame struct {
	ID   uint32
	Data []byte
	DLC  uint8
	Time time.Time
}

type CANHandler struct {
	conn        net.Conn
	logger      *CANLogger
	db          *database.DB
	log         zerolog.Logger
	mu          sync.RWMutex
	filters     map[uint32]bool
	sendChan    chan CANFrame
	ctx         context.Context
	cancel      context.CancelFunc
	enableLog   bool
	receiver    *socketcan.Receiver
	transmitter *socketcan.Transmitter
}

func NewCANHandler(interfaceName, logFile string, db *database.DB, log zerolog.Logger, enableLog bool) (*CANHandler, error) {
	// Используем socketcan.DialContext вместо can.NewConnection
	ctx := context.Background()
	conn, err := socketcan.DialContext(ctx, "can", interfaceName)
	if err != nil {
		return nil, fmt.Errorf("failed to open CAN interface: %v", err)
	}

	var logger *CANLogger
	if enableLog {
		logger, err = NewCANLogger(logFile)
		if err != nil {
			return nil, fmt.Errorf("failed to create CAN logger: %v", err)
		}
	}

	handlerCtx, cancel := context.WithCancel(context.Background())

	handler := &CANHandler{
		conn:        conn,
		logger:      logger,
		db:          db,
		log:         log,
		filters:     make(map[uint32]bool),
		sendChan:    make(chan CANFrame, 100),
		ctx:         handlerCtx,
		cancel:      cancel,
		receiver:    socketcan.NewReceiver(conn),
		transmitter: socketcan.NewTransmitter(conn),
	}

	// Загрузка фильтров из БД
	if err := handler.loadFilters(); err != nil {
		log.Warn().Err(err).Msg("Failed to load filters")
	}

	return handler, nil
}

func (h *CANHandler) StartReading(broadcastFunc func([]byte)) {
	go h.readLoop(broadcastFunc)
	go h.writeLoop()
}

func (h *CANHandler) readLoop(broadcastFunc func([]byte)) {
	for {
		select {
		case <-h.ctx.Done():
			return
		default:
			if !h.receiver.Receive() {
				if h.receiver.Err() != nil {
					h.log.Error().Err(h.receiver.Err()).Msg("Failed to receive CAN frame")
				}
				time.Sleep(100 * time.Millisecond)
				continue
			}

			frame := h.receiver.Frame()
			canFrame := CANFrame{
				ID:   frame.ID,
				Data: frame.Data[:frame.Length],
				DLC:  frame.Length,
				Time: time.Now(),
			}

			// Логирование
			if h.enableLog && h.logger != nil {
				h.logger.LogFrame(canFrame, "RX")
			}

			// Проверка фильтра
			if h.checkFilter(canFrame.ID) {
				// Преобразование в JSON для WebSocket
				jsonData := fmt.Sprintf(
					`{"type":"can_frame","id":"0x%X","data":"%s","dlc":%d,"time":"%s"}`,
					canFrame.ID,
					hex.EncodeToString(canFrame.Data),
					canFrame.DLC,
					canFrame.Time.Format(time.RFC3339),
				)

				broadcastFunc([]byte(jsonData))
			}
		}
	}
}

func (h *CANHandler) writeLoop() {
	for {
		select {
		case <-h.ctx.Done():
			return
		case frame := <-h.sendChan:
			canFrame := can.Frame{
				ID:     frame.ID,
				Length: frame.DLC,
			}
			copy(canFrame.Data[:], frame.Data)

			if err := h.transmitter.TransmitFrame(context.Background(), canFrame); err != nil {
				h.log.Error().Err(err).Msg("Failed to write CAN frame")
			} else {
				// Логирование отправленного фрейма
				if h.enableLog && h.logger != nil {
					h.logger.LogFrame(frame, "TX")
				}
			}
		}
	}
}

func (h *CANHandler) SendFrame(frame CANFrame) {
	select {
	case h.sendChan <- frame:
	default:
		h.log.Warn().Msg("Send channel full, dropping frame")
	}
}

func (h *CANHandler) checkFilter(canID uint32) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()

	// If no filters are set, pass everything
	if len(h.filters) == 0 {
		return true
	}

	// Check if this CAN ID is in the filters
	return h.filters[canID]
}

func (h *CANHandler) loadFilters() error {
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

func (h *CANHandler) Close() {
	h.cancel()
	if h.conn != nil {
		h.conn.Close()
	}
	if h.logger != nil {
		h.logger.Close()
	}
}

// ParsePID200 извлекает данные из CAN фрейма с PID=0x200
func ParsePID200(data []byte) (byte, byte, uint16, error) {
	if len(data) < 4 {
		return 0, 0, 0, fmt.Errorf("insufficient data length")
	}

	byte1 := data[0]
	byte2 := data[1]
	byte3_4 := binary.BigEndian.Uint16(data[2:4])

	return byte1, byte2, byte3_4, nil
}

// Добавьте метод ReloadFilters в структуру CANHandler
func (h *CANHandler) ReloadFilters() error {
	return h.loadFilters()
}
