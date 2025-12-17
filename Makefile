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