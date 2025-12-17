package websocket

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"can-analyzer/canbus"
	"can-analyzer/database"
	"github.com/gorilla/websocket"
	"github.com/rs/zerolog"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
}

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	canHandler *canbus.CANHandler
	db         *database.DB
	log        zerolog.Logger
	mu         sync.RWMutex
}

type WSMessage struct {
	Type    string `json:"type"`
	ID      string `json:"id,omitempty"`
	Data    string `json:"data,omitempty"`
	Command string `json:"command,omitempty"`
}

func NewHub(canHandler *canbus.CANHandler, db *database.DB, log zerolog.Logger) *Hub {
	return &Hub{
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
		canHandler: canHandler,
		db:         db,
		log:        log,
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) Broadcast(message []byte) {
	select {
	case h.broadcast <- message:
	default:
		h.log.Warn().Msg("Broadcast channel full")
	}
}

func ServeWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		hub.log.Error().Err(err).Msg("WebSocket upgrade failed")
		return
	}

	client := &Client{
		hub:  hub,
		conn: conn,
		send: make(chan []byte, 256),
	}

	client.hub.register <- client

	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(512)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				c.hub.log.Error().Err(err).Msg("WebSocket read error")
			}
			break
		}

		c.handleMessage(message)
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) handleMessage(message []byte) {
	var wsMsg WSMessage
	if err := json.Unmarshal(message, &wsMsg); err != nil {
		c.hub.log.Error().Err(err).Msg("Failed to parse WebSocket message")
		return
	}

	switch wsMsg.Type {
	case "send_can":
		c.handleSendCAN(wsMsg)
	case "uds_command":
		c.handleUDSCommand(wsMsg)
	}
}

func (c *Client) handleSendCAN(msg WSMessage) {
	// Парсинг CAN ID
	canID, err := strconv.ParseUint(msg.ID, 0, 32)
	if err != nil {
		c.hub.log.Error().Err(err).Msg("Invalid CAN ID")
		return
	}

	// Парсинг данных
	data, err := hex.DecodeString(msg.Data)
	if err != nil {
		c.hub.log.Error().Err(err).Msg("Invalid CAN data")
		return
	}

	// Отправка в CAN
	frame := canbus.CANFrame{
		ID:   uint32(canID),
		Data: data,
		DLC:  uint8(len(data)),
		Time: time.Now(),
	}

	c.hub.canHandler.SendFrame(frame)

	// Отправка подтверждения
	response := fmt.Sprintf(
		`{"type":"ack","message":"CAN frame sent","id":"%s"}`,
		msg.ID,
	)
	c.send <- []byte(response)
}

func (c *Client) handleUDSCommand(msg WSMessage) {
	// Реализация UDS команд
	// Здесь можно добавить логику для стандартных UDS команд
	c.hub.log.Info().Str("command", msg.Command).Msg("UDS command received")
}
