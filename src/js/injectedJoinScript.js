{
    let script = document.currentScript
    let button = script.parentElement

    let placeId = parseInt(button.getAttribute("data-placeid"), 10)
    let serverId = button.getAttribute("data-serverid")

    window.Roblox.GameLauncher.joinGameInstance(placeId, serverId)
}
