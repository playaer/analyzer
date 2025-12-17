package database

// Filter представляет фильтр CAN сообщений
type Filter struct {
	ID      int    `json:"id"`
	CANID   uint32 `json:"can_id"`
	Mask    uint32 `json:"mask"`
	Enabled bool   `json:"enabled"`
}

// Settings представляет настройки приложения
type Settings struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// CANLog представляет запись в логе CAN сообщений
type CANLog struct {
	ID        int    `json:"id"`
	Timestamp string `json:"timestamp"`
	Direction string `json:"direction"`
	CANID     uint32 `json:"can_id"`
	Data      []byte `json:"data"`
	DLC       int    `json:"dlc"`
}
