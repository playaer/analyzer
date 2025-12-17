package canbus

import (
	"encoding/hex"
	"fmt"
	"os"
	"sync"
)

type CANLogger struct {
	file *os.File
	mu   sync.Mutex
}

func NewCANLogger(filename string) (*CANLogger, error) {
	file, err := os.OpenFile(filename, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return nil, err
	}

	return &CANLogger{file: file}, nil
}

func (l *CANLogger) LogFrame(frame CANFrame, direction string) {
	l.mu.Lock()
	defer l.mu.Unlock()

	// Формат: (timestamp) canX ID#data
	// Пример: (1616161616.123456) can0 123#DEADBEEF
	timestamp := fmt.Sprintf("%.6f", float64(frame.Time.UnixNano())/1e9)
	dataHex := hex.EncodeToString(frame.Data)

	logLine := fmt.Sprintf("(%s) %s %X#%s\n",
		timestamp,
		direction,
		frame.ID,
		dataHex)

	l.file.WriteString(logLine)

	// Также логируем в расширенном формате для совместимости
	extendedLine := fmt.Sprintf("%s %s %03X [%d] %s\n",
		frame.Time.Format("2006-01-02 15:04:05.000000"),
		direction,
		frame.ID,
		frame.DLC,
		dataHex)

	l.file.WriteString(extendedLine)
}

func (l *CANLogger) Close() error {
	if l.file != nil {
		return l.file.Close()
	}
	return nil
}
