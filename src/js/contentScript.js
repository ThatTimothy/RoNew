const GAMES_PAGE_REGEX = /roblox\.com\/games\/(\d*)\//g

const ANIMATION_STATUS_IN_KEYFRAMES = [
    { opacity: "0", height: "0" },
    { opacity: "0", height: "var(--height)" },
    { opacity: "1", height: "var(--height)" },
]

const ANIMATION_STATUS_OUT_KEYFRAMES = [
    { opacity: "1", height: "var(--height)" },
    { opacity: "0", height: "var(--height)" },
    { opacity: "0", height: "0" },
]

const ANIMATION_STATUS_TIMING = {
    duration: 500,
}

const RATELIMIT_BACKOFF = 15.0 * 1000
const SERVER_ERROR_BACKOFF = 30.0 * 1000
const BETWEEN_DELAY = 2.5 * 1000
const BETWEEN_FETCHING_ALL = 5.0 * 1000
const CHECK_DELAY = 5.0 * 1000
const BETWEEN_FOUND_DELAY = 5.0 * 1000

const SHOW_JOINED_TEXT_FOR = 5.0 * 1000

let placeId, containerTemplateContent, serverTemplateContent
let loadId = 0
let autoJoin = false

// Custom log so it's clear what logs are from RoNew and what logs are from Roblox
function log(message, error) {
    if (!error) {
        console.log(`%c[RoNew] ${message}`, `color: yellow;`)
    } else {
        const stack = new Error(message).stack
        console.error(`[RoNew] ERROR: ${stack}`)
    }
}

// Wrapper for log(error, true)
function logError(error) {
    log(`${error}`, true)
}

// Returns a promise that resolves in ms
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

function playNotificationSound() {
    const audio = new Audio(chrome.runtime.getURL("res/notification.mp3"))
    audio.play()
}

function animateStatus(container, visible) {
    if (visible) {
        container
            .animate(ANIMATION_STATUS_IN_KEYFRAMES, ANIMATION_STATUS_TIMING)
            .addEventListener("finish", () => {
                container.style.setProperty("opacity", "1")
                container.style.setProperty("height", "var(--height)")
            })
    } else {
        container
            .animate(ANIMATION_STATUS_OUT_KEYFRAMES, ANIMATION_STATUS_TIMING)
            .addEventListener("finish", () => {
                container.style.setProperty("opacity", "0")
                container.style.setProperty("height", "0")
            })
    }
}

function updateStatus(container, status, type) {
    const currentVisible =
        container.getAttribute("data-visible") == "true" || false

    if (!status || status == "") {
        if (currentVisible) {
            animateStatus(container, false)
        }
        container.setAttribute("data-visible", false)
        return
    }

    const text = container.querySelector("p")
    text.innerText = status

    container.style.setProperty("--height", text.offsetHeight + "px")

    if (!currentVisible) {
        animateStatus(container, true)
    }
    container.setAttribute("data-visible", true)
    container.setAttribute("data-type", type)
}

function setStatus(status, type) {
    updateStatus(document.getElementById("rbx-ronew-status"), status, type)
}

function setStatusDetailed(statusDetailed) {
    updateStatus(
        document.getElementById("rbx-ronew-status-detailed"),
        statusDetailed
    )
}

function setAttemptStatus(status, type) {
    const attemptStatus = document.getElementById("rbx-ronew-attempt-status")

    if (!status) {
        attemptStatus.setAttribute("data-visible", false)
        return
    }

    attemptStatus.setAttribute("data-visible", true)
    attemptStatus.setAttribute("data-type", type)
    attemptStatus.innerText = status
}

function formatSecondsToTime(seconds) {
    seconds = Math.ceil(seconds)

    if (seconds >= 60) {
        return Math.floor(seconds / 60).toString(10) + "m"
    }

    return seconds.toString(10) + "s"
}

async function sleepWithCallback(ms, callback) {
    let start = Date.now()
    while (true) {
        left = ms - (Date.now() - start)

        if (left > 0) {
            callback(left / 1000)
        } else {
            break
        }

        await sleep(Math.min(left, 100))
    }
}

// Gets a pae of servers
function getServers(placeId, cursor) {
    return new Promise(async (resolve, reject) => {
        // 0 = public servers
        // sort order 1 = lowest first
        // exclude full games = false makes sure we get all servers
        // limit 100 = 100 per page
        const url = `https://games.roblox.com/v1/games/${placeId}/servers/0?sortOrder=1&excludeFullGames=false&limit=100${
            cursor ? `&cursor=${cursor}` : ""
        }`

        const response = await fetch(url)

        let ratelimited = response.status == 429
        let serverError = response.status >= 500 && response.status < 600

        if (ratelimited || serverError) {
            let wait = 0

            if (ratelimited) {
                wait = RATELIMIT_BACKOFF
            } else if (serverError) {
                wait = SERVER_ERROR_BACKOFF
            }

            await sleepWithCallback(wait, (left) =>
                setStatusDetailed(
                    `Ratelimited, waiting... (${formatSecondsToTime(
                        left
                    )}) left)`
                )
            )

            return getServers(placeId, cursor).then(resolve).catch(reject)
        }

        if (response.status != 200) {
            return reject("Error occurred")
        }

        const json = await response.json().catch(reject)

        resolve(json)
    })
}

