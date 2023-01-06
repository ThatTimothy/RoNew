console.log("running")

window.Roblox.GameLauncher.joinGameInstance(
    parseInt(document.body.getAttribute("data-ronew-placeid"), 10),
    document.body.getAttribute("data-ronew-serverid")
)

document.body.removeAttribute("data-ronew-placeid")
document.body.removeAttribute("data-ronew-serverid")
