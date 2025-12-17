package config

import (
	"github.com/spf13/viper"
)

type Config struct {
	CANInterface string
	LogFile      string
	DBPath       string
	HTTPAddr     string
	BaudRate     int
}

func LoadConfig() (*Config, error) {
	viper.SetDefault("can_interface", "can0")
	viper.SetDefault("log_file", "can_log.txt")
	viper.SetDefault("db_path", "can_data.db")
	viper.SetDefault("http_addr", ":8080")
	viper.SetDefault("baud_rate", 500000)

	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("/etc/can-analyzer/")

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, err
		}
	}

	cfg := &Config{
		CANInterface: viper.GetString("can_interface"),
		LogFile:      viper.GetString("log_file"),
		DBPath:       viper.GetString("db_path"),
		HTTPAddr:     viper.GetString("http_addr"),
		BaudRate:     viper.GetInt("baud_rate"),
	}

	return cfg, nil
}
