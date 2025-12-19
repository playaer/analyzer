package canbus

type DataHandler interface {
	StartReading(broadcastFunc func([]byte))
	SendFrame(frame CANFrame)
	Close()
	ReloadFilters() error
}
