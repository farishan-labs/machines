package main

import (
	"flag"
	"fmt"
	"net/http"
	"time"
)

func main() {
	url := flag.String("url", "http://127.0.0.1:3773/", "health URL to poll")
	interval := flag.Duration("interval", 10*time.Second, "poll interval")
	flag.Parse()

	client := &http.Client{Timeout: 3 * time.Second}
	for {
		resp, err := client.Get(*url)
		status := "DOWN"
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode >= 200 && resp.StatusCode < 400 {
				status = "OK"
			} else {
				status = fmt.Sprintf("HTTP %d", resp.StatusCode)
			}
		}
		fmt.Printf("[%s] %s -> %s\n", time.Now().Format(time.RFC3339), *url, status)
		time.Sleep(*interval)
	}
}