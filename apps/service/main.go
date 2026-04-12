package main

import (
	"embed"
	"log"

	"tabzen-service/internal/db"
	"tabzen-service/internal/server"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed frontend/dist
var assets embed.FS

func main() {
	database, err := db.Open()
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}

	if err := server.Start(database, server.DefaultPort); err != nil {
		log.Fatalf("Failed to start HTTP server: %v", err)
	}

	app := application.New(application.Options{
		Name:        "TabZen Service",
		Description: "Local data service for Tab Zen",
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ActivationPolicy: application.ActivationPolicyAccessory,
		},
	})

	systemTray := app.NewSystemTray()
	systemTray.SetLabel("TabZen")

	trayMenu := app.NewMenu()
	trayMenu.Add("TabZen Service Running").SetEnabled(false)
	trayMenu.AddSeparator()
	trayMenu.Add("Quit").OnClick(func(ctx *application.Context) {
		app.Quit()
	})
	systemTray.SetMenu(trayMenu)

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
