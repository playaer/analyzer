.PHONY: build run clean

build:
	go build -o can-analyzer main.go

run: build
	sudo ./can-analyzer

clean:
	rm -f can-analyzer can_log.txt can_data.db

install-deps:
	go mod download

docker-build:
	docker build -t can-analyzer .

docker-run:
	docker run --net=host --privileged can-analyzer

test-file:
	echo -e "11:15:53.794 1 0x508 STD Rx 8 00 00 00 00 00 00 00 00\n11:15:53.804 1 0x274 STD Rx 8 00 00 55 AA 55 AA 55 AA\n11:15:53.828 1 0x39e STD Rx 8 00 08 21 80 00 00 00 00\n11:15:53.835 1 0x501 STD Rx 8 01 00 00 00 00 00 00 00\n11:15:53.896 1 0x508 STD Rx 8 00 00 00 00 00 00 00 00" > can_data.txt
	echo "Test file created: can_data.txt"