// Traverses through servers using nextPageCursor
function fetchAllServers(placeId) {
    return new Promise(async (resolve, reject) => {
        const seen = new Set()

        let pageI = 1
        let cursor

        while (true) {
            setStatusDetailed(`Fetching server page ${pageI}...`)
            const response = await getServers(placeId, cursor).catch(reject)

            if (!response) {
                return
            }

            for (const server of response.data) {
                seen.add(server.id)
            }

            let nextCursor = response.nextPageCursor

            if (!nextCursor) {
                setStatusDetailed(`Finished getting all servers!`)
                break
            }

            cursor = nextCursor

            await sleepWithCallback(BETWEEN_DELAY, (left) =>
                setStatusDetailed(
                    `Got server page ${pageI}, retrieving next in ${formatSecondsToTime(
                        left
                    )}...`
                )
            )
            pageI += 1
        }

        resolve(seen)
    })
}

// This is needed because for some reason sometimes we don't see all servers on the first pass-through.
// Not exactly sure why, but this works™.
async function fetchAllServersMulti(placeId) {
    const allServers = new Set()

    for (let i = 1; i <= 3; i++) {
        setStatus(`Fetching all servers... (${i}/3)`)
        let servers = await fetchAllServers(placeId)

        if (!servers) {
            return
        }

        for (let item of servers) {
            allServers.add(item)
        }

        if (i < 3) {
            await sleepWithCallback(BETWEEN_FETCHING_ALL, (left) =>
                setStatusDetailed(
                    `Finished fetch ${i}, starting next in ${formatSecondsToTime(
                        left
                    )}...`
                )
            )
        } else {
            setStatusDetailed("Finished fetching all servers!")
        }
    }

    return allServers
}

// Finds the newest server by checking the first page to see if any new servers exist.
function findNewestServerId(placeId, servers) {
    let currentLoadId = loadId

    return new Promise(async (resolve, reject) => {
        let attempts = 1

        while (currentLoadId == loadId) {
            setAttemptStatus(`Attempting... (${attempts})`)
            const toCheck = await getServers(placeId).catch(reject)

            if (currentLoadId != loadId) {
                return reject()
            }

            if (!toCheck) {
                return
            }

            let newServers = []

            for (const possible of toCheck.data) {
                const id = possible.id

                if (servers.has(id)) {
                    continue
                }

                servers.add(id)
                newServers.push(id)
            }

            if (newServers.length > 0) {
                return resolve(newServers)
            }

            await sleepWithCallback(CHECK_DELAY, (left) => {
                if (currentLoadId != loadId) {
                    return reject()
                }
                setAttemptStatus(
                    `No results, retrying in ${formatSecondsToTime(
                        left
                    )}... (${attempts})`
                )
            })

            attempts += 1
        }

        return reject()
    })
}

// Injects a join script which launches Roblox into the appropriate place
async function injectJoinScript(element) {
    const injected = document.createElement("script")
    injected.src = chrome.runtime.getURL("js/injectedJoinScript.js")
    element.appendChild(injected)
}

// Event handler for join buttons
async function handleJoinButton(event) {
    const button = event.target
    const ageStatusText = button.parentElement.parentElement.querySelector(
        ".rbx-ronew-server-age-status"
    )

    button.setAttribute("disabled", "")
    ageStatusText.setAttribute("data-visible", false)
    button.innerText = "Joining..."

    injectJoinScript(button)

    await sleep(SHOW_JOINED_TEXT_FOR)

    button.removeAttribute("disabled")
    button.innerText = "Join"
}

// Sets whether the refresh button is enabled
function setRefreshEnabled(enabled) {
    const button = document.querySelector("#rbx-ronew-servers .rbx-refresh")

    if (enabled) {
        button.removeAttribute("disabled")
    } else {
        button.setAttribute("disabled", "")
    }
}

// Adds a server to the list
async function injectServer(placeId, serverId) {
    if (!serverTemplateContent) {
        const response = await fetch(
            chrome.runtime.getURL("html/serverTemplate.html")
        )
        serverTemplateContent = await response.text()
    }

    const serverContainerRoot = document
        .getElementById("running-game-instances-container")
        .querySelector(".tab-server-only .rbx-ronew-game-server-item-container")

    serverContainerRoot.insertAdjacentHTML("afterbegin", serverTemplateContent)

    const added = serverContainerRoot.querySelector("li")

    const title = added.querySelector(".section-header span")
    title.innerText = serverId

    const button = added.querySelector("button")

    button.setAttribute("data-placeid", placeId)
    button.setAttribute("data-serverid", serverId)
    button.setAttribute("data-created", Date.now())
    button.addEventListener("click", handleJoinButton)

    if (autoJoin) {
        setAutoJoin(false)
        playNotificationSound()
        button.click()
    }
}

// Loads the servers
async function load(event) {
    setStatus(false)
    setRefreshEnabled(false)
    setAttemptStatus(false)
    if (loadId != 0) {
        setAutoJoin(false)
    }
    loadId += 1
    let thisLoadId = loadId

    const beginButton = event.target
    const beginContainer = beginButton.parentElement

    if (beginButton.getAttribute("data-gone") != "true") {
        beginButton.setAttribute("disabled", true)
        beginContainer.style.setProperty(
            "--height",
            beginContainer.clientHeight + "px"
        )
        beginContainer.setAttribute("data-visible", false)
    }

    const serverContainerRoot = document
        .getElementById("running-game-instances-container")
        .querySelector(".tab-server-only .rbx-ronew-game-server-item-container")

    serverContainerRoot.replaceChildren()

    await sleep(500)

    beginContainer.setAttribute("data-gone", true)

    await sleep(500)

    setStatus("Fetching all servers...")

    let allServers = await fetchAllServersMulti(placeId).catch(logError)

    if (!allServers) {
        setStatus("Failed to fetch servers!", "error")
    }

    setStatus(false)
    setStatusDetailed(false)
    setRefreshEnabled(true)

    while (thisLoadId == loadId) {
        let serverIds = await findNewestServerId(placeId, allServers).catch(
            (err) => {
                if (thisLoadId != loadId) {
                    return
                }
                logError(err)
            }
        )

        if (thisLoadId != loadId) {
            break
        }

        if (!serverIds) {
            setStatus("Something went wrong finding a new server!", "error")
            return
        }

        for (const serverId of serverIds) {
            await injectServer(placeId, serverId)
        }

        setAttemptStatus("Found server!", "success")

        await sleep(BETWEEN_FOUND_DELAY)
    }
}

// Sets auto join
function setAutoJoin(enabled) {
    const autoRefreshToggle = document.querySelector(
        "#rbx-ronew-auto-join-switch button"
    )

    autoJoin = enabled

    if (enabled) {
        autoRefreshToggle.classList.remove("off")
        autoRefreshToggle.classList.add("on")
    } else {
        autoRefreshToggle.classList.remove("on")
        autoRefreshToggle.classList.add("off")
    }
}

// Toggles auto join
function toggleAutoJoin(event) {
    const autoRefreshToggle = event.target

    setAutoJoin(autoRefreshToggle.classList.contains("off"))
}

// Injects the container into the servers tab
async function injectContainer() {
    const serverRoot = document.getElementById(
        "running-game-instances-container"
    )

    if (!serverRoot) {
        throw new Error("No server root!")
    }

    if (!containerTemplateContent) {
        const response = await fetch(
            chrome.runtime.getURL("html/containerTemplate.html")
        )
        containerTemplateContent = await response.text()
    }

    serverRoot.insertAdjacentHTML("afterbegin", containerTemplateContent)

    const contentRoot = serverRoot.querySelector("#rbx-ronew-servers")

    // Bind begin
    const beginContainer = contentRoot.querySelector("#rbx-ronew-begin")

    beginContainer.querySelector("button").addEventListener("click", load)

    // Bind refresh
    const refreshButton = contentRoot.querySelector(".rbx-refresh")

    refreshButton.addEventListener("click", load)

    // Bind auto refresh toggle
    const autoRefreshToggle = document.querySelector(
        "#rbx-ronew-auto-join-switch button"
    )

    autoRefreshToggle.addEventListener("click", toggleAutoJoin)
}

// Updates the "Created x ago" ages
function updateServerAges() {
    const serverRoot = document.getElementById(
        "running-game-instances-container"
    )
    const contentRoot = serverRoot.querySelector("#rbx-ronew-servers")
    const serverItems = contentRoot.querySelector("ul").querySelectorAll("li")

    for (const serverItem of serverItems) {
        const status = serverItem.querySelector(
            ".game-server-details .rbx-ronew-server-age-text"
        )
        const button = serverItem.querySelector("button")
        const elapsed =
            Date.now() - parseInt(button.getAttribute("data-created"))

        status.innerText = `Created ${formatSecondsToTime(elapsed / 1000)} ago`
    }
}

// Initialize everything
async function initialize() {
    // Get place id
    const matches = window.location.toString().match(GAMES_PAGE_REGEX)

    if (!matches) {
        return
    }

    // This takes the first match, and replaces it with the first capture group's content ($1), or the id of the game
    placeId = matches[0].replace(GAMES_PAGE_REGEX, "$1")

    try {
        placeId = parseInt(placeId)
    } catch (e) {
        // Not really a number
        return
    }

    log("Ready!")
    log(`Found placeId "${placeId}"`)

    // Inject container
    await injectContainer()

    // Start update server ages loop
    setInterval(updateServerAges, 250)

    log("Successfully injected & initialized!")
}

initialize()
